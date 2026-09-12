// Tamasha SD — landing page competition showcase.
// Auto-rotates each showcase section's photo stack.

(function () {
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ROTATE_MS = 4500;

  document.querySelectorAll('.showcase-panel').forEach(function (panel) {
    var imgs = panel.querySelectorAll('.showcase-rotator img');
    if (reduceMotion || imgs.length < 2) return;

    window.setInterval(function () {
      var current = -1;
      for (var i = 0; i < imgs.length; i++) {
        if (imgs[i].classList.contains('is-active')) current = i;
        imgs[i].classList.remove('is-active');
      }
      imgs[(current + 1) % imgs.length].classList.add('is-active');
    }, ROTATE_MS);
  });
})();
