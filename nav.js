// Mobile nav toggle — no external dependencies
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // Close the menu when a link is tapped (mobile)
  links.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') links.classList.remove('open');
  });
})();

// Tabbed panels (e.g. Placings: Tamasha / Sanedo)
(function () {
  var tabs = document.querySelectorAll('.tab');
  if (!tabs.length) return;

  function activate(target) {
    var matched = false;
    document.querySelectorAll('.tab').forEach(function (t) {
      var on = t.getAttribute('data-tab') === target;
      if (on) matched = true;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (!matched) return;
    document.querySelectorAll('.tab-panel').forEach(function (p) {
      p.hidden = p.getAttribute('data-panel') !== target;
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activate(tab.getAttribute('data-tab'));
    });
  });

  // Deep-link support: e.g. placings.html#sanedo opens straight to that tab
  // (used by the "View Placings and History" links on the homepage).
  var hashTarget = location.hash.replace('#', '');
  if (hashTarget) activate(hashTarget);
})();
