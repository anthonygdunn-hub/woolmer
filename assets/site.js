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
  window.WB = WB;

  // mobile menu
  var btn = document.querySelector('.menu-btn'), nav = document.getElementById('nav');
  if (btn && nav) btn.addEventListener('click', function () { var o = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', String(o)); });

  // area filter on category pages
  var chips = document.querySelectorAll('.chip-l[data-area]'), list = document.getElementById('list');
  if (chips.length && list) chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); });
      var a = c.dataset.area;
      list.querySelectorAll('.card').forEach(function (card) { card.hidden = !!a && card.dataset.area !== a; });
    });
  });

  // maps (Leaflet + OpenStreetMap)
  function maps() {
    var el = document.getElementById('map');
    if (!el || !window.L) return;
    var pins = JSON.parse(el.dataset.pins || '[]'); if (!pins.length) return;
    var m = L.map(el, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    var icon = L.divIcon({ className: '', html: '<div style="width:22px;height:22px;border-radius:50%;background:#FF862F;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
    var b = [];
    pins.forEach(function (p) { L.marker([p.lat, p.lng], { icon: icon, title: p.n }).addTo(m).bindPopup('<a href="/p/' + p.s + '/">' + WB.esc(p.n) + '</a>'); b.push([p.lat, p.lng]); });
    if (b.length === 1) m.setView(b[0], 16); else m.fitBounds(b, { padding: [30, 30] });
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
      var body = { kind: kind, email: email, name: (d.get('name') || '').trim() || null, consent: true };
      if (kind === 'business') { body.business_name = (d.get('business_name') || '').trim() || null; body.phone = (d.get('phone') || '').trim() || null; }
      WB.rest('wb_signups', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: body })
        .then(function () { f.reset(); setKind(kind); msg.className = 'msg ok'; msg.textContent = 'Thanks, you\'re on the list.'; })
        .catch(function () { msg.className = 'msg err'; msg.textContent = 'Sorry, that didn\'t go through. Please email info@woolmer.info.'; });
    });
  }
})();
