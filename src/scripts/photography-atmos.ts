    let chipLensMark: ((cat: string, fast: boolean) => void) | null = null;
    let chipLensAbort: AbortController | null = null;

    // Chip lens (2026-06-10): the rail's selection complication. One
    // animation in flight, all listeners through an AbortController
    // aborted on re-init, per the interaction hygiene rule.
    function initChipLens() {
      chipLensAbort?.abort();
      chipLensAbort = null;
      chipLensMark = null;
      // A2.1: the lens vessel is retired from the category index (bare-text
      // ruling). The marker keeps working lens-free: hasLens gates every
      // geometry/tint operation so the lit word carries the selection alone.
      const lens = document.getElementById('chip-lens');
      const ul = document.getElementById('cat-list');
      const links = Array.from(document.querySelectorAll('.cat-link')) as HTMLElement[];
      if (!ul || !links.length) return;
      const hasLens = !!lens;
      chipLensAbort = new AbortController();
      const { signal } = chipLensAbort;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Blue retirement, 2026-07-28: the lens no longer paints category hues.
      // One warm candle neutral everywhere; the photograph supplies the color.
      const TINTS: Record<string, string> = {
        sky: '216,196,168',
        earth: '216,196,168',
        water: '216,196,168',
        structure: '216,196,168',
        light: '216,196,168',
      };

      let cur: { x: number; w: number } | null = null;
      let anim: Animation | null = null;
      let activeCat = '';
      let clickLock: { cat: string; until: number } | null = null;

      const measure = (el: HTMLElement) => {
        const ur = ul.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return { x: r.left - ur.left + ul.scrollLeft - 9, w: r.width + 18 };
      };
      const setStatic = (t: { x: number; w: number }) => {
        if (!lens) return;
        lens.style.width = t.w + 'px';
        lens.style.transform = `translate3d(${t.x}px, -50%, 0)`;
      };
      const setTint = (cat: string) => {
        const t = TINTS[cat] || TINTS.sky;
        if (lens) {
          lens.style.setProperty('--cl-glow', `rgba(${t},0.26)`);
          lens.style.setProperty('--cl-core-hot', `rgba(${t},0.50)`);
          lens.style.setProperty('--cl-core-mid', `rgba(${t},0.20)`);
        }
        ul.style.setProperty('--cl-halo', `rgba(${t},0.55)`);
        ul.style.setProperty('--cl-flare-edge', `rgba(${t},0.70)`);
      };
      const spawn = (cls: string, t: { x: number; w: number }, frames: Keyframe[], dur: number) => {
        const s = document.createElement('span');
        s.className = cls;
        if (cls === 'cl-bloom') {
          s.style.left = t.x + t.w / 2 - 24 + 'px';
        } else {
          s.style.left = t.x + 'px';
          s.style.width = t.w + 'px';
        }
        ul.appendChild(s);
        s.animate(frames, { duration: dur, easing: 'cubic-bezier(0.2,0.6,0.3,1)' }).onfinish = () => s.remove();
      };

      function mark(cat: string, fast: boolean) {
        if (clickLock) {
          if (Date.now() > clickLock.until) clickLock = null;
          else if (clickLock.cat !== cat) return;
          else clickLock = null;
        }
        if (cat === activeCat) return;
        activeCat = cat;
        const target = (links.find((l) => l.dataset.cat === cat) as HTMLElement | undefined) || null;
        links.forEach((l) => {
          const on = l === target;
          l.classList.toggle('cat-active', on);
          l.classList.toggle('text-mute', !on);
          if (on) l.setAttribute('aria-current', 'true');
          else l.removeAttribute('aria-current');
        });
        if (!target) return;
        setTint(cat);
        const t = measure(target);
        // Mobile overflow: keep the lit word centred whether or not a lens exists.
        if (ul.scrollWidth > ul.clientWidth) {
          ul.scrollTo({
            left: Math.max(0, t.x - (ul.clientWidth - t.w) / 2),
            behavior: reduce ? 'auto' : 'smooth',
          });
        }
        if (!lens) { cur = null; return; }
        lens.classList.add('is-on');
        if (reduce || !cur) {
          anim?.cancel();
          setStatic(t);
          cur = t;
          return;
        }
        const d = Math.abs(t.x - cur.x);
        if (d < 1) {
          setStatic(t);
          cur = t;
          return;
        }
        const dur = fast ? 460 : 720;
        const st = 1 + Math.min(d / (cur.w * 3 || 220), 0.55);
        anim?.cancel();
        anim = lens.animate(
          [
            { transform: `translate3d(${cur.x}px, -50%, 0) scaleX(1) scaleY(1)`, width: cur.w + 'px', easing: 'cubic-bezier(0.45,0,0.3,1)' },
            { transform: `translate3d(${(cur.x + t.x) / 2}px, -50%, 0) scaleX(${st}) scaleY(0.88)`, width: (cur.w + t.w) / 2 + 'px', offset: 0.5, easing: 'cubic-bezier(0.25,0.1,0.2,1.1)' },
            { transform: `translate3d(${t.x}px, -50%, 0) scaleX(0.98) scaleY(1.05)`, width: t.w + 'px', offset: 0.84, easing: 'ease-out' },
            { transform: `translate3d(${t.x}px, -50%, 0) scaleX(1) scaleY(1)`, width: t.w + 'px' },
          ],
          { duration: dur, fill: 'forwards' }
        );
        cur = t;
        if (fast) {
          spawn('cl-bloom', t, [
            { transform: 'translateY(-50%) scale(0.3)', opacity: 0.6 },
            { transform: 'translateY(-50%) scale(1.8)', opacity: 0 },
          ], 680);
          spawn('cl-flare', t, [
            { transform: 'translateY(-50%) scale(1, 1)', opacity: 0.8 },
            { transform: 'translateY(-50%) scale(1.4, 1.15)', opacity: 0 },
          ], 560);
        }
      }

      chipLensMark = mark;
      // Click = intent: travel now, then suppress the intermediate
      // categories the observer reports while Lenis glides past them.
      links.forEach((l) => {
        l.addEventListener('click', () => {
          const cat = l.dataset.cat || '';
          clickLock = null;
          mark(cat, true);
          clickLock = { cat, until: Date.now() + 1600 };
        }, { signal });
      });
      window.addEventListener('resize', () => {
        if (!hasLens) return;
        const el = links.find((l) => l.dataset.cat === activeCat);
        if (!el) return;
        anim?.cancel();
        const t = measure(el);
        setStatic(t);
        cur = t;
      }, { signal });
      document.fonts?.ready?.then(() => {
        if (!hasLens || signal.aborted || !activeCat) return;
        const el = links.find((l) => l.dataset.cat === activeCat);
        if (!el) return;
        anim?.cancel();
        const t = measure(el);
        setStatic(t);
        cur = t;
      });
      const initial = location.hash.match(/^#gallery-(\w+)/)?.[1] || links[0].dataset.cat || '';
      if (initial) mark(initial, false);
    }

    // P2 fix, 2026-07-19: the observer was recreated per visit and never
    // disconnected, each one pinning the previous visit's detached gallery
    // subtree. Module-level handle, disconnected on re-init (chipLens pattern).
    let atmosObserver = null;
    function initAtmosphere() {
      atmosObserver?.disconnect();
      const overlay = document.getElementById('atmos-overlay');
      if (!overlay) return;

      const colors = {
        sky:        'rgba(216, 196, 168, 0.02)',
        earth:      'rgba(216, 196, 168, 0.02)',
        water:      'rgba(216, 196, 168, 0.02)',
        structure:  'rgba(216, 196, 168, 0.02)',
        light:      'rgba(244, 234, 222, 0.018)',
      };

      const sections = document.querySelectorAll('.gallery-section[data-category]');
      if (!sections.length) return;

      const catLinks = document.querySelectorAll('.cat-link');
      let currentCat = '';

      const observer = (atmosObserver = new IntersectionObserver((entries) => {
        let topmost = null;
        let topY = Infinity;

        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const rect = entry.boundingClientRect;
            if (rect.top < topY) {
              topY = rect.top;
              topmost = entry.target;
            }
          }
        });

        if (topmost) {
          const cat = topmost.getAttribute('data-category');
          if (cat && cat !== currentCat) {
            currentCat = cat;
            overlay.style.backgroundColor = colors[cat] || 'transparent';
            // Reflect scroll position in the contents row: the lens
            // glides to the category under the viewport (calm travel).
            if (chipLensMark) {
              chipLensMark(cat, false);
            } else {
              catLinks.forEach((l) => {
                const on = (l as HTMLElement).dataset.cat === cat;
                l.classList.toggle('text-cream', on);
                l.classList.toggle('text-mute', !on);
                if (on) l.setAttribute('aria-current', 'true');
                else l.removeAttribute('aria-current');
              });
            }
          }
        }
      }, {
        threshold: 0.15,
        rootMargin: '-10% 0px -60% 0px'
      }));

      sections.forEach(s => observer.observe(s));
    }

    function initCatScroll() {
      document.querySelectorAll('.cat-link').forEach((a) => {
        const el = a as HTMLElement;
        if (el.dataset.lenisBound) return;
        el.dataset.lenisBound = '1';
        a.addEventListener('click', (e) => {
          const href = a.getAttribute('href') || '';
          if (!href.startsWith('#')) return;
          const target = document.querySelector(href);
          const lenis = (window as any).__lenis;
          if (target && lenis) { e.preventDefault(); lenis.scrollTo(target, { offset: -100 }); }
        });
      });
    }

    initChipLens();
    initAtmosphere();
    initCatScroll();
    document.addEventListener('astro:after-swap', () => { initChipLens(); initAtmosphere(); initCatScroll(); });
