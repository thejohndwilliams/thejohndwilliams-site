  // Gallery + lightbox controller.
  //
  // Rebuilt 2026-06-09 after a field crash report: rapid swiping killed the
  // page on iOS Safari. Root causes, verified by instrumented repro:
  //   1. navigate() ran document.startViewTransition PER SWIPE. Each VT
  //      snapshots the full 101-image page twice; rapid-fire swipes created
  //      an allocation storm that tripped Safari's memory watchdog.
  //   2. initGallery re-ran on every astro:after-swap (site-wide) and added
  //      document-level listeners each time without removing the previous
  //      set: N visits = N keydown handlers = N navigations per keypress,
  //      each closure retaining a detached DOM tree.
  //   3. body.overflow=hidden does not lock scroll on iOS; the gallery
  //      rubber-banded (and Lenis kept processing) behind the open dialog.
  // Design now: View Transitions ONLY for open/close morph (the signature
  // move). Swipes are finger-tracked transforms + compositor slides, one
  // in-flight animation max, with jump-cut coalescing under rapid input.
  // All listeners bind through one AbortController, aborted on re-init.

  let galleryAbort: AbortController | null = null;

  function initGallery() {
    galleryAbort?.abort();
    galleryAbort = null;
    // Stale-state guard: <html> persists across view-transition navigations,
    // so a viewer left open on /photography must not hide the chrome
    // site-wide after navigating away.
    document.documentElement.classList.remove('lb-open');
    // P1 lock, 2026-07-19: the scroll lock stops the persisted Lenis
    // singleton; if unlockScroll never ran (history-back with the viewer
    // open), restart it here. start() is idempotent when already running.
    (window as any).__lenis?.start?.();
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return; // other pages: bind nothing, leak nothing
    galleryAbort = new AbortController();
    const { signal } = galleryAbort;

    const lightboxImg = document.getElementById('lightbox-img') as HTMLImageElement;
    const lightboxCaption = document.getElementById('lightbox-caption');
    const lightboxMeta = document.getElementById('lightbox-meta');
    const items = document.querySelectorAll('.gallery-item');

    // Light-reveal tracker (experiment, 2026-07-03): writes --mx/--my on the
    // hovered tile for the masked warm lift. rAF-throttled, passive, dies
    // with the gallery AbortController. Touch and reduced-motion never bind,
    // matching initGlassSpecular's gates in BaseLayout.
    if (
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      let lrPending = false;
      let lrX = 0;
      let lrY = 0;
      let lrTile: HTMLElement | null = null;
      document.addEventListener(
        'pointermove',
        (e) => {
          const t = (e.target as Element | null)?.closest?.('.gallery-item') as HTMLElement | null;
          if (!t) return;
          lrTile = t;
          lrX = e.clientX;
          lrY = e.clientY;
          if (lrPending) return;
          lrPending = true;
          requestAnimationFrame(() => {
            lrPending = false;
            if (!lrTile) return;
            const r = lrTile.getBoundingClientRect();
            lrTile.style.setProperty('--mx', ((lrX - r.left) / r.width) * 100 + '%');
            lrTile.style.setProperty('--my', ((lrY - r.top) / r.height) * 100 + '%');
          });
        },
        { signal, passive: true }
      );
    }
    const closeBtn = document.getElementById('lightbox-close');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');
    const chromeBtns = [closeBtn, prevBtn, nextBtn].filter(Boolean) as HTMLElement[];
    let currentIndex = 0;
    let visibleItems: Element[] = [];
    let lastFocused: HTMLElement | null = null;
    let idleT: ReturnType<typeof setTimeout>;
    const reduceMo = matchMedia('(prefers-reduced-motion: reduce)');
    const canVT = () => typeof (document as any).startViewTransition === 'function' && !reduceMo.matches;
    const tileImg = (item: any): HTMLElement | null => item ? item.querySelector('img') : null;
    const lenis = () => (window as any).__lenis;
    // Idle chrome is visually gone (opacity 0, pointer-events none) but
    // buttons stay in the tab order unless we take them out of it.
    function setChromeIdle(idle: boolean) {
      lightbox.classList.toggle('idle', idle);
      for (const el of chromeBtns) {
        if (idle) {
          el.setAttribute('inert', '');
          el.tabIndex = -1;
        } else {
          el.removeAttribute('inert');
          el.removeAttribute('tabindex');
        }
      }
      if (idle) {
        const ae = document.activeElement as HTMLElement | null;
        if (ae && chromeBtns.includes(ae)) ae.blur();
      }
    }
    function armIdle() { setChromeIdle(false); clearTimeout(idleT); idleT = setTimeout(() => setChromeIdle(true), 2000); }

    // iOS-proof scroll lock: fix the body in place and pause Lenis. overflow
    // alone does not stop touch scroll or rubber-banding on iOS Safari.
    let savedScrollY = 0;
    function lockScroll() {
      savedScrollY = window.scrollY;
      lenis()?.stop?.();
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    }
    function unlockScroll() {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, savedScrollY);
      lenis()?.start?.();
    }

    // Serve the 1200px gallery tier as the base; srcset lets retina desktop
    // pull the 2400px hero. src previously pointed at the hero, which forced
    // worst-case decodes on phones during swipe bursts.
    function setLightboxImage(item: HTMLElement) {
      const file = item.dataset.file || '';
      const alt = item.dataset.alt || '';
      if (file) {
        lightboxImg.srcset = `/images/photography/gallery/${file}.webp 1200w, /images/photography/hero/${file}.webp 2400w`;
        lightboxImg.src = `/images/photography/gallery/${file}.webp`;
      } else {
        lightboxImg.removeAttribute('srcset');
        lightboxImg.src = item.dataset.src || '';
      }
      lightboxImg.decoding = 'async';
      lightboxImg.alt = alt;
      if (lightboxCaption) lightboxCaption.textContent = alt;
      if (lightboxMeta) lightboxMeta.textContent = item.dataset.meta || '';
    }

    // Neighbor warmer with a bounded set so swipe bursts cannot re-spawn
    // Image() objects for files already requested this visit.
    const prefetched = new Set<string>();
    function prefetchNeighbors() {
      if (!visibleItems.length) return;
      for (const d of [-1, 1]) {
        const n = (currentIndex + d + visibleItems.length) % visibleItems.length;
        const f = (visibleItems[n] as HTMLElement)?.dataset.file;
        if (f && !prefetched.has(f)) {
          if (prefetched.size > 24) prefetched.clear();
          prefetched.add(f);
          const im = new Image();
          im.src = `/images/photography/gallery/${f}.webp`;
        }
      }
    }

    function updateVisibleItems() {
      visibleItems = Array.from(document.querySelectorAll('.gallery-section:not([data-hidden]) .gallery-item'));
    }

    function openLightbox(index: number) {
      // P2 fix, 2026-07-19: a pending slide swap from a previous session
      // (Escape mid-slide, reopen) must not fire into this one. Invalidate
      // the token and cancel the timer before anything else.
      navToken++;
      snapComplete();
      updateVisibleItems();
      currentIndex = index;
      const item = visibleItems[currentIndex] as HTMLElement;
      if (!item) return;
      lastFocused = document.activeElement as HTMLElement;
      const src = tileImg(item);
      const reveal = () => {
        setLightboxImage(item);
        lightbox.classList.add('active');
        // Chrome-yield state lives on <html>, controller-driven: body:has()
        // proved unreliable (stale style invalidation observed in Chrome on
        // close AND in headless CI where the yield never applied at all).
        document.documentElement.classList.add('lb-open');
        lockScroll();
        (closeBtn as HTMLElement | null)?.focus();
        prefetchNeighbors();
        armIdle();
      };
      if (canVT() && src) {
        // Name handoff: only ONE element may carry lb-photo per snapshot.
        // Old snapshot: the tile. New snapshot: the lightbox image.
        src.style.viewTransitionName = 'lb-photo';
        const t = (document as any).startViewTransition(() => {
          src.style.viewTransitionName = '';
          lightboxImg.style.viewTransitionName = 'lb-photo';
          reveal();
        });
        t.finished.finally(() => { src.style.viewTransitionName = ''; lightboxImg.style.viewTransitionName = ''; });
      } else reveal();
    }

    function closeLightbox() {
      // P2 fix, 2026-07-19: kill any in-flight slide before closing, else the
      // pending swapIn fires post-close (stale fetches, desynced reopen) and
      // Escape mid-slide morphs back to the wrong tile.
      navToken++;
      snapComplete();
      const src = tileImg(visibleItems[currentIndex] as HTMLElement);
      const hide = () => { lightbox.classList.remove('active'); document.documentElement.classList.remove('lb-open'); unlockScroll(); lastFocused?.focus(); };
      if (canVT() && src) {
        lightboxImg.style.viewTransitionName = 'lb-photo';
        const t = (document as any).startViewTransition(() => {
          lightboxImg.style.viewTransitionName = '';
          src.style.viewTransitionName = 'lb-photo';
          hide();
        });
        t.finished.finally(() => { lightboxImg.style.viewTransitionName = ''; src.style.viewTransitionName = ''; });
      } else hide();
    }

    // -- Slide engine: compositor-only transforms, one animation in flight. --
    // Hardened 2026-07-08 after John's field report (arrow-key ghosting on
    // desktop; occasional page death on iOS while switching). Two defects:
    // (1) the swap changed src on the single <img> and slid it straight back
    //     in — browsers paint the PREVIOUS bitmap until the new source
    //     decodes, so the old photo visibly rode back across the screen;
    // (2) the pending swap setTimeout was never cancelled, so rapid input
    //     stacked swap closures fighting over one element — stale frames on
    //     desktop, and on iOS a pile-up of concurrent large decodes that
    //     trips Safari's memory watchdog.
    // Now: ONE cancellable timer, a generation token so superseded swaps
    // no-op entirely (at most one decode per settled navigation), and a
    // decode() gate so the new frame is paintable before it slides in —
    // capped at 400ms so slow networks jump-cut instead of hanging.
    let animating = false;
    let swapTimer = 0;
    let navToken = 0;
    // P2 fix, 2026-07-19: the AbortController strips listeners but does not
    // clear timeouts; a pending swap must die with the page session too.
    signal.addEventListener('abort', () => { navToken++; window.clearTimeout(swapTimer); });
    const slideMs = () => (reduceMo.matches ? 0 : 170);
    function snapComplete() {
      // jump-cut: finish any running slide instantly so rapid input stays
      // bounded instead of queueing snapshots or transitions.
      window.clearTimeout(swapTimer);
      lightboxImg.style.transition = 'none';
      lightboxImg.style.transform = '';
      lightboxImg.style.opacity = '';
      void lightboxImg.offsetWidth;
      animating = false;
    }
    function slideTo(dir: number) {
      if (animating) snapComplete();
      updateVisibleItems();
      if (!visibleItems.length) return;
      animating = true;
      const token = ++navToken;
      currentIndex = (currentIndex + dir + visibleItems.length) % visibleItems.length;
      const item = visibleItems[currentIndex] as HTMLElement;
      const swapIn = () => {
        if (token !== navToken) return; // superseded by newer input
        setLightboxImage(item);
        Promise.race([
          lightboxImg.decode().catch(() => {}),
          new Promise((r) => window.setTimeout(r, 400)),
        ]).then(() => {
          if (token !== navToken) return;
          lightboxImg.style.transition = 'none';
          lightboxImg.style.transform = `translateX(${dir * 34}vw)`;
          void lightboxImg.offsetWidth;
          lightboxImg.style.transition = `transform ${slideMs()}ms ease-out, opacity ${slideMs()}ms ease-out`;
          lightboxImg.style.transform = '';
          lightboxImg.style.opacity = '1';
          prefetchNeighbors();
          swapTimer = window.setTimeout(() => { animating = false; lightboxImg.style.transition = ''; }, slideMs() + 30);
        });
      };
      if (slideMs() === 0) { setLightboxImage(item); prefetchNeighbors(); animating = false; return; }
      lightboxImg.style.transition = `transform ${slideMs()}ms ease-in, opacity ${slideMs()}ms ease-in`;
      lightboxImg.style.transform = `translateX(${dir * -34}vw)`;
      lightboxImg.style.opacity = '0';
      swapTimer = window.setTimeout(swapIn, slideMs());
      armIdle();
    }
    const navigate = (dir: number) => slideTo(dir);

    // Intercept gallery link clicks; modified clicks still open in new tab.
    items.forEach((item) => {
      item.addEventListener('click', (e) => {
        const me = e as MouseEvent;
        if (me.ctrlKey || me.metaKey || me.shiftKey || me.button !== 0) return;
        e.preventDefault();
        updateVisibleItems();
        const idx = visibleItems.indexOf(item);
        openLightbox(idx >= 0 ? idx : 0);
      }, { signal });
    });

    closeBtn?.addEventListener('click', closeLightbox, { signal });
    prevBtn?.addEventListener('click', () => navigate(-1), { signal });
    nextBtn?.addEventListener('click', () => navigate(1), { signal });
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); }, { signal });

    // Develop-from-black: dim not-yet-loaded gallery photos, restore on load.
    if (!reduceMo.matches) {
      items.forEach((item) => {
        const im = (item as HTMLElement).querySelector('img');
        if (!im || (im as HTMLImageElement).complete) return;
        im.classList.add('developing');
        im.addEventListener('load', () => im.classList.remove('developing'), { once: true, signal });
      });
    }
    lightbox.addEventListener('mousemove', armIdle, { signal });

    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'Tab') {
        const f = (Array.from(lightbox.querySelectorAll('button')) as HTMLElement[])
          .filter((b) => b.offsetParent !== null && !b.hasAttribute('inert') && b.tabIndex !== -1);
        if (f.length) {
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    }, { signal });

    // -- Finger-tracked swipe: the image follows the touch (direct
    // manipulation), then commits or springs back on release. --
    let startX = 0, startY = 0, startT = 0, dragX = 0;
    let dragMode: 'idle' | 'pending' | 'drag' = 'idle';
    let dragRaf = 0;
    const paintDrag = () => {
      dragRaf = 0;
      if (dragMode !== 'drag') return;
      const fade = Math.max(0.35, 1 - Math.abs(dragX) / (window.innerWidth * 1.2));
      lightboxImg.style.transform = `translateX(${dragX}px)`;
      lightboxImg.style.opacity = String(fade);
    };

    lightbox.addEventListener('touchstart', (e) => {
      armIdle();
      if (!lightbox.classList.contains('active') || e.touches.length > 1) return;
      if (animating) snapComplete();
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = performance.now();
      dragX = 0;
      dragMode = 'pending';
      lightboxImg.style.willChange = 'transform, opacity';
    }, { passive: true, signal });

    lightbox.addEventListener('touchmove', (e) => {
      if (dragMode === 'idle' || e.touches.length > 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (dragMode === 'pending') {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) <= Math.abs(dy)) { dragMode = 'idle'; return; } // vertical intent: not ours
        dragMode = 'drag';
        lightboxImg.style.transition = 'none';
      }
      e.preventDefault(); // scroll lock backstop; container also has touch-action: none
      dragX = dx;
      if (!dragRaf) dragRaf = requestAnimationFrame(paintDrag);
    }, { passive: false, signal });

    lightbox.addEventListener('touchend', (e) => {
      lightboxImg.style.willChange = '';
      if (dragMode !== 'drag') { dragMode = 'idle'; return; }
      dragMode = 'idle';
      const dt = Math.max(1, performance.now() - startT);
      const velocity = Math.abs(dragX) / dt; // px per ms
      const commit = Math.abs(dragX) > 64 || (velocity > 0.45 && Math.abs(dragX) > 24);
      if (commit) {
        const dir = dragX < 0 ? 1 : -1;
        slideTo(dir);
      } else {
        lightboxImg.style.transition = `transform 180ms ease-out, opacity 180ms ease-out`;
        lightboxImg.style.transform = '';
        lightboxImg.style.opacity = '1';
        window.setTimeout(() => { lightboxImg.style.transition = ''; }, 220);
      }
    }, { passive: true, signal });

    lightbox.addEventListener('touchcancel', () => {
      dragMode = 'idle';
      lightboxImg.style.willChange = '';
      lightboxImg.style.transition = 'none';
      lightboxImg.style.transform = '';
      lightboxImg.style.opacity = '1';
    }, { passive: true, signal });
  }

  initGallery();
  document.addEventListener('astro:after-swap', initGallery);
