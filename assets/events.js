/* woolmer: live events strip, home "What's on" and the What's on page */
(function () {
  'use strict';
  var WB = window.WB || {}, TZ = 'Europe/London';
  var strip = document.getElementById('evstrip');
  var homeList = document.getElementById('wo-list');
  var allList = document.getElementById('wo-all');
  if (/^\/(admin|claim)\//.test(location.pathname)) return;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function f(d, o) { o.timeZone = TZ; return new Intl.DateTimeFormat('en-GB', o).format(new Date(d)); }
  function day(d) { return f(d, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-'); }
  function hm(d) { return f(d, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(':00', '').replace(' ', ''); }
  function end(e) { return e.ends_at ? new Date(e.ends_at) : new Date(new Date(e.starts_at).getTime() + 3 * 36e5); }
  function when(e) { if (f(e.starts_at, { hour: '2-digit', minute: '2-digit', hour12: false }) === '00:00') return 'Times vary'; return hm(e.starts_at) + (e.ends_at ? '–' + hm(e.ends_at) : ''); }
  var HOME = [51.1125, -0.862], LOCAL_MI = 5;
  function miles(e) {
    var la = e.lat != null ? e.lat : e.place && e.place.lat, lo = e.lng != null ? e.lng : e.place && e.place.lng;
    if (la == null || lo == null) return 0;
    var r = Math.PI / 180, dLa = (la - HOME[0]) * r, dLo = (lo - HOME[1]) * r;
    var a = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(HOME[0] * r) * Math.cos(la * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  var TAGS = { free: ['Free', 'g'], kids: ['Good for kids', 't'], christmas: ['Christmas', 'r'], outdoor: ['Outdoors', 'g'], indoor: ['Indoors', 'n'], dogs: ['Dog friendly', 't'], access: ['Step-free', 'n'], book: ['Book ahead', 'o'], adults: ['Adults only', 'n'] };
  function tagList(e) {
    var t = {}; (e.tags || []).forEach(function (k) { t[k] = 1; });
    if (/^\s*free\b|free entry|\bfree\s*$/i.test(e.price || '')) t.free = 1;
    if (e.kind === 'Family') t.kids = 1;
    if (t.adults) delete t.kids;
    return Object.keys(TAGS).filter(function (k) { return t[k]; });
  }
  function tagsHtml(e) { var l = tagList(e); return l.length ? '<p class="ev-tags">' + l.map(function (k) { return '<span class="evt evt-' + TAGS[k][1] + '">' + TAGS[k][0] + '</span>'; }).join('') + '</p>' : ''; }
  function slugify(x) { return String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function path(e) { return '/whats-on/' + slugify(e.title).slice(0, 60) + '-' + day(e.starts_at) + '-' + String(e.id).slice(0, 4) + '/'; }
  function local(e) { return miles(e) <= LOCAL_MI; }
  var now = new Date(), today = day(now), tomorrow = day(new Date(now.getTime() + 864e5));

  function flag(e) {
    var s = new Date(e.starts_at);
    if (s <= now && end(e) > now) return 'On now';
    var d = day(s);
    if (d === today) return +f(s, { hour: 'numeric', hour12: false }) >= 17 ? 'Tonight' : 'Today';
    if (d === tomorrow) return 'Tomorrow';
    return '';
  }

  function card(e) {
    var venue = e.place ? '<a href="/p/' + esc(e.place.slug) + '/">' + esc(e.place.name) + '</a>' : esc(e.venue || ''), fl = flag(e);
    var mi = miles(e), far = mi > LOCAL_MI ? '<span class="ev-far">' + Math.round(mi) + ' miles' + (e.town ? ' · ' + esc(e.town) : '') + '</span>' : '';
    return '<article class="ev' + (fl === 'On now' ? ' ev-live' : '') + '" data-day="' + day(e.starts_at) + '" data-mi="' + Math.round(mi) + '" data-tags="' + tagList(e).join(' ') + '" data-start="' + esc(e.starts_at) + '">' +
      '<div class="ev-date"><span>' + f(e.starts_at, { weekday: 'short' }) + '</span><b>' + f(e.starts_at, { day: 'numeric' }) + '</b><span>' + f(e.starts_at, { month: 'short' }) + '</span></div>' +
      '<div class="ev-body"><p class="ev-when">' + (fl ? '<span class="ev-flag">' + fl + '</span>' : '') + far + when(e) + (e.kind ? ' · ' + esc(e.kind) : '') + '</p>' +
      '<h3><a href="' + path(e) + '">' + esc(e.title) + '</a></h3>' + tagsHtml(e) +
      (venue ? '<p class="ev-venue">' + venue + '</p>' : '') + (e.details ? '<p class="ev-det">' + esc(e.details) + '</p>' : '') + (e.price ? '<p class="ev-price">' + esc(e.price) + '</p>' : '') +
      '</div></article>';
  }

  function load() {
    var cols = 'id,title,place_id,venue,starts_at,ends_at,details,price,url,kind,lat,lng,town,tags,wb_places(slug,name,lat,lng)';
    var since = new Date(Date.now() - 864e5).toISOString();
    var live = WB.url ? fetch(WB.url + '/rest/v1/wb_events?select=' + cols + '&published=eq.true&starts_at=gte.' + encodeURIComponent(since) + '&order=starts_at&limit=1000', { headers: { apikey: WB.key, Authorization: 'Bearer ' + WB.key } })
      .then(function (r) { if (!r.ok) throw r; return r.json(); })
      .then(function (rows) { return rows.map(function (e) { e.place = e.wb_places || null; delete e.wb_places; return e; }); }) : Promise.reject();
    return live.catch(function () { return fetch('/events.json').then(function (r) { return r.ok ? r.json() : []; }); })
      .then(function (rows) { return (rows || []).filter(function (e) { return end(e) > now; }).sort(function (a, b) { return a.starts_at < b.starts_at ? -1 : 1; }); })
      .catch(function () { return []; });
  }

  function renderStrip(evs) {
    if (!strip) return;
    var weekOut = new Date(now.getTime() + 7 * 864e5);
    var pick = evs.filter(function (e) { return flag(e) === 'On now'; });
    pick = pick.concat(evs.filter(function (e) { var fl = flag(e); return fl === 'Tonight' || fl === 'Today'; }));
    if (!pick.length) pick = evs.filter(function (e) { return new Date(e.starts_at) < weekOut; }).slice(0, 3);
    pick = pick.slice(0, 6);
    if (!pick.length) return;
    var sig = pick.map(function (e) { return e.id; }).join(',');
    try { if (sessionStorage.getItem('wb_ev_hide') === sig) return; } catch (x) {}
    var items = pick.map(function (e) {
      var fl = flag(e) || f(e.starts_at, { weekday: 'short', day: 'numeric', month: 'short' });
      var where = e.place ? e.place.name : (e.venue || '');
      return '<a class="es-item" href="' + path(e) + '"><span class="es-flag' + (fl === 'On now' ? ' es-live' : '') + '">' + esc(fl) + '</span><b>' + esc(e.title) + '</b><span class="es-meta">' + esc(when(e)) + (where ? ' · ' + esc(where) : '') + '</span></a>';
    });
    strip.innerHTML = '<div class="wrap"><span class="es-label"><i aria-hidden="true"></i>What\'s on</span><div class="es-track" aria-live="polite">' + items.join('') + '</div><a class="es-all" href="/whats-on/">All events</a><button class="es-x" type="button" aria-label="Hide events">×</button></div>';
    strip.hidden = false;
    var els = strip.querySelectorAll('.es-item'), i = 0;
    els[0].classList.add('on');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (els.length > 1 && !reduce) setInterval(function () { els[i].classList.remove('on'); i = (i + 1) % els.length; els[i].classList.add('on'); }, 5000);
    strip.querySelector('.es-x').onclick = function () { strip.hidden = true; try { sessionStorage.setItem('wb_ev_hide', sig); } catch (x) {} };
  }

  function renderHome(evs) {
    if (!homeList) return;
    var sec = document.getElementById('wo-home'), n = +homeList.dataset.limit || 6;
    homeList.innerHTML = evs.slice(0, n).map(card).join('');
    sec.hidden = !evs.length;
  }

  function renderAll(evs) {
    if (!allList) return;
    var days = [];
    evs.forEach(function (e) { var d = day(e.starts_at); if (days.indexOf(d) < 0) days.push(d); });
    allList.innerHTML = days.map(function (d) {
      return '<div class="wo-day" data-day="' + d + '"><h2 class="wo-h">' + f(d + 'T12:00:00Z', { weekday: 'long', day: 'numeric', month: 'long' }) + '</h2><div class="evs">' +
        evs.filter(function (e) { return day(e.starts_at) === d; }).map(card).join('') + '</div></div>';
    }).join('');
    var none = document.getElementById('wo-none');
    var btns = document.querySelectorAll('.wo-filter [data-f]'), dbtns = document.querySelectorAll('.wo-dist [data-d]');
    var cur = 'all', dist = 30, only = {}, tbtns = document.querySelectorAll('.wo-dist [data-t]');
    try { var sd = +localStorage.getItem('wb_ev_dist'); if ([5, 10, 15, 20, 25, 30].indexOf(sd) >= 0) dist = sd; } catch (x) {}
    try {
      var qs = new URLSearchParams(location.search), qm = +qs.get('miles');
      if ([5, 10, 15, 20, 25, 30].indexOf(qm) >= 0) dist = qm;
      (qs.get('only') || '').split(',').forEach(function (t) { if (t === 'free' || t === 'kids') only[t] = 1; });
      if (['today', 'weekend', 'week'].indexOf(qs.get('when')) >= 0) cur = qs.get('when');
    } catch (x) {}
    var apply = function (k) {
      k = k || cur; cur = k;
      var wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(f(now, { weekday: 'short' }));
      var fri = day(new Date(now.getTime() + Math.max(0, 4 - wd) * 864e5)), sun = day(new Date(now.getTime() + (6 - wd) * 864e5));
      var wk = day(new Date(now.getTime() + 6 * 864e5)), shown = 0;
      allList.querySelectorAll('.wo-day').forEach(function (el) {
        var d = el.dataset.day, ok = k === 'all' || (k === 'today' && d === today) || (k === 'week' && d <= wk) || (k === 'weekend' && d >= fri && d <= sun);
        var any = 0;
        el.querySelectorAll('.ev').forEach(function (c) { var tg = (c.dataset.tags || '').split(' '), v = ok && +c.dataset.mi <= dist && Object.keys(only).every(function (t) { return tg.indexOf(t) >= 0; }); c.hidden = !v; if (v) any++; });
        el.hidden = !any; if (any) shown++;
      });
      none.hidden = !!shown;
      none.innerHTML = evs.length ? (dist < 30 || Object.keys(only).length ? 'Nothing matches for those dates yet. Try a wider distance or fewer filters.' : 'Nothing on for those dates yet.') : 'Nothing listed yet. Running something? Email <a href="mailto:info@woolmer.info">info@woolmer.info</a> and we\'ll add it free.';
      btns.forEach(function (b) { b.classList.toggle('on', b.dataset.f === k); b.setAttribute('aria-pressed', b.dataset.f === k); });
      tbtns.forEach(function (b) { b.classList.toggle('on', !!only[b.dataset.t]); b.setAttribute('aria-pressed', !!only[b.dataset.t]); });
      dbtns.forEach(function (b) { b.classList.toggle('on', +b.dataset.d === dist); b.setAttribute('aria-pressed', +b.dataset.d === dist); });
    };
    btns.forEach(function (b) { b.onclick = function () { apply(b.dataset.f); }; });
    tbtns.forEach(function (b) { b.onclick = function () { if (only[b.dataset.t]) delete only[b.dataset.t]; else only[b.dataset.t] = 1; apply(); }; });
    dbtns.forEach(function (b) { b.onclick = function () { dist = +b.dataset.d; try { localStorage.setItem('wb_ev_dist', dist); } catch (x) {} apply(); }; });
    apply(cur);
  }

  function go() { var P = load(); window.WB = window.WB || {}; WB.eventsP = P; P.then(function (evs) { var near = evs.filter(local); renderStrip(near); renderHome(near); renderAll(evs); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
