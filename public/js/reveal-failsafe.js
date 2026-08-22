addEventListener('load', function () {
  setTimeout(function () {
    if (window.__revealReady) return;
    document.querySelectorAll('.reveal, .stagger-children').forEach(function (el) {
      el.classList.add('visible');
    });
  }, 1500);
});
