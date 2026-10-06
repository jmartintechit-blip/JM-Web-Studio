/* ==========================================================================
   Azahar Nail Studio · main.js
   Vanilla JS en IIFE (sin módulos ni librerías). Cada init va aislado en safe()
   para que un fallo en una función no rompa el resto de la web.
   Contenido crítico está en el HTML: el JS solo lo mejora.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function safe(fn, name) {
    try { fn(); } catch (err) { if (window.console && console.warn) console.warn('[azahar] fallo en ' + name, err); }
  }

  /* Almacenamiento tolerante a fallos (modo privado, cookies bloqueadas…) */
  var memory = {};
  var store = {
    get: function (area, key) {
      try { return window[area].getItem(key); } catch (e) { return memory[area + key] || null; }
    },
    set: function (area, key, val) {
      try { window[area].setItem(key, val); } catch (e) { memory[area + key] = val; }
    }
  };

  /* ---------------------------------------------------------------------
     1. Cabecera: enlace activo y menú móvil
     --------------------------------------------------------------------- */
  function initHeader() {
    var header = $('#header');
    var burger = $('#burger');
    var nav = $('#nav');
    if (!header) return;

    // Enlace de navegación activo según la sección visible
    var links = $$('.nav__list a');
    if ('IntersectionObserver' in window && links.length) {
      var map = {};
      links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (a) { a.classList.remove('is-current'); a.removeAttribute('aria-current'); });
          var a = map[entry.target.id];
          if (a) { a.classList.add('is-current'); a.setAttribute('aria-current', 'true'); }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      $$('main > section[id]').forEach(function (s) { io.observe(s); });   // las secciones sin enlace limpian el estado
    }

    // Menú móvil
    if (!burger || !nav) return;
    var label = $('.burger__label', burger);
    function setMenu(open) {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (label) label.textContent = open ? 'Cerrar' : 'Menú';
      doc.body.style.overflow = open ? 'hidden' : '';
    }
    burger.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
    $$('a', header).forEach(function (a) { a.addEventListener('click', function () { if (nav.classList.contains('is-open')) setMenu(false); }); });
    doc.addEventListener('keydown', function (e) {
      if (!nav.classList.contains('is-open')) return;
      if (e.key === 'Escape') { setMenu(false); burger.focus(); return; }
      if (e.key === 'Tab') {                        // atrapa el foco dentro del menú abierto
        var f = $$('a, button', header).filter(function (el) { return el.getClientRects().length > 0; });
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 900) setMenu(false); });
  }

  /* ---------------------------------------------------------------------
     2. Aviso de demostración (descartable durante la sesión)
     --------------------------------------------------------------------- */
  /* Nombre de ?para=Nombre: solo texto, sin caracteres de control ni de dirección de texto, y como máximo 60 caracteres */
  function cleanName(raw) {
    if (!raw) return '';
    var s = String(raw).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g, ' ').replace(/\s+/g, ' ').trim();
    return (Array.from ? Array.from(s) : s.split('')).slice(0, 60).join('').trim();
  }

  function personalizeDemoBar(bar) {
    var name = '';
    try { name = cleanName(new URLSearchParams(window.location.search).get('para')); } catch (e) { return; }
    if (!name) return;
    var msg = $('#demo-msg', bar);
    var link = $('#demo-link', bar);
    var template = bar.getAttribute('data-msg-para') || '';
    // textContent (nunca innerHTML) y reemplazo con función (el nombre no se interpreta como patrón)
    if (msg && template) msg.textContent = template.replace('{nombre}', function () { return name; });
    if (link) {
      link.textContent = bar.getAttribute('data-ask-para') || link.textContent;
      link.href = (bar.getAttribute('data-wa') || '') + encodeURIComponent((bar.getAttribute('data-wa-text') || '') + ' (' + name + ')');
    }
  }

  function initDemoBar() {
    var bar = $('#demo-bar');
    var close = $('#demo-close');
    if (!bar || !close) return;
    if (store.get('sessionStorage', 'azahar-demo-closed') === '1') { bar.hidden = true; return; }
    personalizeDemoBar(bar);
    close.addEventListener('click', function () {
      store.set('sessionStorage', 'azahar-demo-closed', '1');
      bar.classList.add('is-hiding');
      window.setTimeout(function () { bar.hidden = true; }, 320);
    });
  }

  /* ---------------------------------------------------------------------
     3. Revelado al hacer scroll (con red de seguridad)
     --------------------------------------------------------------------- */
  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;

    function show(el) { el.classList.add('is-in'); }
    if (!('IntersectionObserver' in window)) { items.forEach(show); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { show(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -4% 0px' });
    items.forEach(function (el) { io.observe(el); });

    // Red de seguridad: nada se queda oculto si el observer no dispara
    window.setTimeout(function () { items.forEach(show); }, 6000);
  }

  /* ---------------------------------------------------------------------
     4. Consentimiento (cal = reservas Cal.com, maps = Google Maps)
        Nada de terceros se carga hasta que la persona lo acepta.
     --------------------------------------------------------------------- */
  var CONSENT_KEY = 'azahar-consent-v1';
  var consent = { cal: null, maps: null };
  var applied = { cal: false, maps: false };   // terceros realmente cargados en esta página
  var onConsent = [];

  function readConsent() {
    try {
      var raw = store.get('localStorage', CONSENT_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        consent.cal = typeof parsed.cal === 'boolean' ? parsed.cal : null;
        consent.maps = typeof parsed.maps === 'boolean' ? parsed.maps : null;
      }
    } catch (e) { /* valor corrupto: se ignora */ }
  }
  function writeConsent() {
    store.set('localStorage', CONSENT_KEY, JSON.stringify({ cal: consent.cal, maps: consent.maps, ts: Date.now() }));
    // Si se retira el permiso de algo que ya está cargado, se recarga la página: es la forma fiable de descargar un tercero
    if ((applied.cal && consent.cal !== true) || (applied.maps && consent.maps !== true)) {
      try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) { /* sin historial */ }
      window.location.reload();
      return;
    }
    onConsent.forEach(function (fn) { safe(fn, 'consent-listener'); });
  }

  function setBanner(open) {
    var banner = $('#cookie-banner');
    if (!banner) return;
    banner.hidden = !open;
    doc.body.classList.toggle('cookie-open', open);
  }

  function initConsent() {
    readConsent();
    var banner = $('#cookie-banner');
    var config = $('#cookie-config');
    var toggle = $('#consent-third');
    if (!banner) return;

    var configBtn = $('[data-consent="config"]', banner);
    var lastTrigger = null;   // elemento que reabrió el banner: recibe el foco al cerrarlo
    function setConfig(open) {
      if (config) config.hidden = !open;
      if (configBtn) configBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function openBanner(withConfig, trigger) {
      if (toggle) toggle.checked = consent.cal === true && consent.maps === true;
      setConfig(withConfig);
      setBanner(true);
      if (trigger) {                                   // solo si la persona lo pidió: no se roba el foco en la primera visita
        var title = $('.cookie__title', banner);
        var target = title && title.getClientRects().length ? title : $('[data-consent="reject"]', banner);
        if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
        lastTrigger = trigger;
      }
    }
    function closeBanner() {
      setBanner(false);
      if (lastTrigger) { lastTrigger.focus(); lastTrigger = null; }
    }

    banner.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-consent]');
      if (!btn) return;
      var action = btn.getAttribute('data-consent');
      if (action === 'accept') { consent.cal = true; consent.maps = true; writeConsent(); closeBanner(); }
      else if (action === 'reject') { consent.cal = false; consent.maps = false; writeConsent(); closeBanner(); }
      else if (action === 'config') { setConfig(!!(config && config.hidden)); }
      else if (action === 'save') {
        var on = !!(toggle && toggle.checked);
        consent.cal = on; consent.maps = on; writeConsent(); closeBanner();
      }
    });

    var reopen = $('#cookie-reopen');
    if (reopen) reopen.addEventListener('click', function () { openBanner(true, reopen); });

    if (window.location.hash === '#cookies') openBanner(true);
    else if (consent.cal === null && consent.maps === null) openBanner(false);
  }

  /* ---------------------------------------------------------------------
     5. Reservas: Cal.com inline + selector de servicio
     --------------------------------------------------------------------- */
  var CAL_NS = 'azahar';
  var calSection, calOrigin, calBase, calColor;
  var calReady = false;
  var calSeq = 0;
  var currentLink = '';   // se toma del chip activo en initBooking

  function bootCal() {
    if (calReady) return;
    /* Snippet oficial de Cal.com, sin minificar */
    (function (C, A, L) {
      var p = function (a, ar) { a.q.push(ar); };
      var d = C.document;
      C.Cal = C.Cal || function () {
        var cal = C.Cal; var ar = arguments;
        if (!cal.loaded) {
          cal.ns = {}; cal.q = cal.q || [];
          var s = d.head.appendChild(d.createElement('script'));
          s.src = A; s.async = true; s.id = 'cal-embed-script';
          cal.loaded = true;
        }
        if (ar[0] === L) {
          var api = function () { p(api, arguments); };
          var namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === 'string') {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ['initNamespace', namespace]);
          } else { p(cal, ar); }
          return;
        }
        p(cal, ar);
      };
    })(window, calOrigin + '/embed/embed.js', 'init');

    window.Cal('init', CAL_NS, { origin: calOrigin });
    window.Cal.ns[CAL_NS]('ui', {
      theme: 'light',
      styles: { branding: { brandColor: calColor } },
      hideEventTypeDetails: false,
      layout: 'month_view'
    });
    calReady = true;

    var script = doc.getElementById('cal-embed-script');
    if (script) script.addEventListener('error', function () { showCalFallback(); });
  }

  function externalCalUrl(link) { return calBase + '/' + link; }

  function showCalFallback() {
    var host = $('#cal-inline');
    var fb = $('#cal-fallback');
    var a = $('#cal-fallback-link');
    if (a) a.href = externalCalUrl(currentLink);
    if (host) host.hidden = true;
    if (fb) fb.hidden = false;
  }

  function setStatus(id, text) {
    var el = $('#' + id);
    if (el) el.textContent = text;
  }
  function activeServiceName() {
    var chip = $('#service-chips .chip.is-active');
    return chip ? chip.getAttribute('data-service') : '';
  }

  function renderCal(link) {
    currentLink = link;
    var gate = $('#cal-gate');
    var host = $('#cal-inline');
    var fb = $('#cal-fallback');
    if (!host || consent.cal !== true) return;
    safe(bootCal, 'cal-boot');
    if (!calReady) { showCalFallback(); return; }

    applied.cal = true;
    setStatus('embed-status', 'Cargando el calendario de ' + activeServiceName() + '…');
    if (gate) gate.hidden = true;
    if (fb) fb.hidden = true;
    host.hidden = false;
    host.innerHTML = '';
    var el = doc.createElement('div');
    el.id = 'cal-inline-' + (++calSeq);
    el.style.width = '100%';
    host.appendChild(el);

    window.Cal.ns[CAL_NS]('inline', {
      elementOrSelector: '#' + el.id,
      calLink: link,
      layout: 'month_view',
      config: { layout: 'month_view', theme: 'light' }
    });

    // Si en 12 s no hay iframe (bloqueador, red caída…), ofrecemos el enlace directo
    var mySeq = calSeq;
    window.setTimeout(function () {
      if (mySeq !== calSeq) return;
      if (!el.querySelector('iframe')) showCalFallback();
    }, 12000);
  }

  function selectService(link) {
    currentLink = link;
    $$('#service-chips .chip').forEach(function (chip) {
      var active = chip.getAttribute('data-cal-link') === link;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    var alt = $('.embed__alt', $('#cal-gate') || doc);
    if (alt) alt.href = externalCalUrl(link);
    if (consent.cal === true) renderCal(link);
  }

  function loadCalWhenNear() {
    var panel = $('#cal-embed-wrap');
    if (!panel || consent.cal !== true) return;
    var started = false;
    function go() { if (started || calSeq) return; started = true; renderCal(currentLink); }   // calSeq: ya se pintó (botón o chip)
    if (!('IntersectionObserver' in window)) { go(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); go(); }
    }, { rootMargin: '600px 0px' });
    io.observe(panel);
  }

  function initBooking() {
    calSection = $('#reservar');
    if (!calSection) return;
    calOrigin = calSection.getAttribute('data-cal-origin') || 'https://app.cal.com';
    calBase = calSection.getAttribute('data-cal-base') || 'https://cal.com';
    calColor = calSection.getAttribute('data-cal-color') || '#1E1C1A';
    var initial = $('#service-chips .chip.is-active');
    currentLink = initial ? initial.getAttribute('data-cal-link') : '';

    // Chips del calendario
    $$('#service-chips .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        selectService(chip.getAttribute('data-cal-link'));
      });
    });

    // Botón del cuadro de consentimiento
    var load = $('#cal-load');
    if (load) load.addEventListener('click', function () {
      consent.cal = true; writeConsent();
      if (consent.maps === null) setBanner(false);
      renderCal(currentLink);
      var chip = $('#service-chips .chip.is-active');     // el botón desaparece: el foco pasa al selector de servicio
      if (chip) chip.focus({ preventScroll: true });
    });

    // Todos los botones "Reservar" y "Reservar cita"
    $$('[data-book]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var link = a.getAttribute('data-cal-link');
        if (link) selectService(link);
        // En pantallas de una columna se va directo al selector y al calendario; en escritorio, al título de la sección
        var narrow = window.matchMedia && window.matchMedia('(max-width: 1020px)').matches;
        var target = (narrow && $('#cal-panel')) || (link && $('#cal-panel')) || calSection;
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        var active = $('#service-chips .chip.is-active');   // el foco sigue al scroll: el siguiente Tab continúa en el calendario
        if (active) active.focus({ preventScroll: true });
      });
    });

    onConsent.push(function () {
      if (consent.cal === true) loadCalWhenNear();
      if (consent.maps === true) loadMap();
    });
    loadCalWhenNear();
  }

  /* ---------------------------------------------------------------------
     6. Mapa de Google (tras consentimiento)
     --------------------------------------------------------------------- */
  function loadMap(focusIt) {
    var wrap = $('#map-wrap');
    var gate = $('#map-gate');
    if (!wrap || consent.maps !== true || $('iframe', wrap)) return;
    var f = doc.createElement('iframe');
    f.src = wrap.getAttribute('data-src');
    f.title = wrap.getAttribute('data-title') || 'Mapa de ubicación';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.setAttribute('allowfullscreen', '');
    wrap.appendChild(f);
    applied.maps = true;
    if (gate) gate.hidden = true;
    setStatus('map-status', 'Cargando el mapa de Triana…');
    if (focusIt) f.focus({ preventScroll: true });       // el botón desaparece: el foco pasa al mapa
  }

  function initMap() {
    var load = $('#map-load');
    if (load) load.addEventListener('click', function () {
      consent.maps = true; writeConsent();
      if (consent.cal === null) setBanner(false);
      loadMap(true);
    });
    if (consent.maps === true) {
      var wrap = $('#map-wrap');
      if (!wrap) return;
      if (!('IntersectionObserver' in window)) { loadMap(); return; }
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); loadMap(); }
      }, { rootMargin: '400px 0px' });
      io.observe(wrap);
    }
  }

  /* ---------------------------------------------------------------------
     7. Barra fija móvil: solo aparece cuando el botón principal del hero
        ha salido de pantalla y se oculta mientras se ve el calendario
     --------------------------------------------------------------------- */
  function initMobileBar() {
    var bar = $('#mobile-bar');
    var heroCta = $('#hero-cta');
    var booking = $('#reservar');
    if (!bar || !heroCta || !booking || !('IntersectionObserver' in window)) { if (bar) bar.classList.remove('is-hidden'); return; }
    var heroVisible = true;
    var bookingVisible = false;
    function update() { bar.classList.toggle('is-hidden', heroVisible || bookingVisible); }
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting; update();
    }).observe(heroCta);
    new IntersectionObserver(function (entries) {
      bookingVisible = entries[0].isIntersecting; update();
    }, { threshold: 0.25 }).observe(booking);
  }

  /* ---------------------------------------------------------------------
     8. Pequeños detalles
     --------------------------------------------------------------------- */
  function initYear() {
    var y = $('#year');
    if (y) y.textContent = String(new Date().getFullYear());
  }

  /* Indicador "abierto ahora": lee las franjas de data-horario (JSON generado desde site.config.mjs) en hora de Madrid */
  function initOpenNow() {
    var el = $('#open-now');
    if (!el || !window.Intl || !Intl.DateTimeFormat) return;
    var franjas;
    try { franjas = JSON.parse(el.getAttribute('data-horario') || '[]'); } catch (e) { return; }
    if (!franjas.length) return;
    var toMinutes = function (hhmm) { var t = hhmm.split(':'); return parseInt(t[0], 10) * 60 + parseInt(t[1], 10); };
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    var get = function (type) { var p = parts.filter(function (x) { return x.type === type; })[0]; return p ? p.value : ''; };
    var now = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);
    var current = franjas.filter(function (f) { return f.d.indexOf(get('weekday')) !== -1 && now >= toMinutes(f.o) && now < toMinutes(f.c); })[0];
    el.textContent = current ? 'Abierto ahora, hasta las ' + current.c.replace(/^0/, '') : 'Cerrado ahora';
    el.classList.toggle('is-open', !!current);
    el.hidden = false;
  }

  /* ---------------------------------------------------------------------
     Arranque
     --------------------------------------------------------------------- */
  function init() {
    safe(initConsent, 'consent');       // primero: lee el estado de consentimiento
    safe(initHeader, 'header');
    safe(initDemoBar, 'demo-bar');
    safe(initReveal, 'reveal');
    safe(initBooking, 'booking');
    safe(initMap, 'map');
    safe(initMobileBar, 'mobile-bar');
    safe(initYear, 'year');
    safe(initOpenNow, 'open-now');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
