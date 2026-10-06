/* ==========================================================================
   Azahar Nail Studio · main.js
   Vanilla JS en IIFE (sin módulos ni librerías). Cada init va aislado en safe()
   para que un fallo en una función no rompa el resto de la web.
   Contenido crítico está en el HTML: el JS solo lo mejora.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
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
     1. Cabecera: sombra al hacer scroll, enlace activo y menú móvil
     --------------------------------------------------------------------- */
  function initHeader() {
    var header = $('#header');
    var burger = $('#burger');
    var nav = $('#nav');
    if (!header) return;

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        header.classList.toggle('is-scrolled', window.scrollY > 8);
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

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
      Object.keys(map).forEach(function (id) { var s = doc.getElementById(id); if (s) io.observe(s); });
    }

    // Menú móvil
    if (!burger || !nav) return;
    var icon = $('use', burger);
    function setMenu(open) {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      if (icon) icon.setAttribute('href', open ? '#i-close' : '#i-menu');
      doc.body.style.overflow = open ? 'hidden' : '';
    }
    burger.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
    $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    doc.addEventListener('keydown', function (e) {
      if (!nav.classList.contains('is-open')) return;
      if (e.key === 'Escape') { setMenu(false); burger.focus(); return; }
      if (e.key === 'Tab') {                        // atrapa el foco dentro del menú abierto
        var f = [$('.brand', header), burger].concat($$('a', nav)).filter(Boolean);
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
  function initDemoBar() {
    var bar = $('#demo-bar');
    var close = $('#demo-close');
    if (!bar || !close) return;
    if (store.get('sessionStorage', 'azahar-demo-closed') === '1') { bar.hidden = true; return; }
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

    // Escalonado suave en el hero y en la galería
    $$('.hero__copy .reveal').forEach(function (el, i) { el.style.setProperty('--d', (i * 0.09) + 's'); });
    $$('.gallery .reveal').forEach(function (el, i) { el.style.setProperty('--d', ((i % 4) * 0.07) + 's'); });

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
     4. Parallax suave del hero (solo puntero fino y sin "reducir movimiento")
     --------------------------------------------------------------------- */
  function initHeroParallax() {
    var art = $('#hero-art');
    if (!art || reduceMotion) return;
    if (!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches)) return;
    var raf = null;
    art.addEventListener('pointermove', function (e) {
      var r = art.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      if (raf) return;
      raf = window.requestAnimationFrame(function () {
        art.style.setProperty('--px', x.toFixed(3));
        art.style.setProperty('--py', y.toFixed(3));
        raf = null;
      });
    });
    art.addEventListener('pointerleave', function () {
      art.style.setProperty('--px', 0);
      art.style.setProperty('--py', 0);
    });
  }

  /* ---------------------------------------------------------------------
     5. Consentimiento (cal = reservas Cal.com, maps = Google Maps)
        Nada de terceros se carga hasta que la persona lo acepta.
     --------------------------------------------------------------------- */
  var CONSENT_KEY = 'azahar-consent-v1';
  var consent = { cal: null, maps: null };
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
    onConsent.forEach(function (fn) { safe(fn, 'consent-listener'); });
  }

  function initConsent() {
    readConsent();
    var banner = $('#cookie-banner');
    var config = $('#cookie-config');
    var toggle = $('#consent-third');
    if (!banner) return;

    function openBanner(withConfig) {
      if (toggle) toggle.checked = consent.cal === true && consent.maps === true;
      if (config) config.hidden = !withConfig;
      banner.hidden = false;
    }
    function closeBanner() { banner.hidden = true; }

    banner.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-consent]');
      if (!btn) return;
      var action = btn.getAttribute('data-consent');
      if (action === 'accept') { consent.cal = true; consent.maps = true; writeConsent(); closeBanner(); }
      else if (action === 'reject') { consent.cal = false; consent.maps = false; writeConsent(); closeBanner(); }
      else if (action === 'config') { if (config) config.hidden = !config.hidden; }
      else if (action === 'save') {
        var on = !!(toggle && toggle.checked);
        consent.cal = on; consent.maps = on; writeConsent(); closeBanner();
      }
    });

    var reopen = $('#cookie-reopen');
    if (reopen) reopen.addEventListener('click', function () { openBanner(true); });

    if (window.location.hash === '#cookies') openBanner(true);
    else if (consent.cal === null && consent.maps === null) openBanner(false);
  }

  /* ---------------------------------------------------------------------
     6. Reservas: Cal.com inline + selector de servicio
     --------------------------------------------------------------------- */
  var CAL_NS = 'azahar';
  var calSection, calOrigin, calBase;
  var calReady = false;
  var calSeq = 0;
  var currentLink = 'jmwebstudio';

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
      styles: { branding: { brandColor: '#A24630' } },
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

  function renderCal(link) {
    currentLink = link;
    var gate = $('#cal-gate');
    var host = $('#cal-inline');
    var fb = $('#cal-fallback');
    if (!host) return;
    safe(bootCal, 'cal-boot');
    if (!calReady) { showCalFallback(); return; }

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

  function selectService(link, label) {
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
    function go() { if (started) return; started = true; renderCal(currentLink); }
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

    // Chips del calendario
    $$('#service-chips .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        selectService(chip.getAttribute('data-cal-link'), chip.getAttribute('data-service'));
      });
    });

    // Botón del cuadro de consentimiento
    var load = $('#cal-load');
    if (load) load.addEventListener('click', function () {
      consent.cal = true; writeConsent();
      var b = $('#cookie-banner'); if (b && consent.maps === null) b.hidden = true;
      renderCal(currentLink);
    });

    // Todos los botones "Reservar" y "Reservar cita"
    $$('[data-book]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var link = a.getAttribute('data-cal-link');
        var target = $('#cal-panel') || calSection;
        if (link) { selectService(link, a.getAttribute('data-service')); }
        else { target = calSection; }
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        if (link) {
          var active = $('#service-chips .chip.is-active');
          if (active) window.setTimeout(function () { try { active.focus({ preventScroll: true }); } catch (err) { active.focus(); } }, reduceMotion ? 0 : 600);
        }
      });
    });

    onConsent.push(function () {
      if (consent.cal === true) loadCalWhenNear();
      if (consent.maps === true) loadMap();
    });
    loadCalWhenNear();
  }

  /* ---------------------------------------------------------------------
     7. Mapa de Google (tras consentimiento)
     --------------------------------------------------------------------- */
  function loadMap() {
    var wrap = $('#map-wrap');
    var gate = $('#map-gate');
    if (!wrap || $('iframe', wrap)) return;
    var f = doc.createElement('iframe');
    f.src = 'https://www.google.com/maps?q=Triana%2C%20Sevilla&hl=es&z=15&output=embed';
    f.title = 'Mapa del barrio de Triana, Sevilla';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.setAttribute('allowfullscreen', '');
    wrap.appendChild(f);
    if (gate) gate.hidden = true;
  }

  function initMap() {
    var load = $('#map-load');
    if (load) load.addEventListener('click', function () {
      consent.maps = true; writeConsent();
      var b = $('#cookie-banner'); if (b && consent.cal === null) b.hidden = true;
      loadMap();
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
     8. Barra fija móvil: se oculta mientras se ve el calendario
     --------------------------------------------------------------------- */
  function initMobileBar() {
    var bar = $('#mobile-bar');
    var target = $('#reservar');
    if (!bar || !target || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { bar.classList.toggle('is-hidden', entry.isIntersecting); });
    }, { threshold: 0.25 });
    io.observe(target);
  }

  /* ---------------------------------------------------------------------
     9. Pequeños detalles
     --------------------------------------------------------------------- */
  function initYear() {
    var y = $('#year');
    if (y) y.textContent = String(new Date().getFullYear());
  }

  /* ---------------------------------------------------------------------
     Arranque
     --------------------------------------------------------------------- */
  function init() {
    safe(initConsent, 'consent');       // primero: lee el estado de consentimiento
    safe(initHeader, 'header');
    safe(initDemoBar, 'demo-bar');
    safe(initReveal, 'reveal');
    safe(initHeroParallax, 'parallax');
    safe(initBooking, 'booking');
    safe(initMap, 'map');
    safe(initMobileBar, 'mobile-bar');
    safe(initYear, 'year');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
