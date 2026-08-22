try {
  if (localStorage.getItem('jw-theme') === 'black') {
    document.documentElement.setAttribute('data-theme', 'black');
  }
} catch (e) {}
