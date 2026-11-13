/* woolmer admin — only works for info@dunnworks.io (database rules enforce it, this is just the screen) */
(function () {
  var root = document.getElementById('adm'), WB = window.WB, esc = WB.esc, sb, tab = location.hash.slice(1) || 'claims';
  var TABS = [['claims', 'Claims'], ['mod', 'Moderation'], ['reports', 'Reports'], ['featured', 'Featured'], ['places', 'Listings'], ['signups', 'Sign-ups'], ['stats', 'Visitors'], ['alerts', 'Alerts'], ['settings', 'Settings']];
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
    ]).then(function (c) {
      var n = { claims: c[0].count, mod: (c[1].count || 0) + (c[2].count || 0) + (c[3].count || 0), reports: c[4].count, signups: c[5].count };
      root.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><h1 style="font-size:36px;margin:0 0 14px">Admin</h1><button class="btn btn-ghost btn-sm" id="so">Sign out</button></div>' +
        '<div class="tabs">' + TABS.map(function (t) { return '<button data-t="' + t[0] + '"' + (t[0] === tab ? ' class="on"' : '') + '>' + t[1] + (n[t[0]] ? '<span class="cnt">' + n[t[0]] + '</span>' : '') + '</button>'; }).join('') + '</div><div id="pane"></div>';
      document.getElementById('so').onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); };
      root.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { tab = b.dataset.t; location.hash = tab; shell(); }; });
      ({ claims: claims, mod: mod, reports: reports, featured: featured, places: places, signups: signups, stats: stats, alerts: alerts, settings: settings })[tab]();
    });
  }
  function pane(h) { document.getElementById('pane').innerHTML = h; }
  function act(sel, fn) { document.querySelectorAll(sel).forEach(function (b) { b.onclick = function () { b.disabled = true; Promise.resolve(fn(b)).then(shell).catch(function (e) { b.disabled = false; err(e); }); }; }); }

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
      sb.from('wb_places').select('id,name,slug,category,area,postcode,listable,listable_note,claimed').or('name.ilike.%' + q + '%,postcode.ilike.%' + q + '%').order('name').limit(40).then(function (r) {
        document.getElementById('pr').innerHTML = (r.data || []).map(function (p) {
          return '<div class="item"><strong>' + esc(p.name) + '</strong> <span class="meta">' + esc(p.category) + ' · ' + esc(p.area || '') + ' · ' + esc(p.postcode || '') + (p.claimed ? ' · claimed' : '') + ' · ' + (p.listable ? 'public' : 'hidden' + (p.listable_note ? ' (' + esc(p.listable_note) + ')' : '')) + '</span>' +
            '<div class="acts"><button class="btn btn-ghost btn-sm" data-vis="' + p.id + '" data-to="' + (!p.listable) + '">' + (p.listable ? 'Hide' : 'Make public') + '</button>' + (p.listable ? '<a class="btn btn-ghost btn-sm" href="/p/' + esc(p.slug) + '/" target="_blank">View</a>' : '') + '</div></div>';
        }).join('') || '<p class="muted">Nothing found.</p>';
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
