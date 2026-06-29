(function () {
  'use strict';

  /* ─── STATE ─── */
  let appData = null;
  let session = null;
  let alertInterval = null;

  const $ = function (id) { return document.getElementById(id); };

  /* ─── DAY MAPPING ─── */
  const DAY_CODES = ['J18', 'V19', 'S20', 'D21'];
  const DAY_NAMES = ['jeudi', 'vendredi', 'samedi', 'dimanche'];

  function codeForDay(dayName) {
    for (var i = 0; i < DAY_NAMES.length; i++) {
      if (DAY_NAMES[i] === dayName) return DAY_CODES[i];
    }
    return 'J18';
  }
  function dayNameForCode(code) {
    for (var i = 0; i < DAY_CODES.length; i++) {
      if (DAY_CODES[i] === code) return DAY_NAMES[i];
    }
    return 'jeudi';
  }

  /* ─── INIT ─── */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    loadData();
    checkSession();
    window.addEventListener('online', function () { loadData(); });
  }

  /* ─── DATA LOADING ─── */
  function loadData() {
    var cached = localStorage.getItem('hellfest_data');

    function initApp(data) {
      appData = data;
      hideLoader();
      if (session) renderView();
    }

    function loadFromCache() {
      if (cached) {
        initApp(JSON.parse(cached));
        showOfflineBanner(true);
      } else {
        hideLoader();
        showView('view-offline');
      }
    }

    function loadFromEmbedded() {
      if (typeof HELLFEST_DATA !== 'undefined') {
        initApp(HELLFEST_DATA);
        localStorage.setItem('hellfest_data', JSON.stringify(HELLFEST_DATA));
        return true;
      }
      return false;
    }

    if (navigator.onLine) {
      fetch('data.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          localStorage.setItem('hellfest_data', JSON.stringify(data));
          initApp(data);
        })
        .catch(function () {
          if (!loadFromEmbedded()) loadFromCache();
        });
    } else {
      if (!loadFromEmbedded()) loadFromCache();
    }
  }

  function showOfflineBanner(show) {
    var el = $('offline-banner');
    if (el) el.classList.toggle('visible', show);
  }

  function hideLoader() {
    var el = $('loader');
    if (el) el.classList.add('loader--done');
  }

  /* ─── SESSION ─── */
  function checkSession() {
    var stored = localStorage.getItem('session');
    if (stored) {
      session = JSON.parse(stored);
      if (appData) renderView();
    } else {
      showView('view-login');
    }
  }

  /* ─── NAVIGATION ─── */
  var _currentView = null;

  function showView(viewId) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    var view = $(viewId);
    if (view) view.classList.add('active');
    var sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.style.display = (viewId === 'view-login' || viewId === 'view-offline') ? 'none' : '';
    }
    _currentView = viewId;
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(view, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
      if (viewId === 'view-login') {
        gsap.fromTo('.login__logo', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', delay: 0.05 });
        gsap.fromTo('.form-group, .btn-primary, .error-msg', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3, stagger: { each: 0.06 }, ease: 'power2.out', delay: 0.15 });
      }
    }
  }

  function animateIn(container, selector, opts) {
    if (typeof gsap === 'undefined') return;
    var els = container.querySelectorAll(selector);
    if (els.length === 0) return;
    gsap.fromTo(els, { opacity: 0, y: 16, scale: 0.98 }, {
      opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power2.out',
      stagger: { from: 'start', each: 0.04 },
      ...opts
    });
  }

  /* ─── HELPERS ─── */
  function getPlateformes() {
    if (!appData) return [];
    var seen = {};
    var list = [];
    for (var i = 0; i < appData.benevoles.length; i++) {
      var pf = appData.benevoles[i].plateforme;
      if (!seen[pf]) { seen[pf] = true; list.push(pf); }
    }
    return list;
  }

  function findBenevoleByNom(nom) {
    if (!appData) return null;
    for (var i = 0; i < appData.benevoles.length; i++) {
      if (appData.benevoles[i].nom === nom) return appData.benevoles[i];
    }
    return null;
  }

  function parseShiftTime(shiftStr) {
    var m = shiftStr.match(/(\d{2}):(\d{2})→(\d{2}):(\d{2})/);
    if (m) return { debut: m[1] + ':' + m[2], fin: m[3] + ':' + m[4] };
    return null;
  }

  /* ─── AUTH ─── */
  $('login-btn').addEventListener('click', handleLogin);

  $('login-phone').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') handleLogin();
  });
  $('login-role').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') handleLogin();
  });

  function normalizePhone(phone) {
    return phone.replace(/[\s\-\_]/g, '');
  }

  function handleLogin() {
    var phone = normalizePhone($('login-phone').value.trim());
    var role = $('login-role').value;
    var errorEl = $('login-error');
    errorEl.textContent = '';

    if (!phone || phone.length !== 10) {
      errorEl.textContent = 'Numéro invalide (10 chiffres requis)';
      return;
    }
    if (!appData) {
      errorEl.textContent = 'Données non chargées';
      return;
    }

    var volunteer = null;

    if (role === 'B') {
      for (var i = 0; i < appData.benevoles.length; i++) {
        var bPhone = normalizePhone(appData.benevoles[i].telephone || '');
        if (bPhone === phone) {
          volunteer = appData.benevoles[i];
          break;
        }
      }
    } else if (role === 'CE') {
      for (var j = 0; j < appData.chefs_equipe.length; j++) {
        var cePhone = normalizePhone(appData.chefs_equipe[j].telephone || '');
        if (cePhone === phone) {
          var ce = appData.chefs_equipe[j];
          volunteer = { id: 'CE', nom: ce.nom, prenom: ce.nom, telephone: ce.telephone, role: 'CE', plateforme: ce.poste, genre: '' };
          break;
        }
      }
    } else if (role === 'R') {
      var rPhone = normalizePhone((appData.responsable && appData.responsable.telephone) || '');
      if (rPhone === phone) {
        var r = appData.responsable;
        volunteer = { id: 'R', nom: r.nom, prenom: r.nom, telephone: r.telephone, role: 'R', plateforme: '', genre: '' };
      }
    } else if (role === 'A') {
      var aPhone = normalizePhone((appData.admin && appData.admin.telephone) || '');
      if (aPhone === phone) {
        volunteer = { id: 'A', nom: 'Admin', prenom: 'Admin', telephone: phone, role: 'A', plateforme: '', genre: '' };
      }
    }

    if (!volunteer) {
      errorEl.textContent = 'Aucun compte trouvé avec ces informations';
      return;
    }

    var nameParts = volunteer.nom ? volunteer.nom.split(' ') : [volunteer.prenom || '', volunteer.nomFamille || ''];
    session = {
      id: volunteer.id || volunteer.nom,
      role: volunteer.role || 'B',
      nom: volunteer.prenom || nameParts[0] || volunteer.nom,
      nomFamille: volunteer.nomFamille || nameParts.slice(1).join(' ') || '',
      plateforme: volunteer.plateforme || ''
    };
    localStorage.setItem('session', JSON.stringify(session));
    renderView();
  }

  /* ─── LOGOUT ─── */
  $('logout-btn-b').addEventListener('click', logout);
  $('logout-btn-r').addEventListener('click', logout);
  $('logout-btn-a').addEventListener('click', logout);

  function logout() {
    localStorage.removeItem('session');
    session = null;
    if (alertInterval) { clearInterval(alertInterval); alertInterval = null; }
    $('login-phone').value = '';
    $('login-error').textContent = '';
    showView('view-login');
  }

  /* ─── RENDER DISPATCH ─── */
  function renderView() {
    if (!session || !appData) return;

    if (session.role === 'A' || session.role === 'R') {
      openAdmin();
      return;
    }

    if (session.role === 'B') {
      renderBenevoleView();
      showView('view-benevole');
    } else {
      renderResponsableView();
      showView('view-responsable');
    }
    updateContacts();
    updateSidebar();
  }

  /* ─── SIDEBAR ─── */
  function updateSidebar() {
    if (!session) return;
    var nameEl = $('sidebar-username');
    var roleEl = $('sidebar-userrole');
    var adminBtn = $('sidebar-admin');
    if (nameEl) nameEl.textContent = session.nom;
    if (roleEl) {
      roleEl.textContent = session.role === 'B' ? 'Bénévole'
        : session.role === 'R' ? 'Responsable'
        : session.role === 'CE' ? "Chef d'équipe"
        : 'Admin';
    }
    if (adminBtn) {
      adminBtn.style.display = (session.role === 'R' || session.role === 'CE' || session.role === 'A') ? '' : 'none';
    }
  }

  /* ─── CONTACTS ─── */
  function updateContacts() {
    if (!appData) return;
    var ce = null;
    for (var i = 0; i < appData.chefs_equipe.length; i++) {
      if (appData.chefs_equipe[i].poste.toLowerCase().indexOf('stage') !== -1) { ce = appData.chefs_equipe[i]; break; }
    }
    var r = appData.responsable;

    if (ce) {
      var nameCe = document.getElementById('contact-ce-name');
      var phoneCe = document.getElementById('contact-ce-phone');
      if (nameCe) nameCe.textContent = ce.nom;
      if (phoneCe) { phoneCe.textContent = ce.telephone; phoneCe.href = 'tel:' + ce.telephone; }
      var sbCeName = document.getElementById('sidebar-ce-name');
      var sbCePhone = document.getElementById('sidebar-ce-phone');
      if (sbCeName) sbCeName.textContent = ce.nom;
      if (sbCePhone) { sbCePhone.textContent = ce.telephone; sbCePhone.href = 'tel:' + ce.telephone; }
    }
    if (r) {
      var nameR = document.getElementById('contact-r-name');
      var phoneR = document.getElementById('contact-r-phone');
      if (nameR) nameR.textContent = r.nom;
      if (phoneR) { phoneR.textContent = r.telephone; phoneR.href = 'tel:' + r.telephone; }
      var sbRName = document.getElementById('sidebar-r-name');
      var sbRPhone = document.getElementById('sidebar-r-phone');
      if (sbRName) sbRName.textContent = r.nom;
      if (sbRPhone) { sbRPhone.textContent = r.telephone; sbRPhone.href = 'tel:' + r.telephone; }
    }
  }

  /* ─── VIEW: BÉNÉVOLE ─── */
  function renderBenevoleView() {
    if (!session || !appData) return;

    $('benevole-name').textContent = session.nom;

    var volunteer = null;
    for (var i = 0; i < appData.benevoles.length; i++) {
      if (appData.benevoles[i].nom === session.id || appData.benevoles[i].nom === session.nom + ' ' + session.nomFamille) {
        volunteer = appData.benevoles[i];
        break;
      }
    }
    if (!volunteer && appData.benevoles.length > 0) {
      // fallback: match by plateforme
      for (var fi = 0; fi < appData.benevoles.length; fi++) {
        if (appData.benevoles[fi].plateforme === session.plateforme) {
          volunteer = appData.benevoles[fi];
          break;
        }
      }
    }

    var container = $('benevole-shifts');
    var html = '';

    for (var d = 0; d < DAY_CODES.length; d++) {
      var code = DAY_CODES[d];
      var dayName = appData.dates && appData.dates[code] ? appData.dates[code].replace(/ \d{4}$/, '') : DAY_NAMES[d];
      var shiftStr = volunteer ? (volunteer.shifts && volunteer.shifts[code]) || '—' : '—';
      var hours = volunteer ? (volunteer.heures && volunteer.heures[code]) || 0 : 0;
      var timeInfo = '';
      var parsed = parseShiftTime(shiftStr);
      if (parsed) {
        timeInfo = parsed.debut + ' - ' + parsed.fin;
      } else if (shiftStr !== '—' && shiftStr !== 'Non dispo' && shiftStr !== 'Repos' && shiftStr !== 'Réserve') {
        timeInfo = shiftStr;
      }

      var cls = 'card';
      if (shiftStr === 'Repos' || shiftStr === 'Réserve' || shiftStr === '—') cls += ' card--muted';
      if (shiftStr === 'Non dispo') cls += ' card--muted';

      html += '<div class="' + cls + '"><div class="shift-item">' +
        '<div class="shift-item__day">' + dayName + '</div>' +
        '<div class="shift-item__shift">' + shiftStr + '</div>' +
        (timeInfo ? '<div class="shift-item__time">' + timeInfo + '</div>' : '') +
        '<div class="shift-item__hours">' + hours + 'h</div>' +
        '</div></div>';
    }

    if (volunteer && volunteer.heures && volunteer.heures.total) {
      html += '<div class="card card--total"><div class="shift-item">' +
        '<div class="shift-item__day" style="font-weight:700">Total</div>' +
        '<div class="shift-item__hours" style="font-weight:700">' + volunteer.heures.total + 'h</div>' +
        '</div></div>';
    }

    container.innerHTML = html;
    animateIn(container, '.card');

    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.header--centered', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
      gsap.fromTo('.section-title', { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.25, stagger: { each: 0.06 }, ease: 'power2.out', delay: 0.08 });
    }
  }

  /* ─── MAP ─── */
  function openMap() {
    var lb = $('lightbox');
    if (lb) lb.style.display = 'flex';
  }
  function closeMap() {
    var lb = $('lightbox');
    if (lb) lb.style.display = 'none';
  }
  $('map-btn').addEventListener('click', openMap);
  $('map-btn-r').addEventListener('click', openMap);
  $('lightbox-close').addEventListener('click', closeMap);
  $('lightbox-backdrop').addEventListener('click', closeMap);

  /* ─── ADMIN ─── */
  $('admin-btn').addEventListener('click', openAdmin);

  /* ─── SIDEBAR ─── */
  var sbCalendar = $('sidebar-calendar');
  var sbPlan = $('sidebar-plan');
  var sbAdmin = $('sidebar-admin');
  var sbLogout = $('sidebar-logout');
  if (sbCalendar) sbCalendar.addEventListener('click', openCalendar);
  if (sbPlan) sbPlan.addEventListener('click', openMap);
  if (sbAdmin) sbAdmin.addEventListener('click', openAdmin);
  if (sbLogout) sbLogout.addEventListener('click', logout);

  var _adminSearch = '';
  var _adminPf = 'all';
  var _adminSearchSetup = false;

  /* ─── CALENDAR ─── */
  $('calendar-btn-b').addEventListener('click', openCalendar);
  $('calendar-btn-r').addEventListener('click', openCalendar);
  $('calendar-back').addEventListener('click', function () {
    if (!session) return;
    if (_calViewingVolunteerId) {
      _calViewingVolunteerId = null;
      var titleEl = document.querySelector('#view-calendar .header__title');
      if (titleEl) titleEl.textContent = 'Calendrier';
      openAdmin();
      return;
    }
    if (session.role === 'B') showView('view-benevole');
    else showView('view-responsable');
  });
  $('cal-pdf-btn').addEventListener('click', function () {
    var subtitle = $('cal-print-subtitle');
    if (session) {
      subtitle.textContent = session.role === 'B'
        ? session.nom + ' — Stage PMR / PSH'
        : (session.role === 'R' ? 'Responsable' : 'CE ' + session.nom) + ' — Stage PMR / PSH';
    }
    window.print();
  });
  var pdfBtnB = $('pdf-btn-b');
  if (pdfBtnB) pdfBtnB.addEventListener('click', function () { window.print(); });
  var pdfBtnA = $('pdf-btn-a');
  if (pdfBtnA) pdfBtnA.addEventListener('click', function () { window.print(); });

  var _calMode = '4days';
  var _calDay = 'jeudi';
  var _calViewingVolunteerId = null;

  document.addEventListener('click', function (e) {
    var modeBtn = e.target.closest('.cal-mode__btn');
    if (modeBtn) {
      document.querySelectorAll('.cal-mode__btn').forEach(function (b) { b.classList.remove('cal-mode__btn--active'); });
      modeBtn.classList.add('cal-mode__btn--active');
      _calMode = modeBtn.getAttribute('data-mode');
      renderCalendar();
      return;
    }
    var dayBtn = e.target.closest('.cal-nav__btn');
    if (dayBtn) {
      document.querySelectorAll('.cal-nav__btn').forEach(function (b) { b.classList.remove('cal-nav__btn--active'); });
      dayBtn.classList.add('cal-nav__btn--active');
      _calDay = dayBtn.getAttribute('data-day');
      renderCalendar();
    }
  });

  function openCalendar() {
    _calMode = '4days';
    _calDay = 'jeudi';
    document.querySelectorAll('.cal-mode__btn').forEach(function (b) {
      b.classList.toggle('cal-mode__btn--active', b.getAttribute('data-mode') === _calMode);
    });
    renderCalendar();
    showView('view-calendar');
  }

  function renderCalendar() {
    if (!session || !appData) return;
    if (_calMode === '4days') renderCalGrid();
    else renderCalDay();
    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.cal-grid__cell--has', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.25, stagger: { each: 0.015, from: 'start' }, ease: 'power2.out', delay: 0.1 });
    }
  }

  function getCalShiftsForDay(dayCode) {
    if (!appData || !appData.planning || !appData.planning[dayCode]) return [];
    var slots = appData.planning[dayCode];
    var filtered = [];

    // If viewing a specific volunteer, filter by that person
    if (_calViewingVolunteerId) {
      for (var s = 0; s < slots.length; s++) {
        var slot = slots[s];
        var match = false;
        for (var b = 0; b < slot.benevoles.length; b++) {
          if (slot.benevoles[b] === _calViewingVolunteerId) { match = true; break; }
        }
        if (match) filtered.push(slot);
      }
      return filtered;
    }

    // If session is B role, filter by their plateforme
    if (session.role === 'B') {
      for (var si = 0; si < slots.length; si++) {
        if (slots[si].plateforme === session.plateforme) {
          filtered.push(slots[si]);
        }
      }
      return filtered;
    }

    // If CE, filter by their poste/plateforme
    if (session.role === 'CE') {
      for (var sj = 0; sj < slots.length; sj++) {
        if (slots[sj].plateforme === session.plateforme) {
          filtered.push(slots[sj]);
        }
      }
      return filtered;
    }

    // R or A: show all
    return slots;
  }

  function renderCalDay() {
    var container = $('calendar-content');
    var dayCode = codeForDay(_calDay);
    var slots = getCalShiftsForDay(dayCode);

    var dayNavHtml = '<div class="cal-nav">';
    for (var d = 0; d < DAY_NAMES.length; d++) {
      var active = DAY_NAMES[d] === _calDay ? ' cal-nav__btn--active' : '';
      dayNavHtml += '<button class="cal-nav__btn' + active + '" data-day="' + DAY_NAMES[d] + '">' + DAY_NAMES[d].substring(0, 3) + '</button>';
    }
    dayNavHtml += '</div>';

    if (!slots || slots.length === 0) {
      container.innerHTML = dayNavHtml + '<div class="cal-empty">Aucun shift ce jour</div>';
      return;
    }

    var pfs = getPlateformes();
    var html = dayNavHtml + '<div class="cal-day-grid">';

    // Header row
    html += '<div class="cal-day-grid__row cal-day-grid__row--header">';
    html += '<div class="cal-day-grid__cell cal-day-grid__cell--header">Shift</div>';
    for (var pi = 0; pi < pfs.length; pi++) {
      html += '<div class="cal-day-grid__cell cal-day-grid__cell--header">' + pfs[pi] + '</div>';
    }
    html += '</div>';

    // Group slots by shift name
    var shiftGroups = {};
    for (var si = 0; si < slots.length; si++) {
      var sn = slots[si].shift;
      if (!shiftGroups[sn]) shiftGroups[sn] = {};
      shiftGroups[sn][slots[si].plateforme] = slots[si];
    }

    for (var snKey in shiftGroups) {
      html += '<div class="cal-day-grid__row">';
      html += '<div class="cal-day-grid__cell cal-day-grid__cell--label">' + snKey + '</div>';
      for (var pj = 0; pj < pfs.length; pj++) {
        var sData = shiftGroups[snKey][pfs[pj]];
        if (sData) {
          var statusClass = sData.statut && sData.statut.indexOf('✓') !== -1 ? 'cal-day-grid__cell--ok' : 'cal-day-grid__cell--warn';
          html += '<div class="cal-day-grid__cell ' + statusClass + '">';
          html += '<div class="cal-day-grid__total">' + sData.total + '</div>';
          if (session.role !== 'B') {
            for (var bn = 0; bn < sData.benevoles.length; bn++) {
              html += '<div class="cal-day-grid__name">' + sData.benevoles[bn] + '</div>';
            }
          }
          html += '</div>';
        } else {
          html += '<div class="cal-day-grid__cell cal-day-grid__cell--empty">—</div>';
        }
      }
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
    animateIn(container, '.cal-day-grid__row');
  }

  function renderCalGrid() {
    var container = $('calendar-content');
    var pfs = getPlateformes();

    // Gather all unique shift names across all days
    var allShiftNames = [];
    var seen = {};
    var shiftOrder = { 'Matin': 1, 'Soirée Jeudi': 2, 'Soir': 3, 'Nuit': 4 };
    for (var dc = 0; dc < DAY_CODES.length; dc++) {
      var daySlots = appData.planning && appData.planning[DAY_CODES[dc]];
      if (!daySlots) continue;
      for (var si = 0; si < daySlots.length; si++) {
        var sn = daySlots[si].shift;
        if (!seen[sn]) { seen[sn] = true; allShiftNames.push(sn); }
      }
    }
    allShiftNames.sort(function (a, b) {
      return (shiftOrder[a] || 99) - (shiftOrder[b] || 99);
    });

    var html = '<div class="cal-grid-wrap"><div class="cal-grid cal-grid--planning">';

    // Header row
    html += '<div class="cal-grid__header cal-grid__header--corner"></div>';
    for (var d = 0; d < DAY_NAMES.length; d++) {
      html += '<div class="cal-grid__header' + (DAY_NAMES[d] === _calDay ? ' cal-grid__header--active' : '') + '">' + DAY_NAMES[d].substring(0, 3) + '</div>';
    }

    for (var si2 = 0; si2 < allShiftNames.length; si2++) {
      var shiftName = allShiftNames[si2];
      html += '<div class="cal-grid__time">' + shiftName + '</div>';
      for (var d2 = 0; d2 < DAY_NAMES.length; d2++) {
        var code = DAY_CODES[d2];
        var daySlots2 = appData.planning && appData.planning[code] || [];
        var matching = [];

        for (var sj = 0; sj < daySlots2.length; sj++) {
          if (daySlots2[sj].shift === shiftName) {
            // Filter by session role/plateforme
            if (_calViewingVolunteerId) {
              for (var bi = 0; bi < daySlots2[sj].benevoles.length; bi++) {
                if (daySlots2[sj].benevoles[bi] === _calViewingVolunteerId) {
                  matching.push(daySlots2[sj]); break;
                }
              }
            } else if (session.role === 'B' || session.role === 'CE') {
              if (daySlots2[sj].plateforme === session.plateforme) {
                matching.push(daySlots2[sj]);
              }
            } else {
              matching.push(daySlots2[sj]);
            }
          }
        }

        var cls = 'cal-grid__cell';
        if (matching.length > 0) cls += ' cal-grid__cell--has';

        html += '<div class="' + cls + '">';
        if (matching.length > 0) {
          for (var mi = 0; mi < matching.length; mi++) {
            var m = matching[mi];
            html += '<div class="cal-grid__cell-scene">' + m.plateforme + '</div>';
            html += '<div class="cal-grid__cell-time">' + m.total + ' pers.</div>';
            if (session.role !== 'B' && !_calViewingVolunteerId) {
              for (var bn = 0; bn < m.benevoles.length; bn++) {
                html += '<div class="cal-grid__cell-name">' + m.benevoles[bn] + '</div>';
              }
            }
            if (_calViewingVolunteerId) {
              html += '<div class="cal-grid__cell-name cal-grid__cell-name--self">✓</div>';
            }
          }
        }
        html += '</div>';
      }
    }

    html += '</div></div>';
    container.innerHTML = html;
  }

  /* ─── VIEW: RESPONSABLE / CE ─── */
  function renderResponsableView() {
    if (!session || !appData) return;

    $('respo-name').textContent = session.role === 'R' ? 'Responsable' : 'CE ' + session.nom;
    $('respo-role').textContent = session.role === 'R' ? 'Responsable' : "Chef d'équipe";

    renderCoverage();
    renderFilterChips();
    setupSearchInput();
    renderRespoList();

    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.header', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
      gsap.fromTo('.section-title', { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.25, stagger: { each: 0.06 }, ease: 'power2.out', delay: 0.08 });
    }
  }

  function renderCoverage() {
    var grid = $('coverage-grid');
    var today = codeForDay(getCurrentDay());
    var pfs = getPlateformes();

    grid.innerHTML = '';
    for (var pi = 0; pi < pfs.length; pi++) {
      var pf = pfs[pi];
      var daySlots = appData.planning && appData.planning[today] || [];
      var active = 0;
      for (var si = 0; si < daySlots.length; si++) {
        if (daySlots[si].plateforme === pf) {
          active += daySlots[si].total || 0;
        }
      }
      grid.innerHTML += '<div class="coverage-item">' +
        '<div class="coverage-item__name">' + pf + '</div>' +
        '<div class="coverage-item__count">' + active + '</div>' +
        '<div class="coverage-indicator">' +
        '<span class="coverage-dot coverage-dot--ok"></span>' +
        '</div></div>';
    }
    animateIn(grid, '.coverage-item', { y: 8 });
  }

  function getCurrentDay() {
    var sim = getSimulatedParam('day');
    if (sim) return sim;
    return DAY_NAMES[new Date().getDay() === 0 ? 3 : Math.min(new Date().getDay() - 4, 3)];
  }

  function getSimulatedParam(name) {
    var m = window.location.search.match(new RegExp('[?&]' + name + '=([^&]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function renderFilterChips() {
    var container = $('filter-chips');
    var pfs = ['all'].concat(getPlateformes());

    var html = '';
    for (var j = 0; j < pfs.length; j++) {
      var pf = pfs[j];
      var label = pf === 'all' ? 'Toutes' : pf;
      html += '<button class="filter-chip' + (pf === 'all' ? ' filter-chip--active' : '') + '" data-pf="' + pf + '">' + label + '</button>';
    }
    container.innerHTML = html;

    container.onclick = function (e) {
      var chip = e.target.closest('.filter-chip');
      if (!chip) return;
      container.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('filter-chip--active'); });
      chip.classList.add('filter-chip--active');
      renderRespoList();
    };
  }

  var _searchTerm = '';
  var _searchSetupDone = false;

  function setupSearchInput() {
    if (_searchSetupDone) return;
    var inp = $('respo-search');
    if (inp) {
      inp.addEventListener('input', function (e) {
        _searchTerm = e.target.value.toLowerCase().trim();
        renderRespoList();
      });
      _searchSetupDone = true;
    }
  }

  function renderRespoList() {
    var container = $('respo-list');
    if (!container) return;

    var activeChip = document.querySelector('.filter-chip--active');
    var filterPf = activeChip ? activeChip.getAttribute('data-pf') : 'all';

    var list = [];
    for (var i = 0; i < appData.benevoles.length; i++) {
      var b = appData.benevoles[i];
      if (filterPf !== 'all' && b.plateforme !== filterPf) continue;
      if (_searchTerm && b.nom.toLowerCase().indexOf(_searchTerm) === -1) continue;
      list.push(b);
    }

    if (list.length === 0) {
      container.innerHTML = '<div class="card" style="color:var(--color-text-muted)">Aucun bénévole trouvé</div>';
      return;
    }

    var html = '';
    for (var j = 0; j < list.length; j++) {
      var vol = list[j];
      var nameParts = vol.nom.split(' ');
      var initial = (nameParts[0] ? nameParts[0][0] : '') + (nameParts[1] ? nameParts[1][0] : '');
      var todayCode = codeForDay(getCurrentDay());
      var todayShift = (vol.shifts && vol.shifts[todayCode]) || '—';
      var statusClass = 'badge--termine';
      var statusText = 'Inactif';
      if (todayShift !== '—' && todayShift !== 'Repos' && todayShift !== 'Réserve' && todayShift !== 'Non dispo') {
        statusClass = 'badge--encours';
        statusText = 'Actif';
      }

      html += '<div class="card card--clickable" data-nom="' + vol.nom + '">' +
        '<div class="benevole-row">' +
        '<div class="avatar" style="width:40px;height:40px;font-size:var(--text-base)">' + initial + '</div>' +
        '<div class="benevole-row__info">' +
        '<div class="benevole-row__name">' + vol.nom + '</div>' +
        '<div class="benevole-row__meta">' + vol.plateforme + ' &middot; ' + todayShift + '</div>' +
        '</div>' +
        '<span class="badge ' + statusClass + '">' + statusText + '</span>' +
        '</div></div>';
    }
    container.innerHTML = html;
    animateIn(container, '.card');

    container.querySelectorAll('.card--clickable').forEach(function (el) {
      el.addEventListener('click', function () {
        showFiche(el.getAttribute('data-nom'));
      });
    });
  }

  /* ─── VIEW: FICHE BÉNÉVOLE ─── */
  function showFiche(benevoleNom) {
    var b = null;
    for (var i = 0; i < appData.benevoles.length; i++) {
      if (appData.benevoles[i].nom === benevoleNom) { b = appData.benevoles[i]; break; }
    }
    if (!b) return;

    var nameParts = b.nom.split(' ');
    var initial = (nameParts[0] ? nameParts[0][0] : '') + (nameParts[1] ? nameParts[1][0] : '');

    $('fiche-avatar').textContent = initial;
    $('fiche-name').textContent = b.nom;
    $('fiche-role-label').textContent = 'Bénévole';
    $('fiche-phone').textContent = b.telephone || '—';
    $('fiche-phone').href = 'tel:' + (b.telephone || '');
    $('fiche-scene').textContent = b.plateforme;
    $('fiche-genre').textContent = b.genre === 'M' ? 'Masculin' : 'Féminin';
    $('fiche-plateforme').textContent = b.plateforme;

    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.fiche-header', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
      gsap.fromTo('.fiche-detail', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25, stagger: { each: 0.04 }, ease: 'power2.out', delay: 0.1 });
    }

    var container = $('fiche-shifts');
    var html = '';
    for (var d = 0; d < DAY_CODES.length; d++) {
      var code = DAY_CODES[d];
      var dayName = appData.dates && appData.dates[code] ? appData.dates[code].replace(/ \d{4}$/, '') : DAY_NAMES[d];
      var shiftStr = (b.shifts && b.shifts[code]) || '—';
      var hours = (b.heures && b.heures[code]) || 0;

      html += '<div class="card"><div class="shift-item">' +
        '<div class="shift-item__day">' + dayName + '</div>' +
        '<div class="shift-item__shift">' + shiftStr + '</div>' +
        '<div class="shift-item__hours">' + hours + 'h</div>' +
        '</div></div>';
    }
    if (b.heures && b.heures.total) {
      html += '<div class="card card--total"><div class="shift-item">' +
        '<div class="shift-item__day" style="font-weight:700">Total</div>' +
        '<div class="shift-item__hours" style="font-weight:700">' + b.heures.total + 'h</div>' +
        '</div></div>';
    }
    container.innerHTML = html;
    animateIn(container, '.card');

    showView('view-fiche');
  }

  $('fiche-back').addEventListener('click', function () {
    if (!session) return;
    if (session.role === 'B') {
      showView('view-benevole');
    } else if (session.role === 'A') {
      showView('view-admin');
    } else {
      showView('view-responsable');
    }
  });

  /* ─── ADMIN VIEW ─── */
  function openAdmin() {
    _adminSearch = '';
    _adminPf = 'all';
    var titleEl = $('admin-header-title');
    if (titleEl) titleEl.textContent = session.role === 'R' ? 'Responsable' : 'Admin';
    renderAdminChips();
    renderAdminList();
    showView('view-admin');
    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.header', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    }
  }

  function renderAdminChips() {
    var container = $('admin-chips');
    var pfs = ['all'].concat(getPlateformes());
    var html = '';
    for (var j = 0; j < pfs.length; j++) {
      var pf = pfs[j];
      var label = pf === 'all' ? 'Tous' : pf;
      html += '<button class="filter-chip' + (pf === 'all' ? ' filter-chip--active' : '') + '" data-pf="' + pf + '">' + label + '</button>';
    }
    container.innerHTML = html;
    container.onclick = function (e) {
      var chip = e.target.closest('.filter-chip');
      if (!chip) return;
      container.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('filter-chip--active'); });
      chip.classList.add('filter-chip--active');
      _adminPf = chip.getAttribute('data-pf');
      renderAdminList();
    };
    if (!_adminSearchSetup) {
      var inp = $('admin-search');
      if (inp) {
        inp.addEventListener('input', function (e) {
          _adminSearch = e.target.value.toLowerCase().trim();
          renderAdminList();
        });
        _adminSearchSetup = true;
      }
    }
  }

  function renderAdminList() {
    var container = $('admin-list');
    var volList = [];
    for (var i = 0; i < appData.benevoles.length; i++) {
      var b = appData.benevoles[i];
      if (_adminPf !== 'all' && b.plateforme !== _adminPf) continue;
      if (_adminSearch && b.nom.toLowerCase().indexOf(_adminSearch) === -1) continue;
      volList.push(b);
    }
    volList.sort(function (a, b) {
      if (a.plateforme !== b.plateforme) return a.plateforme < b.plateforme ? -1 : 1;
      return a.nom < b.nom ? -1 : 1;
    });
    if (volList.length === 0) {
      container.innerHTML = '<div class="card" style="color:var(--color-text-muted)">Aucun bénévole trouvé</div>';
      return;
    }
    var html = '';
    for (var vi = 0; vi < volList.length; vi++) {
      var vol = volList[vi];
      html += '<div class="admin-card">';
      html += '<div class="admin-card__header">';
      html += '<div><div class="admin-card__name">' + vol.nom + '</div><div class="admin-card__pf">' + vol.plateforme + '</div></div>';
      html += '<span class="badge badge--venir" style="cursor:pointer" data-nom="' + vol.nom + '">Voir</span>';
      html += '</div>';
      html += '<div class="admin-card__grid">';
      for (var d = 0; d < DAY_CODES.length; d++) {
        var code = DAY_CODES[d];
        html += '<div class="admin-card__day">';
        html += '<div class="admin-card__day-name">' + DAY_NAMES[d].substring(0, 3) + '</div>';
        var shiftStr = (vol.shifts && vol.shifts[code]) || '—';
        var hours = (vol.heures && vol.heures[code]) || 0;
        html += '<div class="admin-card__shift">';
        html += '<div class="admin-card__shift-scene">' + shiftStr.split(' ').slice(0, 2).join(' ') + '</div>';
        html += '<div class="admin-card__shift-time">' + hours + 'h</div>';
        html += '</div>';
        html += '</div>';
      }
      html += '</div></div>';
    }
    container.innerHTML = html;
    animateIn(container, '.admin-card', { y: 12, scale: 1 });
    container.querySelectorAll('.badge--venir').forEach(function (el) {
      el.addEventListener('click', function () {
        var volNom = el.getAttribute('data-nom');
        _calViewingVolunteerId = volNom;
        var titleEl = document.querySelector('#view-calendar .header__title');
        if (titleEl) titleEl.textContent = volNom;
        openCalendar();
      });
    });
  }

})();
