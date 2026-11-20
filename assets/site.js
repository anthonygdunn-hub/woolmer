/* woolmer — shared behaviour on every page */
(function () {
  var WB = window.WB || {};
  WB.rest = function (path, opts) {
    opts = opts || {};
    return fetch(WB.url + '/rest/v1/' + path, {
      method: opts.method || 'GET',
      headers: Object.assign({ apikey: WB.key, Authorization: 'Bearer ' + WB.key, 'Content-Type': 'application/json' }, opts.headers || {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); });
      return r.status === 201 || r.status === 204 ? null : r.json();
    });
  };
  WB.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  WB.settings = null;
  WB.getSettings = function () {
    if (WB.settings) return Promise.resolve(WB.settings);
    return WB.rest('wb_settings?select=key,value').then(function (rows) {
      WB.settings = {}; (rows || []).forEach(function (r) { WB.settings[r.key] = r.value; }); return WB.settings;
    }).catch(function () { WB.settings = {}; return WB.settings; });
  };
  WB.client = function () {
    if (!WB._client && window.supabase) WB._client = window.supabase.createClient(WB.url, WB.key, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } });
    return WB._client;
  };
  // sign-in: emails a link + code via the wb-login function (branded, from woolmer.info)
  WB.sendLink = function (email, next) {
    return fetch(WB.url + '/functions/v1/wb-login', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: WB.key }, body: JSON.stringify({ email: email, next: next || (location.pathname + location.search) }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Could not send the email.'); return j; }); });
  };
  // if we arrived from a sign-in link, swap its token for a session and tidy the address bar
  WB.consumeLink = function (sb) {
    var q = new URLSearchParams(location.search), th = q.get('token_hash');
    if (!th) return Promise.resolve(null);
    q.delete('token_hash'); q.delete('type');
    var clean = location.pathname + (q.toString() ? '?' + q : '');
    return sb.auth.verifyOtp({ token_hash: th, type: 'magiclink' }).then(function (r) { history.replaceState(null, '', clean); return r; });
  };
  // profile pictures: initials until a checked, shared picture loads
  WB.avHtml = function (name, uid, cls) {
    var i = String(name || '?').trim().charAt(0).toUpperCase() || '?';
    return '<span class="av' + (cls ? ' ' + cls : '') + '"' + (uid ? ' data-uid="' + WB.esc(uid) + '"' : '') + ' aria-hidden="true">' + WB.esc(i) + '</span>';
  };
  WB.fillAvatars = function (box) {
    var els = [].slice.call((box || document).querySelectorAll('.av[data-uid]')), ids = {};
    els.forEach(function (e) { if (/^[0-9a-f-]{36}$/i.test(e.dataset.uid)) ids[e.dataset.uid] = 1; });
    ids = Object.keys(ids); if (!ids.length) return;
    WB.rest('wb_avatars?select=user_id,url&status=eq.approved&show_public=eq.true&user_id=in.(' + ids.join(',') + ')').then(function (rows) {
      var by = {}; (rows || []).forEach(function (r) { by[r.user_id] = r.url; });
      els.forEach(function (e) { var u = by[e.dataset.uid]; if (u && /^https:\/\//.test(u)) e.innerHTML = '<img src="' + WB.esc(u) + '" alt="" loading="lazy">'; });
    }).catch(function () {});
  };
  window.WB = WB;

  // mobile menu
  var btn = document.querySelector('.menu-btn'), nav = document.getElementById('nav');
  if (btn && nav) btn.addEventListener('click', function () { var o = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', String(o)); });

  // category page filters: area, food type (Takeaways) and only-show toggles, all combined
  var chips = document.querySelectorAll('.chip-l[data-area]'), list = document.getElementById('list');
  var tys = document.querySelectorAll('.ty[data-type]'), togs = document.querySelectorAll('[data-only]'), cnt = document.getElementById('ty-count');
  if (list && (chips.length || tys.length)) {
    var F = { area: '', types: {}, only: {} };
    try {
      var q = new URLSearchParams(location.search);
      (q.get('type') || '').split(',').forEach(function (t) { if (t) F.types[t] = 1; });
      (q.get('only') || '').split(',').forEach(function (t) { if (t) F.only[t] = 1; });
      F.area = q.get('area') || '';
    } catch (x) {}
    var run = function () {
      var ts = Object.keys(F.types), n = 0;
      list.querySelectorAll('.card').forEach(function (card) {
        var my = (card.dataset.types || '').split(' ');
        var ok = (!F.area || card.dataset.area === F.area) &&
          (!ts.length || ts.some(function (t) { return my.indexOf(t) >= 0; })) &&
          (!F.only.open || card.dataset.oc === 'open') &&
          (!F.only.fsa || +card.dataset.fsa >= 4) &&
          (!F.only.v || card.dataset.v === '1');
        card.hidden = !ok; if (ok) n++;
      });
      list.querySelectorAll('.split-g').forEach(function (b) { b.hidden = !b.querySelector('.card:not([hidden])'); });
      chips.forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.area === F.area)); });
      tys.forEach(function (x) { x.setAttribute('aria-pressed', String(!!F.types[x.dataset.type])); });
      togs.forEach(function (x) { x.setAttribute('aria-pressed', String(!!F.only[x.dataset.only])); });
      if (WB.syncMap) WB.syncMap();
      if (cnt) cnt.textContent = (ts.length || Object.keys(F.only).length || F.area) ? n + (n === 1 ? ' place' : ' places') : '';
      try {
        var u = new URL(location.href);
        ['type', 'only', 'area'].forEach(function (k) { u.searchParams.delete(k); });
        if (ts.length) u.searchParams.set('type', ts.join(','));
        if (Object.keys(F.only).length) u.searchParams.set('only', Object.keys(F.only).join(','));
        if (F.area) u.searchParams.set('area', F.area);
        history.replaceState(null, '', u);
      } catch (x) {}
      // remember what's showing, so a listing can offer next / previous and "more like this"
      try {
        var cat = (document.querySelector('.ph h1') || {}).textContent || '';
        var tl = ts.map(function (t) { var b = document.querySelector('.ty[data-type="' + t + '"] .ty-l'); return b ? b.textContent : t; });
        var label = (tl.length ? tl.join(' & ') + ' ' + cat.toLowerCase() : cat) + (F.area ? ' in ' + F.area : '') + (F.only.open ? ', open now' : '');
        var slugs = [].map.call(list.querySelectorAll('.card:not([hidden])'), function (c) { return c.dataset.slug; }).filter(Boolean);
        sessionStorage.setItem('wb_ctx', JSON.stringify({ label: label.trim(), back: location.pathname + location.search, slugs: slugs.filter(function (x, i) { return slugs.indexOf(x) === i; }) }));
      } catch (x) {}
    };
    chips.forEach(function (c) { c.addEventListener('click', function () { F.area = c.dataset.area; run(); }); });
    tys.forEach(function (c) { c.addEventListener('click', function () { var t = c.dataset.type; if (F.types[t]) delete F.types[t]; else F.types[t] = 1; run(); }); });
    togs.forEach(function (c) { c.addEventListener('click', function () { var t = c.dataset.only; if (F.only[t]) delete F.only[t]; else F.only[t] = 1; run(); }); });
    WB.filterRun = run;
    run();
  }

  // maps (Leaflet + OpenStreetMap)
  function maps() {
    var el = document.getElementById('map');
    if (!el || !window.L) return;
    var pins = JSON.parse(el.dataset.pins || '[]'); if (!pins.length) return;
    var m = L.map(el, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    var icon = L.divIcon({ className: '', html: '<div style="width:22px;height:22px;border-radius:50%;background:#FF862F;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
    var marks = pins.map(function (p) { return { s: p.s, ll: [p.lat, p.lng], mk: L.marker([p.lat, p.lng], { icon: icon, title: p.n }).bindPopup('<a href="/p/' + p.s + '/">' + WB.esc(p.n) + '</a>') }; });
    var fit = function (b) { if (!b.length) return; if (b.length === 1) m.setView(b[0], 16); else m.fitBounds(b, { padding: [30, 30], maxZoom: 16 }); };
    var lst = document.getElementById('list');
    // on category pages the map only shows the places the filters leave visible
    WB.syncMap = function () {
      var b = [];
      marks.forEach(function (x) {
        var card = lst && lst.querySelector('.card[data-slug="' + x.s + '"]');
        var show = !card || !card.hidden;
        if (show) { if (!m.hasLayer(x.mk)) x.mk.addTo(m); b.push(x.ll); } else if (m.hasLayer(x.mk)) m.removeLayer(x.mk);
      });
      fit(b);
    };
    WB.syncMap();
  }
  if (document.getElementById('map')) { if (window.L) maps(); else window.addEventListener('load', maps); }

  // report anything
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-report]'); if (!t) return;
    e.preventDefault();
    var reasons = ['untrue or defamatory', 'abusive or hateful', 'fake or paid', 'personal information', 'illegal', 'other'];
    var d = document.createElement('dialog');
    d.style.cssText = 'border:0;border-radius:18px;padding:0;max-width:440px;width:92%';
    d.innerHTML = '<form class="form" method="dialog" style="padding:24px"><h3 style="font-size:22px">Report this</h3><p class="muted" style="margin:0;font-size:14px">We look at every report, and within 48 hours for anything that may be illegal or defamatory.</p>' +
      '<label>What\'s wrong?<select name="reason" required>' + reasons.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select></label>' +
      '<label>More detail (optional)<textarea name="details" rows="3" maxlength="1000"></textarea></label>' +
      '<label>Your email (optional, so we can reply)<input name="email" type="email" maxlength="200"></label>' +
      '<div style="display:flex;gap:8px"><button class="btn btn-navy" value="send">Send report</button><button class="btn btn-ghost" value="cancel">Cancel</button></div><p class="msg" role="status"></p></form>';
    document.body.appendChild(d); d.showModal();
    var f = d.querySelector('form');
    f.addEventListener('submit', function (ev) {
      if (ev.submitter && ev.submitter.value === 'cancel') return;
      ev.preventDefault();
      var fd = new FormData(f), m = f.querySelector('.msg');
      WB.rest('wb_reports', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { kind: t.dataset.report, target_id: +t.dataset.id, reason: fd.get('reason'), details: fd.get('details') || null, reporter_email: fd.get('email') || null } })
        .then(function () { m.className = 'msg ok'; m.textContent = 'Thanks, we\'ll look at it.'; setTimeout(function () { d.close(); d.remove(); }, 1400); })
        .catch(function () { m.className = 'msg err'; m.textContent = 'That didn\'t send. Please email info@woolmer.info.'; });
    });
    d.addEventListener('close', function () { d.remove(); });
  });

  // the owner's own devices are never counted: woolmer.info/?me=on sets a flag in this browser, ?me=off clears it
  try {
    var meq = new URLSearchParams(location.search).get('me');
    if (meq === 'on' || meq === 'off') {
      if (meq === 'on') localStorage.setItem('wb_me', '1'); else localStorage.removeItem('wb_me');
      var tn = document.createElement('div'); tn.className = 'me-toast'; tn.textContent = meq === 'on' ? 'This device is no longer counted in woolmer stats' : 'This device is counted again';
      document.body.appendChild(tn); setTimeout(function () { tn.remove(); }, 4000);
      history.replaceState(null, '', location.pathname);
    }
  } catch (e) {}
  WB.isMe = function () { try { return localStorage.getItem('wb_me') === '1'; } catch (e) { return false; } };
  // cookie-free page count: path + referring site only, nothing about the visitor
  try {
    var pth = location.pathname;
    if (!WB.isMe() && !/bot|crawl|spider|headless/i.test(navigator.userAgent) && navigator.doNotTrack !== '1' && !/^\/(admin|account|claim)\//.test(pth) && location.hostname === 'woolmer.info') {
      var rh = ''; try { rh = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
      WB.rest('rpc/wb_hit', { method: 'POST', body: { p_path: pth, p_ref: rh } }).catch(function () {});
    }
  } catch (e) {}
  // compact sign-up boxes on events, listings, what's on and sport
  document.querySelectorAll('.su-mini').forEach(function (f) {
    var msg = f.querySelector('.msg');
    f.addEventListener('submit', function (e) {
      e.preventDefault(); msg.className = 'msg'; msg.textContent = '';
      var d = new FormData(f); if (d.get('website')) return;
      var email = String(d.get('email') || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.className = 'msg err'; msg.textContent = 'Please enter a valid email address.'; return; }
      if (!d.get('consent')) { msg.className = 'msg err'; msg.textContent = 'Please tick the box so we can email you.'; return; }
      WB.rest('wb_signups', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { kind: 'resident', email: email, consent: true, source: (f.dataset.src || '') + ' ' + location.pathname } })
        .then(function () { f.reset(); msg.className = 'msg ok'; msg.textContent = 'Thanks, you\'re on the list. See you Thursday.'; })
        .catch(function () { msg.className = 'msg err'; msg.textContent = 'Sorry, that didn\'t go through. Please email info@woolmer.info.'; });
    });
  });
  // newsletter / business sign-up
  var f = document.getElementById('su-form');
  if (f) {
    var msg = f.querySelector('.msg'), biz = f.querySelector('.biz-only'), kind = 'resident';
    var setKind = function (k) { kind = k; biz.hidden = k !== 'business'; f.querySelectorAll('.seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.kind === k)); }); };
    f.querySelectorAll('.seg button').forEach(function (b) { b.addEventListener('click', function () { setKind(b.dataset.kind); }); });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); msg.className = 'msg'; msg.textContent = '';
      var d = new FormData(f); if (d.get('website')) return;
      var email = String(d.get('email') || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.className = 'msg err'; msg.textContent = 'Please enter a valid email address.'; return; }
      if (!d.get('consent')) { msg.className = 'msg err'; msg.textContent = 'Please tick the box so we can email you.'; return; }
      var body = { kind: kind, email: email, name: (d.get('name') || '').trim() || null, consent: true, source: 'signup ' + location.pathname };
      if (kind === 'business') { body.business_name = (d.get('business_name') || '').trim() || null; body.phone = (d.get('phone') || '').trim() || null; }
      WB.rest('wb_signups', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: body })
        .then(function () { f.reset(); setKind(kind); msg.className = 'msg ok'; msg.textContent = 'Thanks, you\'re on the list.'; })
        .catch(function () { msg.className = 'msg err'; msg.textContent = 'Sorry, that didn\'t go through. Please email info@woolmer.info.'; });
    });
  }
})();
