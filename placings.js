/* Placings archive enhancements — no external dependencies. */
(function () {
  var panels = document.querySelectorAll('.tab-panel');
  if (!panels.length) return;

  function key(name) {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function initials(name) {
    var words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  panels.forEach(function (panel) {
    var blocks = panel.querySelectorAll('.year-block');
    var places = panel.querySelectorAll('.place');
    var wins = {};

    places.forEach(function (place) {
      var team = place.querySelector('.team');
      var name = team.textContent.trim();
      place.dataset.team = key(name);
      place.tabIndex = 0;
      place.setAttribute('role', 'button');
      place.setAttribute('aria-label', 'Highlight all podium finishes for ' + name);

      var mark = document.createElement('span');
      mark.className = 'team-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = initials(name);
      place.insertBefore(mark, place.querySelector('.rank'));

      if (place.classList.contains('gold')) {
        wins[name] = (wins[name] || 0) + 1;
      }

      function select() {
        var alreadySelected = place.classList.contains('is-match');
        panel.classList.toggle('has-selection', !alreadySelected);
        places.forEach(function (other) {
          other.classList.toggle('is-match', !alreadySelected && other.dataset.team === place.dataset.team);
        });
      }
      place.addEventListener('click', select);
      place.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      });
    });

    var repeat = Object.keys(wins).sort(function (a, b) { return wins[b] - wins[a]; })[0];
    var summary = document.createElement('div');
    summary.className = 'archive-summary';
    summary.innerHTML =
      '<div class="archive-stat"><strong>' + blocks.length + '</strong><span>Seasons recorded</span></div>' +
      '<div class="archive-stat"><strong>' + places.length + '</strong><span>Podium finishes</span></div>' +
      '<div class="archive-stat"><strong>' + repeat + '</strong><span>Most championships · ' + wins[repeat] + '</span></div>';
    panel.insertBefore(summary, panel.querySelector('.year-block'));
  });

  document.querySelectorAll('.tab[data-tab]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      panels.forEach(function (panel) {
        panel.classList.remove('has-selection');
        panel.querySelectorAll('.place.is-match').forEach(function (place) {
          place.classList.remove('is-match');
        });
      });
    });
  });

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-archive');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.year-block').forEach(function (block) { observer.observe(block); });
  }
})();
