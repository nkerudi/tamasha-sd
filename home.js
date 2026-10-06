// Play the homepage title's typing effect once, then leave it fully visible.
(function () {
  var main = document.querySelector('[data-typewriter-main]');
  var accent = document.querySelector('[data-typewriter-accent]');
  var cursor = document.querySelector('.typewriter-cursor');
  if (!main || !accent || !cursor) return;

  var mainText = 'Tamasha ';
  var accentText = 'SD';
  var fullText = mainText + accentText;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function finish() {
    main.textContent = mainText;
    accent.textContent = accentText;
    cursor.classList.add('is-finished');
  }

  if (reducedMotion) {
    finish();
    return;
  }

  main.textContent = '';
  accent.textContent = '';

  var character = 0;
  var timer = window.setInterval(function () {
    character += 1;
    main.textContent = fullText.slice(0, Math.min(character, mainText.length));
    accent.textContent = fullText.slice(mainText.length, character);

    if (character >= fullText.length) {
      window.clearInterval(timer);
      window.setTimeout(function () {
        cursor.classList.add('is-finished');
      }, 650);
    }
  }, 140);
})();
