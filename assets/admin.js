/* woolmer admin — only works for info@dunnworks.io (database rules enforce it, this is just the screen) */
(function () {
  var root = document.getElementById('adm'), WB = window.WB, esc = WB.esc, sb, tab = location.hash.slice(1) || 'claims';
  var TABS = [['claims', 'Claims'], ['subs', 'New listings'], ['mod', 'Moderation'], ['reports', 'Reports'], ['featured', 'Featured'], ['events', "What's on"], ['walk', 'Street walk'], ['places', 'Listings'], ['signups', 'Sign-ups'], ['stats', 'Visitors'], ['alerts', 'Alerts'], ['settings', 'Settings']];
  function when(d) { return d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; }
  function err(e) { alert(String(e && e.message || e)); }
  function chk(r) { if (r.error) throw r.error; return r.data; }

  function start() {
    if (!window.supabase) return setTimeout(start, 60);
    sb = WB.client();
    WB.consumeLink(sb).then(function () { return sb.auth.getSession(); }).then(function (r) {
      var u = r.data.session && r.data.session.user;
      if (!u) return signIn();
      sb.rpc('dw_is_owner').then(function (o) {
        if (o.data !== true) { root.innerHTML = '<p>Signed in as ' + esc(u.email) + ', which isn\'t an admin. <button class="btn btn-ghost btn-sm" id="so">Sign out</button></p>'; document.getElementById('so').onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); }; return; }
        shell();
      });
    });
  }

  function signIn() {
    root.innerHTML = '<div class="panel" style="max-width:480px"><h2>Admin sign in</h2><form class="form" id="si"><label>Email<input type="email" name="email" required></label><button class="btn btn-navy" style="align-self:flex-start">Email me a link</button><p class="msg"></p></form></div>';
    var f = document.getElementById('si');
    f.onsubmit = function (e) {
      e.preventDefault();
      var m = f.querySelector('.msg');
      WB.sendLink(f.email.value.trim(), '/admin/').then(function () { m.className = 'msg ok'; m.textContent = 'Check your email and tap the link.'; })
        .catch(function (e2) { m.className = 'msg err'; m.textContent = e2.message; });
    };
  }

  function shell() {
    Promise.all([
      sb.from('wb_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      sb.from('wb_reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      sb.from('wb_questions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      sb.from('wb_answers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      sb.from('wb_reports').select('id', { count: 'exact', head: true }).eq('handled', false),
      sb.from('wb_signups').select('id', { count: 'exact', head: true }).eq('handled', false),
      sb.from('wb_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]).then(function (c) {
      var n = { subs: c[6].count, claims: c[0].count, mod: (c[1].count || 0) + (c[2].count || 0) + (c[3].count || 0), reports: c[4].count, signups: c[5].count };
      root.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><h1 style="font-size:36px;margin:0 0 14px">Admin</h1><button class="btn btn-ghost btn-sm" id="so">Sign out</button></div>' +
        '<div class="tabs">' + TABS.map(function (t) { return '<button data-t="' + t[0] + '"' + (t[0] === tab ? ' class="on"' : '') + '>' + t[1] + (n[t[0]] ? '<span class="cnt">' + n[t[0]] + '</span>' : '') + '</button>'; }).join('') + '</div><div id="pane"></div>';
      document.getElementById('so').onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); };
      root.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { tab = b.dataset.t; location.hash = tab; shell(); }; });
      ({ subs: subs, claims: claims, mod: mod, reports: reports, featured: featured, events: events, walk: walk, places: places, signups: signups, stats: stats, alerts: alerts, settings: settings })[tab]();
    });
  }
  function pane(h) { document.getElementById('pane').innerHTML = h; }
  function act(sel, fn) { document.querySelectorAll(sel).forEach(function (b) { b.onclick = function () { b.disabled = true; Promise.resolve(fn(b)).then(shell).catch(function (e) { b.disabled = false; err(e); }); }; }); }

  // ------------------------------------------------ new listings sent in by businesses
  function subs() {
    sb.from('wb_submissions').select('*').order('created_at', { ascending: false }).limit(100).then(function (r) {
      var rows = r.data || [];
      pane(rows.length ? rows.map(function (s) {
        return '<div class="item"><strong>' + esc(s.name) + '</strong> <span class="meta">' + esc(s.category) + (s.area ? ' · ' + esc(s.area) : '') + ' · ' + esc(s.status) + ' · ' + when(s.created_at) + '</span>' +
          '<p>' + esc([s.address, s.postcode].filter(Boolean).join(', ') || 'No address') + (s.phone ? ' · ' + esc(s.phone) : '') + (s.email ? ' · ' + esc(s.email) : '') + (s.website ? ' · <a href="' + esc(s.website) + '" target="_blank" rel="noopener">' + esc(s.website) + '</a>' : '') + '</p>' +
          (s.description ? '<p class="meta">' + esc(s.description) + '</p>' : '') +
          '<p class="meta">Sent by ' + esc(s.contact_name) + ' · ' + esc(s.contact_email) + (s.is_owner ? ' · says they run it' : ' · not the owner') + '</p>' +
          (s.status === 'pending' ? '<div class="acts"><button class="btn btn-navy btn-sm" data-sok="' + s.id + '">Approve and publish</button><button class="btn btn-ghost btn-sm" data-sno="' + s.id + '">Reject</button></div>'
            : s.place_id ? '<p class="meta">Listing created (goes live on the next hourly build)</p>' : '') + '</div>';
      }).join('') : '<p class="muted">No new listings sent in yet.</p>');
      act('[data-sok]', function (b) { return sb.rpc('wb_approve_submission', { p_id: +b.dataset.sok }).then(chk); });
      act('[data-sno]', function (b) { return sb.from('wb_submissions').update({ status: 'rejected' }).eq('id', +b.dataset.sno).then(chk); });
    });
  }

  // ------------------------------------------------ claims
  function claims() {
    sb.from('wb_claims').select('*,wb_places(name,slug,phone,address,postcode)').order('created_at', { ascending: false }).limit(100).then(function (r) {
      var rows = r.data || [];
      pane(rows.length ? rows.map(function (c) {
        var p = c.wb_places || {};
        return '<div class="item"><strong>' + esc(p.name) + '</strong> <span class="meta">' + esc(c.status) + ' · ' + when(c.created_at) + '</span>' +
          '<p>' + esc(c.full_name) + (c.role ? ' (' + esc(c.role) + ')' : '') + ' · ' + esc(c.email) + (c.phone ? ' · ' + esc(c.phone) : '') + '</p>' +
          (c.evidence ? '<p class="meta">' + esc(c.evidence) + '</p>' : '') +
          '<p class="meta">Listing: ' + esc([p.address, p.postcode].filter(Boolean).join(', ')) + (p.phone ? ' · public phone ' + esc(p.phone) : '') + ' · <a href="/p/' + esc(p.slug) + '/" target="_blank">view</a></p>' +
          (c.status === 'pending' ? '<div class="acts"><button class="btn btn-navy btn-sm" data-ok="' + c.id + '">Approve</button><button class="btn btn-ghost btn-sm" data-no="' + c.id + '">Reject</button></div>' : '') + '</div>';
      }).join('') : '<p class="muted">No claims yet.</p>');
      act('[data-ok]', function (b) { return sb.from('wb_claims').update({ status: 'approved' }).eq('id', +b.dataset.ok).then(chk); });
      act('[data-no]', function (b) { return sb.from('wb_claims').update({ status: 'rejected' }).eq('id', +b.dataset.no).then(chk); });
    });
  }

  // ------------------------------------------------ moderation
  function mod() {
    Promise.all([
      sb.from('wb_reviews').select('*,wb_places(name,slug)').eq('status', 'pending').order('created_at'),
      sb.from('wb_questions').select('*,wb_places(name,slug)').eq('status', 'pending').order('created_at'),
      sb.from('wb_answers').select('*,wb_questions(body)').eq('status', 'pending').order('created_at'),
    ]).then(function (r) {
      var h = '';
      (r[0].data || []).forEach(function (x) { h += item('wb_reviews', x, 'Review of ' + esc(x.wb_places && x.wb_places.name) + ' · ' + '★★★★★'.slice(0, x.rating) + (x.visited ? ' · visited ' + esc(x.visited) : '')); });
      (r[1].data || []).forEach(function (x) { h += item('wb_questions', x, 'Question' + (x.wb_places ? ' about ' + esc(x.wb_places.name) : ' for the town' + (x.topic ? ' · ' + esc(x.topic) : ''))); });
      (r[2].data || []).forEach(function (x) { h += item('wb_answers', x, (x.is_owner ? 'Owner answer' : 'Answer') + ' to: ' + esc(x.wb_questions && x.wb_questions.body)); });
      pane(h || '<p class="muted">Nothing waiting. Lovely.</p>');
      act('[data-ap]', function (b) { return sb.from(b.dataset.tbl).update({ status: 'approved' }).eq('id', +b.dataset.ap).then(chk); });
      act('[data-rj]', function (b) { var note = b.dataset.tbl === 'wb_reviews' ? prompt('Reason (kept privately, optional)') : null; var u = { status: 'rejected' }; if (note) u.mod_note = note; return sb.from(b.dataset.tbl).update(u).eq('id', +b.dataset.rj).then(chk); });
      act('[data-ban]', function (b) { if (!confirm('Suspend this user? They won\'t be able to post again.')) return Promise.reject('Cancelled'); return sb.from('wb_profiles').update({ banned: true }).eq('user_id', b.dataset.ban).then(chk).then(function () { return sb.from(b.dataset.tbl).update({ status: 'rejected' }).eq('id', +b.dataset.id).then(chk); }); });
    });
  }
  function item(tbl, x, title) {
    return '<div class="item"><strong>' + title + '</strong> <span class="meta">by ' + esc(x.display_name) + ' · ' + when(x.created_at) + '</span><p>' + esc(x.body) + '</p>' +
      '<div class="acts"><button class="btn btn-navy btn-sm" data-tbl="' + tbl + '" data-ap="' + x.id + '">Approve</button><button class="btn btn-ghost btn-sm" data-tbl="' + tbl + '" data-rj="' + x.id + '">Reject</button><button class="btn btn-ghost btn-sm" data-tbl="' + tbl + '" data-id="' + x.id + '" data-ban="' + esc(x.user_id) + '">Reject and suspend user</button></div></div>';
  }

  // ------------------------------------------------ reports
  function reports() {
    sb.from('wb_reports').select('*').order('handled').order('created_at', { ascending: false }).limit(100).then(function (r) {
      var rows = r.data || [];
      pane(rows.length ? rows.map(function (x) {
        var link = '';
        return '<div class="item"' + (x.handled ? ' style="opacity:.55"' : '') + '><strong>' + esc(x.kind) + ' ' + esc(x.target_id) + '</strong>' + link + ' <span class="meta">' + esc(x.reason) + ' · ' + when(x.created_at) + (x.reporter_email ? ' · ' + esc(x.reporter_email) : '') + '</span>' +
          (x.details ? '<p>' + esc(x.details) + '</p>' : '') +
          (x.kind === 'review' ? '<div class="acts"><button class="btn btn-ghost btn-sm" data-hide="' + esc(x.target_id) + '">Hide that review</button></div>' : '') +
          (!x.handled ? '<div class="acts"><button class="btn btn-navy btn-sm" data-done="' + x.id + '">Mark handled</button></div>' : '') + '</div>';
      }).join('') : '<p class="muted">No reports.</p>');
      act('[data-done]', function (b) { return sb.from('wb_reports').update({ handled: true }).eq('id', +b.dataset.done).then(chk); });
      act('[data-hide]', function (b) { return sb.from('wb_reviews').update({ status: 'rejected', mod_note: 'Removed after report' }).eq('id', +b.dataset.hide).then(chk); });
    });
  }

  // ------------------------------------------------ featured
  function featured() {
    sb.from('wb_places').select('id,name,slug,category,featured_until,claimed').not('featured_until', 'is', null).order('featured_until', { ascending: false }).then(function (r) {
      var today = new Date().toISOString().slice(0, 10), rows = r.data || [];
      pane('<p class="muted">Featured listings show first in their category and on the homepage, with a "Featured" label. Set the paid-up-to date after each invoice is paid. Changes go live at the next hourly rebuild.</p>' +
        '<form class="form item" id="ff"><div class="row2"><label>Listing slug (from its URL)<input name="slug" required placeholder="best-bbq-kebabs"></label><label>Featured until<input name="until" type="date" required></label></div><button class="btn btn-navy btn-sm" style="align-self:flex-start">Save</button></form>' +
        rows.map(function (p) { return '<div class="item"><strong>' + esc(p.name) + '</strong> <span class="meta">' + esc(p.category) + ' · until ' + esc(p.featured_until) + (p.featured_until < today ? ' (expired)' : '') + '</span><div class="acts"><button class="btn btn-ghost btn-sm" data-unf="' + p.id + '">Remove</button></div></div>'; }).join(''));
      var f = document.getElementById('ff');
      f.onsubmit = function (e) { e.preventDefault(); sb.from('wb_places').update({ featured_until: f.until.value }).eq('slug', f.slug.value.trim()).select('id').then(function (r2) { if (r2.error) return err(r2.error); if (!r2.data.length) return err('No listing with that slug'); shell(); }); };
      act('[data-unf]', function (b) { return sb.from('wb_places').update({ featured_until: null }).eq('id', +b.dataset.unf).then(chk); });
    });
  }

  // ------------------------------------------------ listings
  function places() {
    pane('<form class="form item" id="pf"><label>Find a listing (name or postcode)<input name="q" required></label><button class="btn btn-navy btn-sm" style="align-self:flex-start">Search</button></form><div id="pr"></div>');
    var f = document.getElementById('pf');
    f.onsubmit = function (e) {
      e.preventDefault(); var q = f.q.value.trim().replace(/[%,()]/g, '');
      sb.from('wb_places').select('id,name,slug,category,area,postcode,listable,listable_note,claimed,phone,website,menu_url').or('name.ilike.%' + q + '%,postcode.ilike.%' + q + '%').order('name').limit(40).then(function (r) {
        document.getElementById('pr').innerHTML = (r.data || []).map(function (p) {
          return '<div class="item"><strong>' + esc(p.name) + '</strong> <span class="meta">' + esc(p.category) + ' · ' + esc(p.area || '') + ' · ' + esc(p.postcode || '') + (p.claimed ? ' · claimed' : '') + ' · ' + (p.listable ? 'public' : 'hidden' + (p.listable_note ? ' (' + esc(p.listable_note) + ')' : '')) + '</span>' +
            '<div class="acts"><button class="btn btn-ghost btn-sm" data-vis="' + p.id + '" data-to="' + (!p.listable) + '">' + (p.listable ? 'Hide' : 'Make public') + '</button>' + (p.listable ? '<a class="btn btn-ghost btn-sm" href="/p/' + esc(p.slug) + '/" target="_blank">View</a>' : '') + '</div>' +
            '<details style="margin-top:8px"><summary class="linkish">Edit phone, website and menu link</summary><form class="form" data-ed="' + p.id + '" style="margin-top:8px">' +
            '<label>Phone<input name="phone" maxlength="40" value="' + esc(p.phone || '') + '"></label>' +
            '<label>Website<input name="website" type="url" maxlength="200" placeholder="https://" value="' + esc(p.website || '') + '"></label>' +
            '<label>Menu &amp; order link (own ordering site, Just Eat, Deliveroo, Uber Eats)<input name="menu_url" type="url" maxlength="300" placeholder="https://" value="' + esc(p.menu_url || '') + '"></label>' +
            '<button class="btn btn-navy btn-sm" style="align-self:flex-start">Save</button><p class="meta" data-m role="status"></p></form></details></div>';
        }).join('') || '<p class="muted">Nothing found.</p>';
        document.querySelectorAll('form[data-ed]').forEach(function (ef) {
          ef.onsubmit = function (ev) {
            ev.preventDefault(); var m = ef.querySelector('[data-m]'), mu = ef.menu_url.value.trim();
            if (mu && !/^https:\/\//.test(mu)) { m.textContent = 'Menu link must start with https://'; return; }
            m.textContent = 'Saving…';
            sb.from('wb_places').update({ phone: ef.phone.value.trim() || null, website: ef.website.value.trim() || null, menu_url: mu || null }).eq('id', +ef.dataset.ed)
              .then(function (r3) { m.textContent = r3.error ? 'Error: ' + r3.error.message : 'Saved. The site updates within the hour.'; });
          };
        });
        document.querySelectorAll('[data-vis]').forEach(function (b) { b.onclick = function () { b.disabled = true; sb.from('wb_places').update({ listable: b.dataset.to === 'true' }).eq('id', +b.dataset.vis).then(function (r2) { if (r2.error) return err(r2.error); f.requestSubmit(); }); }; });
      });
    };
  }

  // ------------------------------------------------ sign-ups
  function signups() {
    sb.from('wb_signups').select('*').order('handled').order('created_at', { ascending: false }).limit(300).then(function (r) {
      var rows = r.data || [];
      var emails = rows.filter(function (x) { return x.kind !== 'business'; }).map(function (x) { return x.email; });
      pane('<p class="muted">' + rows.length + ' sign-ups. <button class="linkish" id="cp">Copy all resident emails</button></p>' + rows.map(function (x) {
        return '<div class="item"' + (x.handled ? ' style="opacity:.55"' : '') + '><strong>' + esc(x.kind === 'business' ? (x.business_name || 'Business') : (x.name || 'Resident')) + '</strong> <span class="meta">' + esc(x.kind) + ' · ' + when(x.created_at) + '</span>' +
          '<p>' + esc(x.email) + (x.phone ? ' · ' + esc(x.phone) : '') + (x.business_type ? ' · ' + esc(x.business_type) : '') + '</p>' + (x.message ? '<p class="meta">' + esc(x.message) + '</p>' : '') +
          (!x.handled ? '<div class="acts"><button class="btn btn-ghost btn-sm" data-sd="' + x.id + '">Mark handled</button></div>' : '') + '</div>';
      }).join(''));
      document.getElementById('cp').onclick = function () { navigator.clipboard.writeText(emails.join(', ')); this.textContent = 'Copied ' + emails.length; };
      act('[data-sd]', function (b) { return sb.from('wb_signups').update({ handled: true }).eq('id', +b.dataset.sd).then(chk); });
    });
  }

  // ------------------------------------------------ visitors
  function stats() {
    var since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
    sb.from('wb_views').select('day,path,ref,n').gte('day', since).limit(20000).then(function (r) {
      if (r.error) return err(r.error);
      var rows = r.data || [], today = new Date().toISOString().slice(0, 10), wk = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
      var sum = function (f) { return rows.filter(f).reduce(function (a, x) { return a + x.n; }, 0); };
      var tally = function (key, f) { var m = {}; rows.filter(f || function () { return true; }).forEach(function (x) { m[x[key]] = (m[x[key]] || 0) + x.n; }); return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; }); };
      var days = tally('day').sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }), max = Math.max.apply(null, days.map(function (d) { return d[1]; }).concat([1]));
      var list = function (t, arr, link) { return '<div class="item"><strong>' + t + '</strong>' + (arr.length ? arr.slice(0, 15).map(function (x) { return '<p class="meta" style="display:flex;justify-content:space-between;gap:1em"><span>' + (link ? '<a href="' + esc(x[0]) + '" target="_blank">' + esc(x[0]) + '</a>' : esc(x[0] || 'Direct or unknown')) + '</span><b>' + x[1] + '</b></p>'; }).join('') : '<p class="meta">Nothing yet.</p>') + '</div>'; };
      pane('<p class="muted">Page views, counted without cookies. No visitor is identified.</p>' +
        '<div class="item"><strong>Today ' + sum(function (x) { return x.day === today; }) + ' · last 7 days ' + sum(function (x) { return x.day >= wk; }) + ' · last 30 days ' + sum(function () { return true; }) + '</strong>' +
        '<div style="display:flex;align-items:flex-end;gap:2px;height:80px;margin-top:.75em">' + days.map(function (d) { return '<div title="' + d[0] + ': ' + d[1] + '" style="flex:1;background:#1f3a5f;min-height:2px;height:' + Math.round(d[1] / max * 100) + '%"></div>'; }).join('') + '</div></div>' +
        list('Top pages, 30 days', tally('path'), true) + list('Where visitors came from', tally('ref', function (x) { return x.ref; })));
    });
  }

  // ------------------------------------------------ street walk: fill in phones and hours
  function walk() {
    var DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
    var CHAINS = /^(tesco|lidl|boots|screwfix|peacocks|morrisons|greggs|domino|betfred|coral|poundstretcher|mountain warehouse|shell|esso|jet|one stop|spar|londis|anytime fitness|b&m|budgens)/i;
    sb.from('wb_places').select('id,name,slug,category,area,address,postcode,phone,hours').eq('listable', true).order('area').order('address').then(function (r) {
      if (r.error) return err(r.error);
      var skip = { 'Parks & outdoors': 1, 'Schools': 1, 'Food & catering': 1 };
      var rows = (r.data || []).filter(function (p) { return !skip[p.category] && (!p.phone || !p.hours); });
      var street = function (p) {
        var a = String(p.address || '').replace(new RegExp('^' + p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '');
        var m = a.match(/(High Street|Chalet Hill|Pinehill Road|Forest Centre|Forest Road|Woolmer Way|Woolmer Trading Estate|Petersfield Road|Sergeants Yard|The Shed|Hardy's|Liphook Road|Forge Road|Grayshott Road|Larch Road|Mill Lane|Sutton Field|Alma Road|Budds Lane|Farnham Road|Station Road|Elmfield Court|Broxhead|Hogmoor Road|Bolley Avenue|Oakhanger Road|Arford Road|Birch Road|Churt Road|Drift Road|Wittcomb Terrace|Challenger Place|Kildare Road|Ennerdale Road|Latchford Lane|Golf Lane|Honey Lane|Eddeys Lane|Sickles Lane|Standford Lane|Frith End Road)/i);
        return m ? m[1].replace(/^the shed$/i, 'Sergeants Yard (The Shed)').replace(/^forest centre$/i, 'Pinehill Road (Forest Centre)') : 'Other / no street';
      };
      var groups = {};
      rows.forEach(function (p) { var k = (p.area || 'Elsewhere') + ' · ' + street(p); (groups[k] = groups[k] || []).push(p); });
      var keys = Object.keys(groups).sort();
      var chainN = rows.filter(function (p) { return CHAINS.test(p.name); }).length;
      pane('<p class="muted">' + rows.length + ' places are missing a phone number or opening hours, grouped by street so you can do one area per walk. Big chains (' + chainN + ') are marked: their hours are on their own websites, so skip them on the walk. Tap a place to fill it in; it saves straight to the site.</p>' +
        '<p><button class="btn btn-ghost btn-sm" type="button" id="wk-print">Print checklist</button> <label style="display:inline-flex;gap:6px;align-items:center;margin-left:10px"><input type="checkbox" id="wk-chains" style="width:auto"> Show chains</label></p>' +
        '<style>@media print{header,.tabbar,.install,#evstrip,.adm-tabs,nav,#wk-print,#wk-chains,label[for],.wk-form,details summary::marker{display:none!important}.wk-item{break-inside:avoid;border-bottom:1px solid #ccc;padding:6px 0}.wk-box{display:inline-block!important}}.wk-box{display:none;width:12px;height:12px;border:1px solid #333;margin-right:6px}.wk-chain{opacity:.55}.wk-tag{font-size:11px;font-weight:700;border-radius:999px;padding:1px 7px;margin-left:6px;background:#FDECE4;color:#B13A0A}</style>' +
        keys.map(function (k) {
          return '<h3 style="margin:1.4em 0 .4em">' + esc(k) + ' <span class="meta">(' + groups[k].length + ')</span></h3>' + groups[k].map(function (p) {
            var chain = CHAINS.test(p.name);
            return '<details class="item wk-item' + (chain ? ' wk-chain' : '') + '"' + (chain ? ' data-chain hidden' : '') + '><summary style="cursor:pointer"><span class="wk-box"></span><strong>' + esc(p.name) + '</strong>' + (!p.phone ? '<span class="wk-tag">phone</span>' : '') + (!p.hours ? '<span class="wk-tag">hours</span>' : '') + (chain ? ' <span class="meta">chain</span>' : '') +
              '<br><span class="meta">' + esc([p.address, p.postcode].filter(Boolean).join(', ')) + ' · ' + esc(p.category) + '</span></summary>' +
              '<form class="form wk-form" data-wk="' + p.id + '" style="margin-top:10px">' +
              '<label>Phone<input name="phone" inputmode="tel" maxlength="40" value="' + esc(p.phone || '') + '"></label>' +
              '<p class="meta" style="margin:4px 0 0">Hours like 09:00-17:30. Two sessions: 11:30-14:00,17:00-23:00. Leave blank if closed that day.</p>' +
              '<div style="display:grid;grid-template-columns:44px 1fr;gap:6px 10px;align-items:center">' + DAYS.map(function (d) {
                var v = p.hours && p.hours[d[0]] && !/closed/i.test(p.hours[d[0]]) ? p.hours[d[0]] : '';
                return '<span>' + d[1] + '</span><input name="h_' + d[0] + '" maxlength="40" placeholder="Closed" value="' + esc(v) + '">';
              }).join('') + '</div>' +
              '<div class="acts"><button class="btn btn-ghost btn-sm" type="button" data-copy>Copy Mon to Tue–Sat</button><button class="btn btn-navy btn-sm" type="submit">Save</button><button class="btn btn-ghost btn-sm" type="button" data-gone>Closed down</button></div><p class="meta" data-m role="status"></p></form></details>';
          }).join('');
        }).join(''));
      document.getElementById('wk-print').onclick = function () { root.querySelectorAll('details.wk-item').forEach(function (d) { d.open = false; }); window.print(); };
      document.getElementById('wk-chains').onchange = function () { var on = this.checked; root.querySelectorAll('[data-chain]').forEach(function (d) { d.hidden = !on; }); };
      var okTime = /^(\d{1,2}:\d{2}-\d{1,2}:\d{2})(,\s*\d{1,2}:\d{2}-\d{1,2}:\d{2})*$/;
      root.querySelectorAll('form[data-wk]').forEach(function (f) {
        f.querySelector('[data-copy]').onclick = function () { ['tue', 'wed', 'thu', 'fri', 'sat'].forEach(function (d) { f['h_' + d].value = f.h_mon.value; }); };
        f.querySelector('[data-gone]').onclick = function () {
          if (!confirm('Hide this listing because it has closed down? You can make it public again from Listings.')) return;
          sb.from('wb_places').update({ listable: false, listable_note: 'Closed down (street walk ' + new Date().toISOString().slice(0, 10) + ')' }).eq('id', +f.dataset.wk).then(function (r2) { if (r2.error) return err(r2.error); f.closest('details').remove(); });
        };
        f.onsubmit = function (ev) {
          ev.preventDefault(); var m = f.querySelector('[data-m]'), h = {}, any = false, bad = '';
          DAYS.forEach(function (d) { var v = f['h_' + d[0]].value.trim().replace(/\s*-\s*/g, '-').replace(/\./g, ':'); if (v && !okTime.test(v)) bad = d[1]; h[d[0]] = v || 'Closed'; if (v) any = true; });
          if (bad) { m.textContent = 'Check ' + bad + ': use 24-hour times like 09:00-17:30'; return; }
          m.textContent = 'Saving…';
          sb.from('wb_places').update({ phone: f.phone.value.trim() || null, hours: any ? h : null }).eq('id', +f.dataset.wk).then(function (r3) {
            if (r3.error) { m.textContent = 'Error: ' + r3.error.message; return; }
            m.textContent = 'Saved. Live on the site within the hour.'; f.closest('details').style.opacity = '.5';
          });
        };
      });
    });
  }

  // ------------------------------------------------ what's on (events)
  function events() {
    var KINDS = ['Live music', 'Quiz', 'Comedy', 'Theatre', 'Film', 'Dance', 'Family', 'Market', 'Food & drink', 'Sport', 'Workshop', 'Community', 'Other'];
    var since = new Date(Date.now() - 30 * 864e5).toISOString();
    Promise.all([
      sb.from('wb_events').select('*').gte('starts_at', since).order('starts_at'),
      sb.from('wb_places').select('id,name,area').eq('listable', true).order('name')
    ]).then(function (res) {
      if (res[0].error) return err(res[0].error);
      var evs = res[0].data || [], places = res[1].data || [], byId = {}, byName = {};
      places.forEach(function (p) { byId[p.id] = p; byName[p.name.toLowerCase()] = p; });
      var now = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var dIn = function (iso) { var d = new Date(iso); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
      var tIn = function (iso) { var d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
      var label = function (e) { var d = new Date(e.starts_at); return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + tIn(e.starts_at) + (e.ends_at ? '–' + tIn(e.ends_at) : ''); };
      var endOf = function (e) { return e.ends_at ? new Date(e.ends_at) : new Date(new Date(e.starts_at).getTime() + 3 * 36e5); };
      var up = evs.filter(function (e) { return endOf(e) > now; }), past = evs.filter(function (e) { return endOf(e) <= now; }).reverse();
      var row = function (e) {
        var v = e.place_id && byId[e.place_id] ? byId[e.place_id].name : (e.venue || '');
        return '<div class="item"><strong>' + esc(e.title) + '</strong>' + (e.published ? '' : ' <span class="meta">(hidden)</span>') +
          '<p class="meta">' + esc(label(e)) + (v ? ' · ' + esc(v) : '') + (e.kind ? ' · ' + esc(e.kind) : '') + (e.price ? ' · ' + esc(e.price) : '') + '</p>' +
          '<div class="acts"><button class="btn btn-ghost btn-sm" data-ed="' + e.id + '">Edit</button><button class="btn btn-ghost btn-sm" data-dup="' + e.id + '">Copy to next week</button><button class="btn btn-ghost btn-sm" data-del="' + e.id + '">Delete</button></div></div>';
      };
      pane('<p class="muted">Events show in the strip at the top of every page, on the home page and at <a href="/whats-on/" target="_blank">/whats-on/</a>. The strip updates straight away; the home and What\'s on pages refresh within the hour for Google.</p>' +
        '<form class="form item" id="evf"><strong id="evf-h">Add an event</strong><input type="hidden" name="id">' +
        '<label>Event name<input name="title" maxlength="90" required placeholder="Quiz night"></label>' +
        '<label>Venue (pick a listing, or type any place)<input name="venue" list="ev-places" maxlength="120" placeholder="The Holly Bush"></label><datalist id="ev-places">' + places.map(function (p) { return '<option value="' + esc(p.name) + '">' + esc(p.area || '') + '</option>'; }).join('') + '</datalist>' +
        '<div class="row2"><label>Date<input name="date" type="date" required></label><label>Type<select name="kind"><option value="">Choose…</option>' + KINDS.map(function (k) { return '<option>' + k + '</option>'; }).join('') + '</select></label></div>' +
        '<div class="row2"><label>Starts<input name="start" type="time" required value="19:30"></label><label>Ends (optional)<input name="end" type="time"></label></div>' +
        '<div class="row2"><label>Price (optional)<input name="price" maxlength="40" placeholder="Free, £5 on the door"></label><label>Link (optional)<input name="url" type="url" maxlength="300" placeholder="https://"></label></div>' +
        '<label>Details (optional)<textarea name="details" maxlength="600" rows="3" placeholder="Teams of up to 6, cash prizes, food from 6pm"></textarea></label>' +
        '<div class="row2"><label>Repeat weekly for<select name="rep"><option value="0">Just this once</option>' + [1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(function (n) { return '<option value="' + n + '">' + (n + 1) + ' weeks in total</option>'; }).join('') + '</select></label><label style="flex-direction:row;align-items:center;gap:8px"><input name="pub" type="checkbox" checked style="width:auto"> Show on the site</label></div>' +
        '<div class="acts"><button class="btn btn-navy btn-sm" type="submit">Save event</button><button class="btn btn-ghost btn-sm" type="button" id="evf-new" hidden>Cancel edit</button></div><p class="meta" id="evf-msg" role="status"></p></form>' +
        '<h3 style="margin:1.5em 0 .5em">Coming up (' + up.length + ')</h3>' + (up.length ? up.map(row).join('') : '<p class="muted">Nothing booked in yet.</p>') +
        (past.length ? '<h3 style="margin:1.5em 0 .5em">Last 30 days</h3>' + past.map(row).join('') : ''));
      var f = document.getElementById('evf'), msg = document.getElementById('evf-msg');
      var find = function (id) { return evs.filter(function (e) { return e.id === id; })[0]; };
      var fill = function (e, shiftDays) {
        var s = new Date(new Date(e.starts_at).getTime() + (shiftDays || 0) * 864e5), en = e.ends_at ? new Date(new Date(e.ends_at).getTime() + (shiftDays || 0) * 864e5) : null;
        f.id.value = shiftDays ? '' : e.id; f.title.value = e.title; f.venue.value = e.place_id && byId[e.place_id] ? byId[e.place_id].name : (e.venue || '');
        f.date.value = dIn(s.toISOString()); f.start.value = tIn(s.toISOString()); f.end.value = en ? tIn(en.toISOString()) : '';
        f.kind.value = e.kind || ''; f.price.value = e.price || ''; f.url.value = e.url || ''; f.details.value = e.details || ''; f.pub.checked = e.published; f.rep.value = '0';
        document.getElementById('evf-h').textContent = shiftDays ? 'Copy of "' + e.title + '" for next week' : 'Edit event';
        document.getElementById('evf-new').hidden = false; f.scrollIntoView({ behavior: 'smooth' }); f.title.focus();
      };
      document.getElementById('evf-new').onclick = function () { shell(); };
      root.querySelectorAll('[data-ed]').forEach(function (b) { b.onclick = function () { fill(find(b.dataset.ed)); }; });
      root.querySelectorAll('[data-dup]').forEach(function (b) { b.onclick = function () { fill(find(b.dataset.dup), 7); }; });
      root.querySelectorAll('[data-del]').forEach(function (b) {
        b.onclick = function () {
          var e = find(b.dataset.del);
          if (!confirm('Delete "' + e.title + '" on ' + label(e) + '? This cannot be undone.')) return;
          sb.from('wb_events').delete().eq('id', e.id).then(function (r) { if (r.error) return err(r.error); shell(); });
        };
      });
      f.onsubmit = function (ev) {
        ev.preventDefault();
        var start = new Date(f.date.value + 'T' + f.start.value), end = null;
        if (f.end.value) { end = new Date(f.date.value + 'T' + f.end.value); if (end <= start) end = new Date(end.getTime() + 864e5); }
        var pl = byName[f.venue.value.trim().toLowerCase()];
        var base = { title: f.title.value.trim(), place_id: pl ? pl.id : null, venue: pl ? null : (f.venue.value.trim() || null), kind: f.kind.value || null, price: f.price.value.trim() || null, url: f.url.value.trim() || null, details: f.details.value.trim() || null, published: f.pub.checked };
        var rows = [], reps = f.id.value ? 0 : +f.rep.value;
        for (var w = 0; w <= reps; w++) rows.push(Object.assign({}, base, { starts_at: new Date(start.getTime() + w * 7 * 864e5).toISOString(), ends_at: end ? new Date(end.getTime() + w * 7 * 864e5).toISOString() : null }));
        msg.textContent = 'Saving…';
        var q = f.id.value ? sb.from('wb_events').update(rows[0]).eq('id', f.id.value) : sb.from('wb_events').insert(rows);
        q.then(function (r) { if (r.error) { msg.textContent = ''; return err(r.error); } shell(); });
      };
    });
  }

  // ------------------------------------------------ app alerts
  function alerts() {
    sb.from('wb_push_subs').select('id,created_at', { count: 'exact', head: true }).then(function (r) {
      var n = r.count || 0;
      pane('<p class="muted">' + n + ' phone' + (n === 1 ? '' : 's') + ' have turned alerts on in the woolmer app. Keep it to one or two a week, or people turn them off.</p>' +
        '<form class="form item" id="al"><label>Title (up to 60 characters)<input name="title" maxlength="60" required placeholder="New on woolmer"></label>' +
        '<label>Message (up to 180 characters)<textarea name="body" maxlength="180" rows="3" required placeholder="Tap @ the Shed has live music this Saturday from 8pm."></textarea></label>' +
        '<label>Opens this page when tapped<input name="url" value="/" placeholder="/p/tap-at-the-shed/"></label>' +
        '<div class="acts"><button class="btn btn-ghost btn-sm" type="button" id="al-test">Send to this phone only</button><button class="btn btn-navy btn-sm" type="submit">Send to everyone</button></div>' +
        '<p class="meta" id="al-msg" role="status"></p></form>');
      var f = document.getElementById('al'), msg = document.getElementById('al-msg');
      var send = function (kind, endpoint) {
        msg.textContent = 'Sending…';
        return sb.functions.invoke('wb-push', { body: { kind: kind, title: f.title.value, body: f.body.value, url: f.url.value.trim() || '/', endpoint: endpoint } }).then(function (res) {
          if (res.error) throw res.error;
          var d = res.data || {}; msg.textContent = 'Sent to ' + (d.sent || 0) + ' phone' + (d.sent === 1 ? '' : 's') + (d.removed ? ', removed ' + d.removed + ' that had turned alerts off' : '') + (d.failed ? ', ' + d.failed + ' failed' : '') + '.';
        }).catch(function (e) { msg.textContent = ''; err(e); });
      };
      document.getElementById('al-test').onclick = function () {
        if (!f.reportValidity()) return;
        if (!('serviceWorker' in navigator)) return err('Open admin in the woolmer app on your phone to test.');
        navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (s) {
          if (!s) return err('Turn alerts on for this phone first: Saved tab, then Turn alerts on.');
          send('test', s.endpoint);
        });
      };
      f.onsubmit = function (e) {
        e.preventDefault();
        if (!confirm('Send this alert to ' + n + ' phone' + (n === 1 ? '' : 's') + '?')) return;
        send('send');
      };
    });
  }

  // ------------------------------------------------ settings
  function settings() {
    sb.from('wb_settings').select('key,value').then(function (r) {
      var s = {}; (r.data || []).forEach(function (x) { s[x.key] = x.value; });
      var on = s.reviews_enabled === true;
      pane('<div class="item"><strong>Reviews and Q&amp;A</strong> <span class="meta">currently ' + (on ? 'ON' : 'OFF') + '</span><p class="meta">Only switch on once the legal pack has been checked by a solicitor and the sign-in email (custom SMTP) is set up.</p><div class="acts"><button class="btn ' + (on ? 'btn-ghost' : 'btn-navy') + ' btn-sm" id="tg">' + (on ? 'Switch off' : 'Switch on') + '</button></div></div>' +
        '<form class="item form" id="pr"><label>Featured price, £ a month<input name="p" type="number" min="0" step="1" value="' + esc(s.featured_price_gbp) + '"></label><button class="btn btn-navy btn-sm" style="align-self:flex-start">Save</button></form>');
      document.getElementById('tg').onclick = function () {
        if (!on && !confirm('Open reviews and questions to the public?')) return;
        sb.from('wb_settings').upsert({ key: 'reviews_enabled', value: !on }).then(function (r2) { if (r2.error) return err(r2.error); shell(); });
      };
      var f = document.getElementById('pr');
      f.onsubmit = function (e) { e.preventDefault(); sb.from('wb_settings').upsert({ key: 'featured_price_gbp', value: +f.p.value }).then(function (r2) { if (r2.error) return err(r2.error); shell(); }); };
    });
  }

  start();
})();
