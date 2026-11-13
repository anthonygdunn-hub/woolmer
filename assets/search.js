/* woolmer — search over places.json */
(function () {
  var f = document.getElementById('s-form'), q = document.getElementById('s-q'), out = document.getElementById('s-results'), count = document.getElementById('s-count');
  if (!f) return;
  var data = [], WB = window.WB;
  var syn = { chippy: 'fish chips', chinese: 'chinese wok china', indian: 'indian curry spice', pizza: 'pizza', pub: 'pub bar inn arms', coffee: 'coffee cafe', cafe: 'cafe coffee', supermarket: 'supermarket tesco lidl', kebab: 'kebab bbq', hairdresser: 'hair beauty', barber: 'hair beauty', hair: 'hair beauty', nails: 'nails beauty', doctor: 'surgery health', gp: 'surgery health', dentist: 'dentist dental', vet: 'veterinary vet', garage: 'motoring auto', mot: 'motoring auto', petrol: 'fuel shell esso jet', gym: 'fitness sport', solicitor: 'solicitors services' };
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' '); };
  function run() {
    var term = norm(q.value).trim();
    history.replaceState(null, '', term ? '?q=' + encodeURIComponent(q.value.trim()) : location.pathname);
    if (!term) { out.innerHTML = ''; count.textContent = data.length + ' places. Start typing to search.'; return; }
    var words = term.split(/\s+/).map(function (w) { return syn[w] ? syn[w].split(' ').concat(w) : [w]; });
    var res = data.map(function (p) {
      var hay = norm([p.n, p.c, p.a, p.t, p.d].join(' ')), name = norm(p.n), score = 0;
      var ok = words.every(function (alts) { return alts.some(function (w) { if (name.indexOf(w) > -1) { score += 3; return true; } if (hay.indexOf(w) > -1) { score += 1; return true; } return false; }); });
      return ok ? { p: p, s: score + p.f * 2 + p.v } : null;
    }).filter(Boolean).sort(function (a, b) { return b.s - a.s || a.p.n.localeCompare(b.p.n); });
    count.textContent = res.length ? res.length + ' result' + (res.length > 1 ? 's' : '') : 'Nothing found. Try a shorter word, or tell us what\'s missing at info@woolmer.info.';
    out.innerHTML = res.slice(0, 60).map(function (r) {
      var p = r.p;
      return '<a class="card" href="/p/' + p.s + '/"><div class="art"><span class="initial" aria-hidden="true">' + WB.esc(p.n.replace(/^the\s+/i, '')[0] || '') + '</span>' + (p.f ? '<span class="badge badge-f">Featured</span>' : p.v ? '<span class="badge badge-v">Owner-verified</span>' : '') + '</div><div class="body"><h3>' + WB.esc(p.n) + '</h3><span class="meta">' + WB.esc([p.c, p.a].filter(Boolean).join(' · ')) + '</span>' + (/^[0-5]$/.test(p.h || '') ? '<div class="tags"><span class="fsa"><i class="' + (+p.h <= 2 ? 'lo' : '') + '">' + p.h + '</i>Food hygiene rating</span></div>' : '') + '</div></a>';
    }).join('');
  }
  fetch('/places.json').then(function (r) { return r.json(); }).then(function (d) {
    data = d; q.value = new URLSearchParams(location.search).get('q') || ''; run(); q.focus();
  });
  q.addEventListener('input', run);
  f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
})();
