/* woolmer — the phone app: offline worker, install prompt, saved places, Near me, Open now and alerts.
 * Saved places stay on the phone (localStorage). Location is only used on the phone to sort by distance. */
(function () {
  var WB = window.WB = window.WB || {};
  var VAPID = 'BJI3fhP1miK3DBMdP2qC7aJ7xBB-ZYVwo2wm8K4NGIKTGxlu77ohIvKMt61cw2G3mr_OS1kl2DoflZI6TtqoYlU';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) document.documentElement.classList.add('is-app');

  // ---------------------------------------------------------------- offline worker
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }

  // ---------------------------------------------------------------- open now (same rules as listing pages)
  var DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var toMin = function (t) { var p = String(t).trim().split(':'); return +p[0] * 60 + (+p[1] || 0); };
  WB.openNow = function (hours, when) {
    if (!hours) return null;
    var now = when || new Date(), d = DAYS[now.getDay()], y = DAYS[(now.getDay() + 6) % 7], m = now.getHours() * 60 + now.getMinutes();
    var on = function (day, prev) {
      var v = String(hours[day] || ''); if (!v || /closed/i.test(v)) return false;
      return v.split(',').some(function (r) {
        var x = r.trim().split('-'); if (x.length < 2) return false;
        var a = toMin(x[0]), b = toMin(x[1]); if (b <= a) b += 1440;
        return prev ? (m + 1440 >= a && m + 1440 < b) : (m >= a && m < b);
      });
    };
    return on(d) || on(y, true);
  };

  // ---------------------------------------------------------------- saved places
  WB.saved = function () { return store.get('wb_saved', []); };
  WB.isSaved = function (slug) { return WB.saved().indexOf(slug) > -1; };
  WB.toggleSaved = function (slug) {
    var s = WB.saved(), i = s.indexOf(slug);
    if (i > -1) s.splice(i, 1); else s.unshift(slug);
    store.set('wb_saved', s.slice(0, 200)); return i === -1;
  };
  var paintSave = function (b) {
    var on = WB.isSaved(b.dataset.save);
    b.setAttribute('aria-pressed', String(on));
    b.innerHTML = (on ? '♥ Saved' : '♡ Save');
  };
  document.querySelectorAll('[data-save]').forEach(function (b) {
    paintSave(b);
    b.addEventListener('click', function () { WB.toggleSaved(b.dataset.save); paintSave(b); });
  });

  // ---------------------------------------------------------------- places data and cards
  var placesP = null;
  WB.places = function () { return placesP || (placesP = fetch('/places.json').then(function (r) { return r.json(); })); };
  var miles = function (a, b) {
    var R = 3958.8, r = Math.PI / 180, dLa = (b.la - a.la) * r, dLo = (b.lo - a.lo) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.la * r) * Math.cos(b.la * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  WB.art = function (p) {
    if (p.ph) return '<div class="art has-photo"><img src="' + esc(p.ph) + '" alt="' + esc(p.n) + '" loading="lazy" decoding="async">';
    return '<div class="art art-c" data-cat="' + esc(p.k || '') + '"><span class="initial" aria-hidden="true">' + esc(p.n.replace(/^the\s+/i, '')[0] || '') + '</span>';
  };
  WB.appCard = function (p, dist) {
    var open = WB.openNow(p.o);
    var bits = [p.c, p.a].filter(Boolean).join(' · ');
    return '<a class="card" href="/p/' + esc(p.s) + '/">' + WB.art(p) +
      (p.f ? '<span class="badge badge-f">Featured</span>' : p.v ? '<span class="badge badge-v">Owner-verified</span>' : '') + '</div><div class="body"><h3>' + esc(p.n) + '</h3><span class="meta">' + esc(bits) + '</span>' +
      '<div class="tags">' + (open === true ? '<span class="open-now">Open now</span>' : open === false ? '<span class="closed-now">Closed now</span>' : '') +
      (dist != null ? '<span class="tag">' + (dist < 0.1 ? 'Under 0.1 mi' : dist.toFixed(1) + ' mi') + '</span>' : '') +
      (/^[0-5]$/.test(p.h || '') ? '<span class="fsa"><i class="' + (+p.h <= 2 ? 'lo' : '') + '">' + p.h + '</i>Food hygiene</span>' : '') + '</div></div></a>';
  };

  // ---------------------------------------------------------------- Near me page
  var near = document.getElementById('near');
  if (near) {
    var out = document.getElementById('near-list'), note = document.getElementById('near-note'), cat = document.getElementById('near-cat');
    var openOnly = new URLSearchParams(location.search).get('open') === '1', here = store.get('wb_here', null), data = [];
    var chip = document.getElementById('near-open');
    var paint = function () {
      chip.setAttribute('aria-pressed', String(openOnly));
      var list = data.filter(function (p) { return !cat.value || p.c === cat.value; });
      if (openOnly) list = list.filter(function (p) { return WB.openNow(p.o) === true; });
      var rows = list.map(function (p) { return { p: p, d: here && p.la ? miles(here, p) : null }; });
      rows.sort(function (a, b) { return here ? ((a.d == null) - (b.d == null) || a.d - b.d) : (b.p.f - a.p.f || a.p.n.localeCompare(b.p.n)); });
      out.innerHTML = rows.slice(0, 80).map(function (r) { return WB.appCard(r.p, r.d); }).join('');
      var withHours = data.filter(function (p) { return p.o; }).length, hrs = withHours === 1 ? '1 place has' : withHours + ' places have';
      note.textContent = openOnly
        ? (rows.length ? rows.length + ' open right now. Only ' + hrs + ' told us their hours so far, so others may be open too.' : 'Nothing with known hours is open right now. Only ' + hrs + ' told us their hours so far.')
        : rows.length + ' places' + (here ? ', nearest first' : '') + '.';
    };
    var locate = document.getElementById('near-locate');
    locate.addEventListener('click', function () {
      if (!navigator.geolocation) { note.textContent = 'This phone can\'t share its location.'; return; }
      locate.disabled = true; locate.textContent = 'Finding you…';
      navigator.geolocation.getCurrentPosition(function (pos) {
        here = { la: pos.coords.latitude, lo: pos.coords.longitude, t: Date.now() }; store.set('wb_here', here);
        locate.disabled = false; locate.textContent = 'Update my location'; paint();
      }, function () {
        locate.disabled = false; locate.textContent = 'Use my location';
        note.textContent = 'Location is off for woolmer. Turn it on in your phone\'s settings to sort by distance.';
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    });
    if (here && Date.now() - here.t > 3 * 3600e3) here = null;   // forget an old position
    if (here) locate.textContent = 'Update my location';
    chip.addEventListener('click', function () { openOnly = !openOnly; history.replaceState(null, '', openOnly ? '?open=1' : location.pathname); paint(); });
    cat.addEventListener('change', paint);
    WB.places().then(function (d) {
      data = d;
      var cats = {}; d.forEach(function (p) { cats[p.c] = 1; });
      cat.innerHTML = '<option value="">Everything</option>' + Object.keys(cats).sort().map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
      paint();
    });
  }

  // ---------------------------------------------------------------- Saved page
  var savedEl = document.getElementById('saved-list');
  if (savedEl) {
    WB.places().then(function (d) {
      var by = {}; d.forEach(function (p) { by[p.s] = p; });
      var list = WB.saved().map(function (s) { return by[s]; }).filter(Boolean);
      savedEl.innerHTML = list.length ? list.map(function (p) { return WB.appCard(p); }).join('')
        : '<div class="panel" style="grid-column:1/-1"><h2 style="font-size:22px">Nothing saved yet</h2><p class="muted" style="margin:8px 0 0">Tap ♡ Save on any place and it\'ll be here, even when you\'ve got no signal.</p></div>';
    });
  }

  // ---------------------------------------------------------------- alerts
  var alertsEl = document.getElementById('alerts');
  if (alertsEl) {
    var btn = alertsEl.querySelector('button'), msg = alertsEl.querySelector('.msg');
    var b64 = function (s) { s = (s + '===='.slice((s.length % 4) || 4)).replace(/-/g, '+').replace(/_/g, '/'); var r = atob(s), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; };
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    var set = function (on) { btn.textContent = on ? 'Turn alerts off' : 'Turn alerts on'; btn.dataset.on = on ? '1' : ''; };
    if (!supported) {
      btn.hidden = true;
      msg.textContent = ios && !standalone ? 'On iPhone, add woolmer to your Home Screen first (Share, then Add to Home Screen), then open it from there to turn alerts on.' : 'This browser can\'t show alerts.';
    } else {
      navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (s) { set(!!s); });
      btn.addEventListener('click', function () {
        btn.disabled = true; msg.textContent = '';
        navigator.serviceWorker.ready.then(function (reg) {
          return reg.pushManager.getSubscription().then(function (sub) {
            if (btn.dataset.on && sub) {
              return WB.rest('rpc/wb_push_unsubscribe', { method: 'POST', body: { p_endpoint: sub.endpoint } }).catch(function () {})
                .then(function () { return sub.unsubscribe(); }).then(function () { set(false); msg.textContent = 'Alerts are off.'; });
            }
            return Notification.requestPermission().then(function (perm) {
              if (perm !== 'granted') { msg.textContent = 'Alerts are blocked for woolmer. You can allow them in your phone\'s settings.'; return; }
              return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) }).then(function (s) {
                var j = s.toJSON();
                return WB.rest('rpc/wb_push_subscribe', { method: 'POST', body: { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth } })
                  .then(function () { set(true); msg.textContent = 'Alerts are on. We\'ll only send the odd one that\'s worth it.'; });
              });
            });
          });
        }).catch(function () { msg.textContent = 'That didn\'t work. Please try again.'; }).then(function () { btn.disabled = false; });
      });
    }
  }

  // ---------------------------------------------------------------- install prompt
  var bar = document.getElementById('install');
  if (bar && !standalone && !store.get('wb_install_hide', 0)) {
    var text = bar.querySelector('p'), go = bar.querySelector('[data-install]'), deferred = null;
    var show = function () { bar.hidden = false; };
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; go.hidden = false; show(); });
    if (/iphone|ipad|ipod/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)) {
      text.innerHTML = 'Get the woolmer app: tap <b>Share</b>, then <b>Add to Home Screen</b>.'; go.hidden = true; show();
    }
    go.addEventListener('click', function () { if (!deferred) return; deferred.prompt(); deferred.userChoice.then(function () { bar.hidden = true; deferred = null; }); });
    bar.querySelector('[data-close]').addEventListener('click', function () { bar.hidden = true; store.set('wb_install_hide', Date.now()); });
    window.addEventListener('appinstalled', function () { bar.hidden = true; });
  }
})();

/* ---------- Motion: scroll reveal and tile glow ---------- */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;
  var SEL = '.sec-head, .cat, .card, .ev, .wo-h, .panel, .why-card, .place-grid > *, .near-tools, .crumbs + h1 ~ p';
  var io = new IntersectionObserver(function (ents) {
    ents.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  function arm(root) {
    var groups = new Map();
    (root.querySelectorAll ? root : document).querySelectorAll(SEL).forEach(function (el) {
      if (el.classList.contains('rv') || el.closest('.hero, .ph, .tabbar, .install, .evstrip')) return;
      var parent = el.parentElement, n = groups.get(parent) || 0;
      groups.set(parent, n + 1);
      el.style.setProperty('--d', Math.min(n, 8));
      el.classList.add('rv');
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.92 && r.bottom > 0 && root === document) {
        requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('in'); }); });
      } else io.observe(el);
    });
  }
  function start() {
    arm(document);
    // cards added later (search results, Near me, Saved)
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1 && n.parentElement) arm(n.parentElement); }); });
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest('.cat');
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* "<Day> night, sorted" uses today's UK weekday */
(function () {
  var el = document.querySelector('[data-night]');
  if (!el) return;
  try { el.textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'Europe/London' }).format(new Date()) + ' night, sorted'; } catch (e) {}
})();

/* ---------- Open today / closed today / hours not known ---------- */
(function () {
  var grids = document.querySelectorAll('[data-split]');
  if (!grids.length || !window.WB || !WB.places) return;
  var DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var mins = function (t) { var p = String(t).trim().split(':'); return +p[0] * 60 + (+p[1] || 0); };
  var nice = function (m) { m = m % 1440; if (m === 0) return 'midnight'; var h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + (mm ? '.' + (mm < 10 ? '0' : '') + mm : '') + ap; };
  var ranges = function (hours, day) {
    var v = String(hours[day] || ''); if (!v || /closed/i.test(v)) return [];
    return v.split(',').map(function (r) { var x = r.trim().split('-'); if (x.length < 2) return null; var a = mins(x[0]), b = mins(x[1]); if (b <= a) b += 1440; return [a, b]; }).filter(Boolean);
  };
  function status(hours) {
    if (!hours) return { g: 'unknown' };
    var now = new Date(), d = now.getDay(), m = now.getHours() * 60 + now.getMinutes();
    var y = ranges(hours, DAYS[(d + 6) % 7]).filter(function (r) { return m + 1440 >= r[0] && m + 1440 < r[1]; })[0];
    if (y) return { g: 'open', label: 'Open now until ' + nice(y[1]) };
    var t = ranges(hours, DAYS[d]);
    var cur = t.filter(function (r) { return m >= r[0] && m < r[1]; })[0];
    if (cur) return { g: 'open', label: 'Open now until ' + nice(cur[1]) };
    var later = t.filter(function (r) { return r[0] > m; }).sort(function (a, b) { return a[0] - b[0]; })[0];
    if (later) return { g: 'open', label: 'Opens ' + nice(later[0]) + ' today', soon: true };
    for (var i = 1; i <= 7; i++) {
      var n = ranges(hours, DAYS[(d + i) % 7]).sort(function (a, b) { return a[0] - b[0]; })[0];
      if (n) return { g: 'closed', label: 'Closed today · opens ' + (i === 1 ? 'tomorrow' : NAMES[(d + i) % 7]) + ' ' + nice(n[0]) };
    }
    return { g: 'closed', label: 'Closed today' };
  }
  WB.places().then(function (all) {
    var by = {}; all.forEach(function (p) { by[p.s] = p; });
    grids.forEach(function (grid) {
      var mode = grid.dataset.split, limit = +grid.dataset.limit || 0;
      var cards = [].slice.call(grid.querySelectorAll('.card[data-slug]'));
      var groups = { open: [], closed: [], unknown: [] };
      cards.forEach(function (c) {
        var p = by[c.dataset.slug], st = status(p && p.o);
        groups[st.g].push(c);
        if (st.label && !c.querySelector('.oc')) {
          var pill = document.createElement('span');
          pill.className = 'oc oc-' + st.g + (st.soon ? ' oc-soon' : '');
          pill.textContent = st.label;
          var meta = c.querySelector('.meta'); (meta || c.querySelector('.body')).insertAdjacentElement(meta ? 'afterend' : 'beforeend', pill);
        }
      });
      var title = { open: mode === 'tonight' ? 'Open tonight' : 'Open today', closed: 'Closed today', unknown: 'Hours not known yet' };
      grid.classList.remove('grid'); grid.classList.add('split');
      grid.innerHTML = '';
      ['open', 'closed', 'unknown'].forEach(function (k) {
        var list = groups[k]; if (!list.length) return;
        var box = document.createElement('div'); box.className = 'split-g split-' + k;
        box.innerHTML = '<h3 class="split-h"><span class="dot"></span>' + title[k] + ' <span class="split-n">' + list.length + '</span></h3>';
        var g = document.createElement('div'); g.className = 'grid';
        list.forEach(function (c, i) { c.hidden = !!limit && i >= (k === 'open' ? limit : 4); g.appendChild(c); });
        box.appendChild(g); grid.appendChild(box);
      });
      // keep the area filter on category pages tidy
      var tidy = function () { grid.querySelectorAll('.split-g').forEach(function (b) { b.hidden = !b.querySelector('.card:not([hidden])'); }); };
      document.querySelectorAll('.chip-l[data-area]').forEach(function (ch) { ch.addEventListener('click', function () { setTimeout(tidy, 0); }); });
    });
  }).catch(function () {});
})();

/* ---------- Home hero: live "right now" line and instant search suggestions ---------- */
(function () {
  var live = document.getElementById('live'), q = document.getElementById('q'), box = document.getElementById('suggest');
  if (!live && !box) return;
  var esc = WB.esc || function (s) { return String(s); };
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' '); };
  var syn = { chippy: 'fish chips', chinese: 'chinese wok china', indian: 'indian curry spice', pub: 'pub bar inn', coffee: 'coffee cafe', kebab: 'kebab bbq', barber: 'hair barber', doctor: 'surgery', gp: 'surgery', petrol: 'fuel shell esso jet', tip: 'recycling', park: 'park inclosure play' };
  WB.places().then(function (all) {
    // live line
    if (live) {
      var open = all.filter(function (p) { return WB.openNow(p.o) === true; });
      var food = open.filter(function (p) { return /Takeaways|Pubs|Caf/.test(p.c); }).length;
      var h = new Date().getHours(), when = h < 12 ? 'this morning' : h < 17 ? 'this afternoon' : 'tonight';
      var render = function (evN) {
        var bits = [];
        if (open.length) bits.push('<a href="/near/?open=1"><b>' + open.length + '</b> ' + (open.length === 1 ? 'place' : 'places') + ' open now' + (food ? ', ' + food + ' for food and drink' : '') + '</a>');
        if (evN) bits.push('<a href="/whats-on/"><b>' + evN + '</b> thing' + (evN > 1 ? 's' : '') + ' on ' + when + '</a>');
        if (!bits.length) return;
        live.innerHTML = '<span class="live-dot" aria-hidden="true"></span>' + bits.join('<span class="live-sep" aria-hidden="true">·</span>');
        live.hidden = false;
      };
      (WB.eventsP || Promise.resolve([])).then(function (evs) {
        var now = new Date(), endOfDay = new Date(now); endOfDay.setHours(23, 59, 59);
        var n = (evs || []).filter(function (e) { var s = new Date(e.starts_at), en = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 3 * 36e5); return en > now && s < endOfDay; }).length;
        render(n);
      }, function () { render(0); });
    }
    // suggestions
    if (!q || !box) return;
    var idx = -1, items = [];
    var close = function () { box.hidden = true; q.setAttribute('aria-expanded', 'false'); idx = -1; };
    var run = function () {
      var term = norm(q.value).trim();
      if (term.length < 2) return close();
      var words = term.split(/\s+/).map(function (w) { return syn[w] ? syn[w].split(' ').concat(w) : [w]; });
      items = all.map(function (p) {
        var name = norm(p.n), hay = norm([p.n, p.c, p.a, p.t].join(' ')), sc = 0;
        var ok = words.every(function (alts) { return alts.some(function (w) { if (name.indexOf(w) === 0) { sc += 5; return true; } if (name.indexOf(w) > -1) { sc += 3; return true; } if (hay.indexOf(w) > -1) { sc += 1; return true; } return false; }); });
        return ok ? { p: p, s: sc + (WB.openNow(p.o) ? 1 : 0) + p.f } : null;
      }).filter(Boolean).sort(function (a, b) { return b.s - a.s || a.p.n.localeCompare(b.p.n); }).slice(0, 6);
      box.innerHTML = items.map(function (r, i) {
        var p = r.p, o = WB.openNow(p.o);
        return '<a role="option" id="sg' + i + '" href="/p/' + p.s + '/"><span class="sg-n">' + esc(p.n) + '</span><span class="sg-m">' + esc([p.c, p.a].filter(Boolean).join(' · ')) + (o === true ? ' · <i class="sg-open">Open now</i>' : '') + '</span></a>';
      }).join('') + '<a class="sg-all" href="/search/?q=' + encodeURIComponent(q.value.trim()) + '">' + (items.length ? 'See all results' : 'No direct match. Search everything') + ' →</a>';
      box.hidden = false; q.setAttribute('aria-expanded', 'true'); idx = -1;
    };
    q.addEventListener('input', run);
    q.addEventListener('keydown', function (e) {
      var links = box.querySelectorAll('a'); if (box.hidden || !links.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        links.forEach(function (a, i) { a.classList.toggle('on', i === idx); }); q.setAttribute('aria-activedescendant', links[idx].id || '');
      } else if (e.key === 'Enter' && idx > -1) { e.preventDefault(); location.href = links[idx].href; }
      else if (e.key === 'Escape') close();
    });
    document.addEventListener('click', function (e) { if (!box.contains(e.target) && e.target !== q) close(); });
  }).catch(function () {});
})();

/* ---------- Deals from Featured businesses ---------- */
(function () {
  var list = document.getElementById('deals-list'), slot = document.getElementById('deal-slot'), place = document.getElementById('place');
  if ((!list && !slot) || !WB.url) return;
  var esc = WB.esc;
  var url = WB.url + '/rest/v1/wb_deals?select=id,title,details,ends_on,place_id,wb_places(slug,name,category)&published=eq.true&ends_on=gte.' + new Date().toISOString().slice(0, 10) + '&order=ends_on';
  if (slot && place) url += '&place_id=eq.' + encodeURIComponent(place.dataset.id);
  var ends = function (d) { var t = new Date(d + 'T23:59:59'), days = Math.round((t - new Date()) / 864e5); return days <= 0 ? 'Ends today' : days === 1 ? 'Ends tomorrow' : days < 8 ? 'Ends in ' + days + ' days' : 'Until ' + t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  fetch(url, { headers: { apikey: WB.key, Authorization: 'Bearer ' + WB.key } }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
    rows = (rows || []).filter(function (d) { return d.wb_places; });
    if (!rows.length) return;
    if (list) {
      list.innerHTML = rows.slice(0, 6).map(function (d) {
        return '<a class="deal" href="/p/' + esc(d.wb_places.slug) + '/"><span class="deal-tag">Deal</span><h3>' + esc(d.title) + '</h3><p class="deal-biz">' + esc(d.wb_places.name) + '</p>' + (d.details ? '<p class="deal-det">' + esc(d.details) + '</p>' : '') + '<p class="deal-end">' + ends(d.ends_on) + '</p></a>';
      }).join('');
      document.getElementById('deals-home').hidden = false;
    }
    if (slot) {
      slot.innerHTML = rows.map(function (d) {
        return '<div class="deal deal-wide"><span class="deal-tag">Deal</span><h3>' + esc(d.title) + '</h3>' + (d.details ? '<p class="deal-det">' + esc(d.details) + '</p>' : '') + '<p class="deal-end">' + ends(d.ends_on) + '. Mention woolmer when you order.</p></div>';
      }).join('');
    }
  }).catch(function () {});
})();
