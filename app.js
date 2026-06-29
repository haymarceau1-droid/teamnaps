(function () {
  'use strict';

  /* ─── STATE (closure-scoped, never on window) ─── */
  let appData = null;
  let session = null;
  let alertInterval = null;

  const $ = function (id) { return document.getElementById(id); };

  /* ─── INIT ─── */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    loadData();
    checkSession();

    window.addEventListener('online', function () {
      loadData();
    });
  }

  /* ─── DATA LOADING (offline-first) ─── */
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
          if (!loadFromEmbedded()) {
            loadFromCache();
          }
        });
    } else {
      if (!loadFromEmbedded()) {
        loadFromCache();
      }
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
    var contactBar = $('contact-bar');
    if (contactBar) {
      contactBar.style.display = (viewId === 'view-login' || viewId === 'view-offline') ? 'none' : 'flex';
    }
    _currentView = viewId;
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(view, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
      if (viewId === 'view-login') {
        gsap.fromTo('.login__logo', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', delay: 0.05 });
        gsap.fromTo('.form-group, .btn-primary, .error-msg', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3, stagger: { each: 0.06 }, ease: 'power2.out', delay: 0.15 });
      }
      if (viewId !== 'view-login' && viewId !== 'view-offline') {
        gsap.fromTo('.contact-bar', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out', delay: 0.1 });
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

  /* ─── TIME HELPERS ─── */
  var DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  function getSimulatedParam(name) {
    var m = window.location.search.match(new RegExp('[?&]' + name + '=([^&]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function getCurrentDay() {
    return getSimulatedParam('day') || DAY_NAMES[new Date().getDay()];
  }

  function getCurrentMinutes() {
    var sim = getSimulatedParam('hour');
    if (sim) {
      var p = sim.split(':').map(Number);
      return p[0] * 60 + (p[1] || 0);
    }
    var now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  function getShiftStatus(shift) {
    var curMin = getCurrentMinutes();
    var dh = parseInt(shift.debut, 10), dm = parseInt(shift.debut.split(':')[1], 10);
    var fh = parseInt(shift.fin, 10), fm = parseInt(shift.fin.split(':')[1], 10);
    var d = dh * 60 + dm;
    var f = fh * 60 + fm;
    if (f <= d) f += 1440;

    var c = curMin;
    if (f > 1440 && c < d) c += 1440;

    if (c < d) return 'venir';
    if (c >= d && c < f) return 'encours';
    return 'termine';
  }

  function getSceneName(id) {
    if (!appData) return id;
    for (var i = 0; i < appData.scenes.length; i++) {
      if (appData.scenes[i].id === id) return appData.scenes[i].nom;
    }
    return id;
  }

  /* ─── AUTH ─── */
  $('login-btn').addEventListener('click', handleLogin);

  $('login-phone').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') handleLogin();
  });

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

  var _adminSearch = '';
  var _adminPf = 'all';
  var _adminSearchSetup = false;

  /* ─── CALENDAR ─── */
  $('calendar-btn-b').addEventListener('click', openCalendar);
  $('calendar-btn-r').addEventListener('click', openCalendar);
  $('calendar-back').addEventListener('click', function () {
    if (!session) return;
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

  var _calMode = '4days';
  var _calDay = 'jeudi';
  var _calDays = ['jeudi', 'vendredi', 'samedi', 'dimanche'];

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

  function getShiftsFor(jour) {
    var result = [];
    for (var i = 0; i < appData.shifts.length; i++) {
      var s = appData.shifts[i];
      if (s.jour !== jour) continue;
      if (session.role === 'B' && s.benevole_id !== session.id) continue;
      result.push(s);
    }
    return result;
  }

  function renderCalDay() {
    var container = $('calendar-content');
    var shifts = getShiftsFor(_calDay);

    var dayNavHtml = '<div class="cal-nav">';
    for (var d = 0; d < _calDays.length; d++) {
      var active = _calDays[d] === _calDay ? ' cal-nav__btn--active' : '';
      dayNavHtml += '<button class="cal-nav__btn' + active + '" data-day="' + _calDays[d] + '">' + _calDays[d].substring(0, 3) + '</button>';
    }
    dayNavHtml += '</div>';

    shifts.sort(function (a, b) {
      var da = parseInt(a.debut, 10), db = parseInt(b.debut, 10);
      if (da !== db) return da - db;
      return parseInt(a.fin, 10) - parseInt(b.fin, 10);
    });

    if (shifts.length === 0) {
      container.innerHTML = dayNavHtml + '<div class="cal-empty">Aucun shift ce jour</div>';
      return;
    }

    var slots = [];
    var currentSlot = null;
    for (var j = 0; j < shifts.length; j++) {
      var sh = shifts[j];
      var slotKey = sh.debut.substring(0, 2);
      if (!currentSlot || currentSlot.key !== slotKey) {
        currentSlot = { key: slotKey, label: sh.debut, shifts: [] };
        slots.push(currentSlot);
      }
      currentSlot.shifts.push(sh);
    }

    var html = dayNavHtml + '<div class="cal-timeline">';
    for (var k = 0; k < slots.length; k++) {
      var slot = slots[k];
      html += '<div class="cal-slot">';
      html += '<div class="cal-slot__time">' + slot.label + '</div>';
      html += '<div class="cal-slot__items">';
      for (var m = 0; m < slot.shifts.length; m++) {
        var shift = slot.shifts[m];
        html += '<div class="cal-shift">';
        html += '<div class="cal-shift__scene">' + getSceneName(shift.scene) + '</div>';
        html += '<div class="cal-shift__time">' + shift.debut + ' - ' + shift.fin + '</div>';
        if (session.role !== 'B') {
          var volName = '';
          for (var n = 0; n < appData.benevoles.length; n++) {
            if (appData.benevoles[n].id === shift.benevole_id) {
              volName = appData.benevoles[n].prenom + ' ' + appData.benevoles[n].nom;
              break;
            }
          }
          if (volName) html += '<div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-xs)">' + volName + '</div>';
        }
        html += '</div>';
      }
      html += '</div></div>';
    }
    html += '</div>';
    container.innerHTML = html;
    animateIn(container, '.cal-shift', { y: 10 });
  }

  function renderCalGrid() {
    var container = $('calendar-content');

    var allShifts = {};
    for (var d = 0; d < _calDays.length; d++) {
      allShifts[_calDays[d]] = getShiftsFor(_calDays[d]);
    }

    var hours = {};
    for (var d2 = 0; d2 < _calDays.length; d2++) {
      var dayShifts = allShifts[_calDays[d2]];
      for (var i = 0; i < dayShifts.length; i++) {
        var sh = dayShifts[i];
        var h = parseInt(sh.debut, 10);
        hours[h] = true;
        var hf = parseInt(sh.fin, 10);
        if (hf > h) {
          for (var hh = h + 1; hh <= hf; hh++) {
            if (hf - hh <= 1 || hh === hf) hours[hh] = true;
          }
        }
      }
    }
    var hourList = Object.keys(hours).map(Number).sort(function (a, b) { return a - b; });

    var html = '<div class="cal-grid-wrap"><div class="cal-grid">';
    html += '<div class="cal-grid__header"></div>';
    for (var d3 = 0; d3 < _calDays.length; d3++) {
      html += '<div class="cal-grid__header' + (_calDays[d3] === _calDay ? ' cal-grid__header--active' : '') + '">' + _calDays[d3].substring(0, 3) + '</div>';
    }
    for (var hi = 0; hi < hourList.length; hi++) {
      var hh = hourList[hi];
      var hStr = ('0' + hh).slice(-2) + ':00';
      html += '<div class="cal-grid__time">' + hStr + '</div>';
      for (var d4 = 0; d4 < _calDays.length; d4++) {
        var dayS = _calDays[d4];
        var cellShifts = [];
        for (var si = 0; si < allShifts[dayS].length; si++) {
          var ss = allShifts[dayS][si];
          var shH = parseInt(ss.debut, 10);
          var fH = parseInt(ss.fin, 10);
          if (fH <= shH) fH += 24;
          if (hh >= shH && hh < fH) cellShifts.push(ss);
        }
        var cls = 'cal-grid__cell';
        if (cellShifts.length > 0) cls += ' cal-grid__cell--has';
        html += '<div class="' + cls + '">';
        for (var ci = 0; ci < cellShifts.length; ci++) {
          var cs = cellShifts[ci];
          var sceneName = getSceneName(cs.scene);
          if (sceneName.length > 12) sceneName = sceneName.substring(0, 12) + '…';
          html += '<div class="cal-grid__cell-scene">' + sceneName + '</div>';
          html += '<div class="cal-grid__cell-time">' + cs.debut + '-' + cs.fin.split(':')[0] + 'h</div>';
          if (session.role !== 'B') {
            var name = '';
            for (var bi = 0; bi < appData.benevoles.length; bi++) {
              if (appData.benevoles[bi].id === cs.benevole_id) {
                name = appData.benevoles[bi].prenom;
                break;
              }
            }
            if (name) html += '<div class="cal-grid__cell-name">' + name + '</div>';
          }
        }
        html += '</div>';
      }
    }
    html += '</div></div>';
    container.innerHTML = html;
    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.cal-grid__cell--has', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.25, stagger: { each: 0.015, from: 'start' }, ease: 'power2.out', delay: 0.1 });
    }
  }

  function handleLogin() {
    var phone = $('login-phone').value.trim();
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
        if (appData.benevoles[i].telephone === phone && appData.benevoles[i].role === 'B') {
          volunteer = appData.benevoles[i];
          break;
        }
      }
    } else if (role === 'CE') {
      for (var j = 0; j < appData.chefs_equipe.length; j++) {
        if (appData.chefs_equipe[j].telephone === phone) {
          var ce = appData.chefs_equipe[j];
          volunteer = { id: 'CE', nom: ce.nom, prenom: ce.nom, telephone: ce.telephone, role: 'CE', plateforme: ce.poste, genre: '' };
          break;
        }
      }
    } else if (role === 'R') {
      if (appData.responsable.telephone === phone) {
        var r = appData.responsable;
        volunteer = { id: 'R', nom: r.nom, prenom: r.nom, telephone: r.telephone, role: 'R', plateforme: '', genre: '' };
      }
    } else if (role === 'A') {
      if (appData.admin && appData.admin.telephone === phone) {
        volunteer = { id: 'A', nom: 'Admin', prenom: 'Admin', telephone: phone, role: 'A', plateforme: '', genre: '' };
      }
    }

    if (!volunteer) {
      errorEl.textContent = 'Aucun compte trouvé avec ce numéro et ce poste';
      return;
    }

    session = {
      id: volunteer.id,
      role: volunteer.role,
      nom: volunteer.prenom,
      nomFamille: volunteer.nom,
      plateforme: volunteer.plateforme
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

    if (session.role === 'A') {
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
  }

  /* ─── CONTACTS ─── */
  function updateContacts() {
    if (!appData) return;
    var ce = null;
    for (var i = 0; i < appData.chefs_equipe.length; i++) {
      if (appData.chefs_equipe[i].poste === 'Stage') { ce = appData.chefs_equipe[i]; break; }
    }
    var r = appData.responsable;

    if (ce) {
      var barCe = $('contact-bar-ce');
      barCe.innerHTML = '<span>CE Stage: ' + ce.telephone + '</span>';
      barCe.href = 'tel:' + ce.telephone;
      var nameCe = document.getElementById('contact-ce-name');
      var phoneCe = document.getElementById('contact-ce-phone');
      if (nameCe) nameCe.textContent = ce.nom;
      if (phoneCe) { phoneCe.textContent = ce.telephone; phoneCe.href = 'tel:' + ce.telephone; }
    }
    if (r) {
      var barR = $('contact-bar-r');
      barR.innerHTML = '<span>Responsable: ' + r.telephone + '</span>';
      barR.href = 'tel:' + r.telephone;
      var nameR = document.getElementById('contact-r-name');
      var phoneR = document.getElementById('contact-r-phone');
      if (nameR) nameR.textContent = r.nom;
      if (phoneR) { phoneR.textContent = r.telephone; phoneR.href = 'tel:' + r.telephone; }
    }
  }

  /* ─── VIEW: BÉNÉVOLE ─── */
  function renderBenevoleView() {
    if (!session || !appData) return;

    $('benevole-name').textContent = session.nom;

    var today = getCurrentDay();
    var myShifts = [];

    for (var i = 0; i < appData.shifts.length; i++) {
      if (appData.shifts[i].benevole_id === session.id && appData.shifts[i].jour === today) {
        myShifts.push(appData.shifts[i]);
      }
    }

    myShifts.sort(function (a, b) {
      return parseInt(a.debut, 10) - parseInt(b.debut, 10);
    });

    var container = $('benevole-shifts');
    if (myShifts.length === 0) {
      container.innerHTML = '<div class="card" style="color:var(--color-text-muted)">Aucun shift aujourd\'hui</div>';
    } else {
      var html = '';
      for (var j = 0; j < myShifts.length; j++) {
        var s = myShifts[j];
        var status = getShiftStatus(s);
        var labels = { venir: 'À venir', encours: 'En cours', termine: 'Terminé' };
        html += '<div class="card"><div class="shift-item">' +
          '<div class="shift-item__time">' + s.debut + ' - ' + s.fin + '</div>' +
          '<div class="shift-item__scene">' + getSceneName(s.scene) + '</div>' +
          '<div class="shift-item__status"><span class="badge badge--' + status + '">' + labels[status] + '</span></div>' +
          '</div></div>';
      }
      container.innerHTML = html;
      animateIn(container, '.card');
    }

    checkAlert(myShifts);
    if (alertInterval) clearInterval(alertInterval);
    alertInterval = setInterval(function () { checkAlert(myShifts); }, 30000);

    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.header--centered', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
      gsap.fromTo('.section-title', { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.25, stagger: { each: 0.06 }, ease: 'power2.out', delay: 0.08 });
    }
  }

  function checkAlert(shifts) {
    var curMin = getCurrentMinutes();
    var el = $('shift-alert');

    for (var i = 0; i < shifts.length; i++) {
      var s = shifts[i];
      var dh = parseInt(s.debut, 10), dm = parseInt(s.debut.split(':')[1], 10);
      var fh = parseInt(s.fin, 10), fm = parseInt(s.fin.split(':')[1], 10);
      var dMin = dh * 60 + dm;
      var finMin = fh * 60 + fm;
      if (finMin <= dMin) finMin += 1440;
      var c = curMin;
      if (finMin > 1440 && c < dMin) c += 1440;
      var diff = finMin - c;

      if (diff > 0 && diff <= 5 && getShiftStatus(s) === 'encours') {
        el.textContent = '⚠ Shift se termine bientôt ! Scène : ' + getSceneName(s.scene) + ' (fin ' + s.fin + ')';
        el.style.display = 'block';
        return;
      }
    }
    el.style.display = 'none';
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
    var today = getCurrentDay();

    var pfMin = {};
    var seenPf = {};

    for (var i = 0; i < appData.scenes.length; i++) {
      var sc = appData.scenes[i];
      if (!seenPf[sc.plateforme]) {
        seenPf[sc.plateforme] = true;
        pfMin[sc.plateforme] = sc.min_benevoles;
      } else {
        if (sc.min_benevoles > pfMin[sc.plateforme]) {
          pfMin[sc.plateforme] = sc.min_benevoles;
        }
      }
    }

    grid.innerHTML = '';
    for (var pf in pfMin) {
      if (!pfMin.hasOwnProperty(pf)) continue;
      var activeIds = {};
      for (var j = 0; j < appData.shifts.length; j++) {
        var shift = appData.shifts[j];
        if (shift.plateforme !== pf || shift.jour !== today) continue;
        if (getShiftStatus(shift) === 'encours') {
          activeIds[shift.benevole_id] = true;
        }
      }
      var count = 0;
      for (var k in activeIds) { if (activeIds.hasOwnProperty(k)) count++; }
      var min = pfMin[pf];
      var ok = count >= min;
      grid.innerHTML += '<div class="coverage-item">' +
        '<div class="coverage-item__name">' + pf + '</div>' +
        '<div class="coverage-item__count">' + count + '</div>' +
        '<div class="coverage-indicator">' +
        '<span class="coverage-dot coverage-dot--' + (ok ? 'ok' : 'low') + '"></span>' +
        '<span style="font-size:var(--text-xs);color:var(--color-text-muted)">min ' + min + '</span>' +
        '</div></div>';
    }
    animateIn(grid, '.coverage-item', { y: 8 });
  }

  function renderFilterChips() {
    var container = $('filter-chips');
    var plateformes = ['all'];
    var seen = {};
    for (var i = 0; i < appData.scenes.length; i++) {
      if (!seen[appData.scenes[i].plateforme]) {
        seen[appData.scenes[i].plateforme] = true;
        plateformes.push(appData.scenes[i].plateforme);
      }
    }

    var html = '';
    for (var j = 0; j < plateformes.length; j++) {
      var pf = plateformes[j];
      var label = pf === 'all' ? 'Toutes' : pf.charAt(0).toUpperCase() + pf.slice(1);
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
    var today = getCurrentDay();

    var activeChip = document.querySelector('.filter-chip--active');
    var filterPf = activeChip ? activeChip.getAttribute('data-pf') : 'all';

    var list = [];
    for (var i = 0; i < appData.benevoles.length; i++) {
      var b = appData.benevoles[i];
      if (filterPf !== 'all' && b.plateforme !== filterPf) continue;
      if (_searchTerm && b.prenom.toLowerCase().indexOf(_searchTerm) === -1 && b.nom.toLowerCase().indexOf(_searchTerm) === -1) continue;
      list.push(b);
    }

    if (list.length === 0) {
      container.innerHTML = '<div class="card" style="color:var(--color-text-muted)">Aucun bénévole trouvé</div>';
      return;
    }

    var html = '';
    for (var j = 0; j < list.length; j++) {
      var vol = list[j];
      var activeShift = null;
      for (var k = 0; k < appData.shifts.length; k++) {
        if (appData.shifts[k].benevole_id === vol.id && appData.shifts[k].jour === today && getShiftStatus(appData.shifts[k]) === 'encours') {
          activeShift = appData.shifts[k];
          break;
        }
      }
      var shiftStatus = activeShift ? 'En cours' : 'Inactif';
      var statusClass = activeShift ? 'badge--encours' : 'badge--termine';
      var sceneName = activeShift ? getSceneName(activeShift.scene) : '—';
      html += '<div class="card card--clickable" data-id="' + vol.id + '">' +
        '<div class="benevole-row">' +
        '<div class="avatar" style="width:40px;height:40px;font-size:var(--text-base)">' + vol.prenom[0] + vol.nom[0] + '</div>' +
        '<div class="benevole-row__info">' +
        '<div class="benevole-row__name">' + vol.prenom + ' ' + vol.nom + '</div>' +
        '<div class="benevole-row__meta">' + vol.plateforme + ' &middot; ' + sceneName + '</div>' +
        '</div>' +
        '<span class="badge ' + statusClass + '">' + shiftStatus + '</span>' +
        '</div></div>';
    }
    container.innerHTML = html;
    animateIn(container, '.card');

    container.querySelectorAll('.card--clickable').forEach(function (el) {
      el.addEventListener('click', function () {
        showFiche(el.getAttribute('data-id'));
      });
    });
  }

  /* ─── VIEW: FICHE BÉNÉVOLE ─── */
  function showFiche(benevoleId) {
    /* SECURITY: B role can only see their own fiche */
    if (session.role === 'B' && benevoleId !== session.id) return;

    var b = null;
    for (var i = 0; i < appData.benevoles.length; i++) {
      if (appData.benevoles[i].id === benevoleId) { b = appData.benevoles[i]; break; }
    }
    if (!b) return;

    $('fiche-avatar').textContent = b.prenom[0] + b.nom[0];
    $('fiche-name').textContent = b.prenom + ' ' + b.nom;
    $('fiche-role-label').textContent = 'Bénévole';
    $('fiche-phone').textContent = b.telephone;
    $('fiche-phone').href = 'tel:' + b.telephone;
    $('fiche-scene').textContent = b.plateforme;
    $('fiche-genre').textContent = b.genre === 'M' ? 'Masculin' : 'Féminin';
    $('fiche-plateforme').textContent = b.plateforme;

    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.fiche-header', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
      gsap.fromTo('.fiche-detail', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25, stagger: { each: 0.04 }, ease: 'power2.out', delay: 0.1 });
    }

    var today = getCurrentDay();
    var ficheShifts = [];
    for (var j = 0; j < appData.shifts.length; j++) {
      if (appData.shifts[j].benevole_id === b.id && appData.shifts[j].jour === today) {
        ficheShifts.push(appData.shifts[j]);
      }
    }
    ficheShifts.sort(function (a, b) { return parseInt(a.debut, 10) - parseInt(b.debut, 10); });

    var container = $('fiche-shifts');
    if (ficheShifts.length === 0) {
      container.innerHTML = '<div class="card" style="color:var(--color-text-muted)">Aucun shift aujourd\'hui</div>';
    } else {
      var html = '';
      for (var k = 0; k < ficheShifts.length; k++) {
        var s = ficheShifts[k];
        var status = getShiftStatus(s);
        var labels = { venir: 'À venir', encours: 'En cours', termine: 'Terminé' };
        html += '<div class="card"><div class="shift-item">' +
          '<div class="shift-item__time">' + s.debut + ' - ' + s.fin + '</div>' +
          '<div class="shift-item__scene">' + getSceneName(s.scene) + '</div>' +
          '<div class="shift-item__status"><span class="badge badge--' + status + '">' + labels[status] + '</span></div>' +
          '</div></div>';
      }
      container.innerHTML = html;
      animateIn(container, '.card');
    }

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
    renderAdminChips();
    renderAdminList();
    showView('view-admin');
    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.header', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    }
  }

  function renderAdminChips() {
    var container = $('admin-chips');
    var pfs = ['all'];
    var seen = {};
    for (var i = 0; i < appData.scenes.length; i++) {
      if (!seen[appData.scenes[i].plateforme]) {
        seen[appData.scenes[i].plateforme] = true;
        pfs.push(appData.scenes[i].plateforme);
      }
    }
    var html = '';
    for (var j = 0; j < pfs.length; j++) {
      var pf = pfs[j];
      var label = pf === 'all' ? 'Tous' : pf.charAt(0).toUpperCase() + pf.slice(1);
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
    var days = ['jeudi', 'vendredi', 'samedi', 'dimanche'];
    var volList = [];
    for (var i = 0; i < appData.benevoles.length; i++) {
      var b = appData.benevoles[i];
      if (_adminPf !== 'all' && b.plateforme !== _adminPf) continue;
      if (_adminSearch && b.prenom.toLowerCase().indexOf(_adminSearch) === -1 && b.nom.toLowerCase().indexOf(_adminSearch) === -1) continue;
      volList.push(b);
    }
    volList.sort(function (a, b) {
      if (a.plateforme !== b.plateforme) return a.plateforme < b.plateforme ? -1 : 1;
      return a.prenom < b.prenom ? -1 : 1;
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
      html += '<div><div class="admin-card__name">' + vol.prenom + ' ' + vol.nom + '</div><div class="admin-card__pf">' + vol.plateforme + '</div></div>';
      html += '<span class="badge badge--venir" style="cursor:pointer" data-id="' + vol.id + '">Voir</span>';
      html += '</div>';
      html += '<div class="admin-card__grid">';
      for (var d = 0; d < days.length; d++) {
        html += '<div class="admin-card__day">';
        html += '<div class="admin-card__day-name">' + days[d].substring(0, 3) + '</div>';
        var dayShifts = [];
        for (var si = 0; si < appData.shifts.length; si++) {
          var s = appData.shifts[si];
          if (s.benevole_id === vol.id && s.jour === days[d]) dayShifts.push(s);
        }
        dayShifts.sort(function (a, b) { return parseInt(a.debut, 10) - parseInt(b.debut, 10); });
        if (dayShifts.length === 0) {
          html += '<div class="admin-card__empty">—</div>';
        } else {
          for (var sj = 0; sj < dayShifts.length; sj++) {
            var sh = dayShifts[sj];
            var sn = getSceneName(sh.scene);
            if (sn.length > 8) sn = sn.substring(0, 8) + '…';
            html += '<div class="admin-card__shift">';
            html += '<div class="admin-card__shift-scene">' + sn + '</div>';
            html += '<div class="admin-card__shift-time">' + sh.debut + '-' + sh.fin.split(':')[0] + 'h</div>';
            html += '</div>';
          }
        }
        html += '</div>';
      }
      html += '</div></div>';
    }
    container.innerHTML = html;
    animateIn(container, '.admin-card', { y: 12, scale: 1 });
    container.querySelectorAll('.badge--venir').forEach(function (el) {
      el.addEventListener('click', function () {
        showFiche(el.getAttribute('data-id'));
      });
    });
  }

})();
