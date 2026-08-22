addEventListener('load', function () {
  setTimeout(function () {
    if (window.__revealReady) return;
    document.querySelectorAll('.reveal, .stagger-children').forEach(function (el) {
      el.classList.add('visible');
    });
    document.querySelectorAll('.exif-row').forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
  }, 1500);
});
