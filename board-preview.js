/* ============================================================
   Tamasha SD — landing-page board strip
   Renders the current season's directors into
   <div class="board-strip" data-board-preview></div>
   and links through to board.html. Reads the same board-data.js.
   ============================================================ */
(function () {
  var host = document.querySelector('[data-board-preview]');
  var seasons = window.TAMASHA_BOARD || [];
  if (!host || !seasons.length) return;

  var LIMIT = 6;
  var season = seasons[0];

  // Directors only. Head liaisons and the other chairs are not directors,
  // so this deliberately does NOT pad the row out to LIMIT — a short row is
  // correct, and the grid centres itself around however many there are.
  var people = season.members.filter(function (m) {
    return /^(director|executive-advisor|vp-)/.test(m.roleSlug);
  }).slice(0, LIMIT);

  if (!people.length) return;
  host.style.setProperty('--cols', people.length);

  people.forEach(function (m) {
    var a = document.createElement('a');
    a.className = 'member';
    a.href = 'board.html';

    var frame = document.createElement('span');
    frame.className = 'member-frame';

    var img = new Image();
    img.src = m.card;
    img.alt = m.name + ' \u2014 ' + m.role;
    img.width = 640;
    img.height = 854;
    img.loading = 'lazy';
    img.decoding = 'async';
    frame.appendChild(img);

    var name = document.createElement('span');
    name.className = 'member-name';
    name.textContent = m.name;

    var role = document.createElement('span');
    role.className = 'member-role';
    role.textContent = m.role;

    a.appendChild(frame);
    a.appendChild(name);
    a.appendChild(role);
    host.appendChild(a);
  });
})();
