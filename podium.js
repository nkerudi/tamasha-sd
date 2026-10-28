/* Placings archive enhancements — no external dependencies. */
(function () {
  var panels = document.querySelectorAll('.tab-panel');
  if (!panels.length) return;

  var modal = document.querySelector('.team-modal');
  var modalClose = modal.querySelector('.team-modal-close');
  var modalOpener = null;

  function key(name) {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  var teamLocations = {
    "chicago adaa": "Chicago, IL",
    "dirty south dandiya": "Austin, TX",
    "illini raas": "Urbana-Champaign, IL",
    "msu raasparty": "East Lansing, MI",
    "northeastern nakhraas": "Boston, MA",
    "ru sapa": "New Brunswick, NJ",
    "rutgers sapa": "New Brunswick, NJ",
    "sjsu sahaara": "San Jose, CA",
    "texas mohini": "Austin, TX",
    "texas raas": "Austin, TX",
    "ucb azaad": "Berkeley, CA",
    "ucb zahanat": "Berkeley, CA",
    "ucd lashkara": "Davis, CA",
    "uci zamana": "Irvine, CA",
    "ucla nashaa": "Los Angeles, CA",
    "ucr aag": "Riverside, CA",
    "ucraas": "Riverside, CA",
    "ucsc kahaani": "Santa Cruz, CA",
    "uconn thunderaas": "Storrs, CT",
    "umbc raascals": "Baltimore, MD",
    "unc tar heel raas": "Chapel Hill, NC",
    "usc zeher": "Los Angeles, CA",
    "ut austin nach baliye": "Austin, TX",
    "utd taraas": "Richardson, TX",
    "uva hooraas": "Charlottesville, VA",
    "uw kahaani": "Seattle, WA",
    "washu raas": "St. Louis, MO"
};

  function initials(name) {
    var words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  function openTeamModal(panel, place, name) {
    var counts = { gold: 0, silver: 0, bronze: 0 };
    panel.querySelectorAll('.place').forEach(function (other) {
      if (other.dataset.team !== place.dataset.team) return;
      if (other.classList.contains('gold')) counts.gold += 1;
      else if (other.classList.contains('silver')) counts.silver += 1;
      else if (other.classList.contains('bronze')) counts.bronze += 1;
    });

    modalOpener = place.querySelector('.youtube-link') ? place.querySelector('.team') : place;
    modal.querySelector('.team-modal-mark').textContent = initials(name);
    modal.querySelector('#team-modal-title').textContent = name;
    modal.querySelector('.team-modal-competition').textContent =
      panel.dataset.panel === 'tamasha' ? 'Tamasha · Bollywood-Fusion' : 'Sanedo · Raas-Garba';
    modal.querySelector('[data-first]').textContent = counts.gold;
    modal.querySelector('[data-second]').textContent = counts.silver;
    modal.querySelector('[data-third]').textContent = counts.bronze;
    var total = counts.gold + counts.silver + counts.bronze;
    modal.querySelector('.team-modal-total').textContent =
      total + (total === 1 ? ' podium finish in this competition' : ' podium finishes in this competition');
    var location = modal.querySelector('.team-modal-location');
    if (!location) {
      location = document.createElement('p');
      location.className = 'team-modal-location';
      modal.querySelector('.team-modal-card').appendChild(location);
    }
    location.textContent = teamLocations[key(name)] || '';
    location.hidden = !location.textContent;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalClose.focus();
  }

  function closeTeamModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (modalOpener) modalOpener.focus();
  }

  modalClose.addEventListener('click', closeTeamModal);
  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeTeamModal();
  });
  document.addEventListener('keydown', function (event) {
    if (modal.hidden) return;
    if (event.key === 'Escape') closeTeamModal();
    if (event.key === 'Tab') {
      event.preventDefault();
      modalClose.focus();
    }
  });

  panels.forEach(function (panel) {
    var places = panel.querySelectorAll('.place');

    places.forEach(function (place) {
      var team = place.querySelector('.team');
      var name = team.textContent.trim();
      place.dataset.team = key(name);
      var trigger = place.querySelector('.youtube-link') ? team : place;
      trigger.tabIndex = 0;
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('aria-label', 'Show podium history for ' + name);

      var mark = document.createElement('span');
      mark.className = 'team-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = initials(name);
      place.insertBefore(mark, place.querySelector('.rank'));

      function select() {
        var alreadySelected = place.classList.contains('is-match');
        panel.classList.toggle('has-selection', !alreadySelected);
        places.forEach(function (other) {
          other.classList.toggle('is-match', !alreadySelected && other.dataset.team === place.dataset.team);
        });
        openTeamModal(panel, place, name);
      }
      place.addEventListener('click', function (event) {
        if (event.target.closest('a')) return;
        select();
      });
      trigger.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      });
    });

  });

  document.addEventListener('click', function (event) {
    if (event.target.closest('.place, .team-modal-card')) return;
    panels.forEach(function (panel) {
      panel.classList.remove('has-selection');
      panel.querySelectorAll('.place.is-match').forEach(function (place) {
        place.classList.remove('is-match');
      });
    });
  });

  // ---------------------------------------------------------
  // Spotlight: auto-rotating photo carousel
  // ---------------------------------------------------------
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  panels.forEach(function (panel) {
    var carouselImgs = panel.querySelectorAll('.spotlight-carousel img');
    if (reduceMotion || carouselImgs.length < 2) return;
    var index = 0;
    window.setInterval(function () {
      carouselImgs[index].classList.remove('is-active');
      index = (index + 1) % carouselImgs.length;
      carouselImgs[index].classList.add('is-active');
    }, 4500);
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
