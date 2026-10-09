/* main.js - mobile nav, gentle scroll reveals and the live "Hoy" card.
   No dependencies. */
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  var items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  if (!('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (var i = 0; i < items.length; i++) items[i].classList.add('in');
    return;
  }
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  items.forEach(function (el) { obs.observe(el); });
})();

/* On phones, fold the secondary schedule cards to their headings. */
(function () {
  if (!window.matchMedia || !window.matchMedia('(max-width: 900px)').matches) return;
  var d = document.querySelectorAll('details.sched');
  for (var i = 0; i < d.length; i++) d[i].removeAttribute('open');
})();

/* ---------------------------------------------------------------- Hoy card
   Shows today's Masses in El Salvador time, dims the ones already past,
   highlights the next one, marks the Masses with confessions, and says whether
   the parish office is open right now.

   One source of truth: the Mass times are read from the visible weekly list in
   #horarios (the .t text of each li[data-days]). Change a time there and this
   card follows. Confessions and office hours are read from data- attributes
   sitting on the very lists that state them in words; keep those in step when
   the words change.

   Test any moment with ?hoy=D-HH:MM, D = 0 Sunday ... 6 Saturday,
   for example ?hoy=4-17:30 is a Thursday at 5:30 p.m. */
(function () {
  var card = document.getElementById('hoy');
  var week = document.querySelectorAll('#horarios .mass li[data-days]');
  if (!card || !week.length) return;
  var EN = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
  var end = function (t) { return /\.$/.test(t) ? t : t + '.'; };
  var T = EN ? {
    label: 'Today at the parish',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    mass: 'Mass', confess: 'Mass and confession', next: 'Next Mass', nextC: 'Next Mass, with confession',
    none: 'No more Masses today.', tomorrow: function (d, t) { return 'Tomorrow, ' + d + ', the first Mass is at ' + end(t); },
    allC: 'Confession during every Mass today.',
    open: 'Parish office: open now', closed: 'Parish office: closed now'
  } : {
    label: 'Hoy en la parroquia',
    days: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    mass: 'Misa', confess: 'Misa y confesiones', next: 'Próxima misa', nextC: 'Próxima misa, con confesiones',
    none: 'Ya no hay más misas hoy.', tomorrow: function (d, t) { return 'Mañana, ' + d.toLowerCase() + ', la primera misa es a las ' + end(t); },
    allC: 'Hoy hay confesiones durante todas las misas.',
    open: 'Oficina parroquial: abierta ahora', closed: 'Oficina parroquial: cerrada ahora'
  };

  /* now, in El Salvador */
  var day, mins;
  var sim = /[?&]hoy=(\d)-(\d{1,2}):(\d{2})/.exec(location.search);
  if (sim) {
    day = +sim[1]; mins = (+sim[2]) * 60 + (+sim[3]);
  } else {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/El_Salvador', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
      }).formatToParts(new Date());
      var get = function (t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ''; };
      day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
      mins = (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10);
    } catch (e) { return; }   /* no Intl: the static card stays as it is */
  }
  if (day < 0 || isNaN(mins)) return;

  var hm = function (s) { var p = s.split(':'); return (+p[0]) * 60 + (+p[1]); };
  var TIME = /(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.|noon|m\.)/gi;
  function massesOn(d) {
    var best = null;
    for (var i = 0; i < week.length; i++) {
      var ds = week[i].getAttribute('data-days').split(' ');
      if (ds.indexOf(String(d)) < 0) continue;
      if (!best || ds.length < best.n) best = { li: week[i], n: ds.length };   /* most specific row wins: Thursday beats Monday to Friday */
    }
    if (!best) return [];
    var txt = (best.li.querySelector('.t') || best.li).textContent, out = [], m;
    TIME.lastIndex = 0;
    while ((m = TIME.exec(txt))) {
      var h = +m[1], mer = m[3].toLowerCase();
      if (mer === 'p.m.' && h < 12) h += 12;
      if (mer === 'a.m.' && h === 12) h = 0;
      if (mer === 'm.' || mer === 'noon') h = 12;
      out.push({ at: h * 60 + (+m[2]), label: m[0].replace(/\s+/g, ' ') });
    }
    return out.sort(function (a, b) { return a.at - b.at; });
  }
  function rule(attr) {   /* "1 2 3@08:00-12:00,14:00-17:30;6@08:00-12:00" */
    var el = document.querySelector('#horarios [' + attr + ']'), map = {};
    if (!el) return map;
    el.getAttribute(attr).split(';').forEach(function (chunk) {
      var bits = chunk.split('@'); if (bits.length < 2) return;
      bits[0].trim().split(' ').forEach(function (d) { map[d] = bits[1].split(','); });
    });
    return map;
  }
  var confess = rule('data-confess'), office = rule('data-office');
  var confToday = confess[String(day)] || [];
  var withConf = function (at) {
    for (var i = 0; i < confToday.length; i++) if (confToday[i] === '*' || hm(confToday[i]) === at) return true;
    return false;
  };

  var today = massesOn(day), next = -1;
  for (var i = 0; i < today.length; i++) if (today[i].at > mins) { next = i; break; }

  var list = card.querySelector('.today__list'), html = '';
  /* when every Mass of the day has confessions (Sundays), say it once in a
     note instead of repeating it on every line */
  var all = today.length > 0 && today.every(function (ms) { return withConf(ms.at); });
  today.forEach(function (ms, i) {
    var c = !all && withConf(ms.at);
    var cls = i === next ? 'is-next' : (ms.at <= mins ? 'is-past' : '');
    var tag = i === next ? (c ? T.nextC : T.next) : (c ? T.confess : T.mass);
    html += '<li class="' + cls + '"><b>' + ms.label + '</b><span class="tag">' + tag + '</span></li>';
  });
  list.innerHTML = html;
  list.hidden = !today.length;

  var note = card.querySelector('.today__note'), msg = [];
  if (all) msg.push(T.allC);
  if (next < 0) {
    var tm = massesOn((day + 1) % 7);
    msg.push(T.none + (tm.length ? ' ' + T.tomorrow(T.days[(day + 1) % 7], tm[0].label) : ''));
  }
  note.textContent = msg.join(' ');
  note.hidden = !msg.length;

  var open = false;
  (office[String(day)] || []).forEach(function (span) {
    var p = span.split('-'); if (p.length === 2 && mins >= hm(p[0]) && mins < hm(p[1])) open = true;
  });
  var of = card.querySelector('.today__office');
  if (of) {
    of.querySelector('span:last-child').textContent = open ? T.open : T.closed;
    of.classList.toggle('is-open', open);
    of.hidden = false;
  }
  card.querySelector('.today__label span').textContent = T.label;
  card.querySelector('.today__day').textContent = T.days[day];
  card.classList.add('is-live');
})();
