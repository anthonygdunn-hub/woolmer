/* woolmer — sign in, profile, claims, owner dashboard, posting reviews/questions/answers */
(function () {
  var app = document.getElementById('app'); if (!app) return;
  var WB = window.WB, esc = WB.esc, qs = new URLSearchParams(location.search), sb, user, profile, settings;
  var DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
  var view = app.dataset.view;
  var back = qs.get('back') && /^\/[a-z0-9\-\/]*$/i.test(qs.get('back')) ? qs.get('back') : null;

  function html(h) { app.innerHTML = h; }
  function msg(el, ok, t) { el.className = 'msg ' + (ok ? 'ok' : 'err'); el.textContent = t; }
  function niceErr(e) { var m = String(e && e.message || e); var k = m.match(/"message":"([^"]+)"/); m = k ? k[1] : m; if (/duplicate key.*wb_reviews/i.test(m)) return 'You\'ve already reviewed this business.'; return m.replace(/^Error:\s*/, '').slice(0, 200); }

  function start() {
    if (!window.supabase) return setTimeout(start, 60);
    sb = WB.client();
    WB.consumeLink(sb).then(function (v) {
      if (v && v.error) html('<p class="notice">That sign-in link has expired or already been used. Pop your email in below for a fresh one.</p>');
      return Promise.all([sb.auth.getSession(), WB.getSettings()]);
    }).then(function (r) {
      settings = r[1] || {};
      user = r[0].data.session && r[0].data.session.user;
      sb.auth.onAuthStateChange(function (ev, s) { if (ev === 'SIGNED_IN' && !user) { user = s.user; route(); } });
      route();
    });
  }

  // ---------------------------------------------------------------- sign in
  function signIn(reason) {
    html('<h2>Sign in</h2><p class="muted">' + esc(reason || 'We\'ll email you a link and a code. No password needed.') + '</p>' +
      '<form class="form" id="si"><label>Email<input type="email" name="email" required autocomplete="email"></label>' +
      '<button class="btn btn-navy" type="submit" style="align-self:flex-start">Email me a sign-in link</button><p class="msg" role="status"></p></form>');
    var f = document.getElementById('si');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var m = f.querySelector('.msg'), email = f.email.value.trim(), b = f.querySelector('button');
      b.disabled = true; msg(m, true, 'Sending…');
      WB.sendLink(email).then(function () { codeForm(email); }).catch(function (err) { msg(m, false, niceErr(err)); b.disabled = false; });
    });
  }
  function codeForm(email) {
    html('<h2>Check your email</h2><p>We\'ve sent a sign-in link to <strong>' + esc(email) + '</strong>. Tap it, or type the code from the email here.</p>' +
      '<form class="form" id="cf"><label>Code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" required style="font:600 22px ui-monospace,Menlo,monospace;letter-spacing:.3em;max-width:260px"></label>' +
      '<button class="btn btn-navy" type="submit" style="align-self:flex-start">Sign in</button><p class="msg" role="status"></p>' +
      '<p class="muted" style="font-size:14px;margin:0">Nothing after a couple of minutes? Check spam, or <button type="button" class="linkish" id="again">start again</button>.</p></form>');
    var f = document.getElementById('cf');
    document.getElementById('again').onclick = function () { signIn(); };
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var m = f.querySelector('.msg');
      sb.auth.verifyOtp({ email: email, token: f.code.value.trim(), type: 'email' }).then(function (r) {
        if (r.error) return msg(m, false, 'That code didn\'t work. Check it, or start again for a new one.');
        user = r.data.user; route();
      });
    });
  }

  function loadProfile() {
    return sb.from('wb_profiles').select('*').eq('user_id', user.id).maybeSingle().then(function (r) { profile = r.data; return profile; });
  }

  function profileForm(then) {
    html('<h2>Set up your profile</h2><p class="muted">Your display name shows next to anything you post. Your email is never shown.</p>' +
      '<form class="form" id="pf"><label>Display name<input name="dn" required minlength="2" maxlength="40" placeholder="e.g. Dave from Whitehill"></label>' +
      '<label class="check"><input type="checkbox" name="age" required><span>I\'m 16 or over</span></label>' +
      '<label class="check"><input type="checkbox" name="terms" required><span>I agree to the <a href="/terms/" target="_blank">terms</a> and <a href="/guidelines/" target="_blank">review guidelines</a></span></label>' +
      '<button class="btn btn-navy" type="submit" style="align-self:flex-start">Save</button><p class="msg" role="status"></p></form>');
    var f = document.getElementById('pf');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!f.age.checked || !f.terms.checked) return msg(f.querySelector('.msg'), false, 'Please tick both boxes.');
      sb.from('wb_profiles').insert({ user_id: user.id, display_name: f.dn.value.trim(), is_16_plus: true }).then(function (r) {
        if (r.error) return msg(f.querySelector('.msg'), false, niceErr(r.error));
        loadProfile().then(then);
      });
    });
  }

  function getPlace(field, value) {
    return sb.from('wb_places').select('id,slug,name,category,area,address,postcode,claimed,phone,website,menu_url,email,description,hours,menu,photos,tags,featured_until').eq(field, value).maybeSingle().then(function (r) { return r.data; });
  }

  // ---------------------------------------------------------------- routes
  function route() {
    var posting = qs.get('review') || qs.get('ask') || qs.get('answer');
    if (view === 'claim') {
      if (!user) return signIn('Sign in with your work email to claim your listing. We\'ll email you a link, no password needed.');
      return claim();
    }
    if (!user) return signIn(posting ? 'Sign in to post. We\'ll email you a link, no password needed.' : null);
    if (posting) {
      if (settings.reviews_enabled !== true) return html('<h2>Not open yet</h2><p class="muted">Reviews and questions open soon.</p>' + (back ? '<a class="btn btn-ghost" href="' + back + '">Go back</a>' : ''));
      return loadProfile().then(function (p) { if (!p) return profileForm(route); post(); });
    }
    dashboard();
  }

  // ---------------------------------------------------------------- claim
  function claim() {
    var slug = qs.get('p');
    if (!slug) return html('<p>Find your business with <a href="/search/">search</a>, then press "Claim this listing" on its page.</p>');
    getPlace('slug', slug).then(function (p) {
      if (!p) return html('<p>We couldn\'t find that listing. <a href="/search/">Search</a> or email info@woolmer.info.</p>');
      sb.from('wb_claims').select('status,created_at').eq('place_id', p.id).eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).then(function (r) {
        var prev = r.data && r.data[0];
        if (prev && prev.status !== 'rejected') return html('<h2>' + esc(p.name) + '</h2><p class="notice">Your claim is <strong>' + esc(prev.status) + '</strong>. ' + (prev.status === 'approved' ? '<a href="/account/">Manage your listing</a>' : 'We\'ll email you as soon as it\'s checked, usually within a day.') + '</p>');
        if (p.claimed) return html('<h2>' + esc(p.name) + '</h2><p class="notice">This listing is already managed by its owner. If that\'s wrong, email info@woolmer.info.</p>');
        html('<h2>Claim ' + esc(p.name) + '</h2><p class="muted">' + esc([p.address, p.postcode].filter(Boolean).join(', ')) + '</p>' +
          '<form class="form" id="cf"><div class="row2"><label>Your full name<input name="full_name" required maxlength="120" autocomplete="name"></label><label>Your role<input name="role" maxlength="80" placeholder="Owner, manager…"></label></div>' +
          '<label>Best phone number to check this with you<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label>' +
          '<label>Anything that helps us check (optional)<textarea name="evidence" rows="3" maxlength="1000" placeholder="e.g. a business email address, website or social account we can match"></textarea></label>' +
          '<p class="notice" style="margin:0">Signed in as ' + esc(user.email) + '. We check claims by ringing the business on its public number or matching a business email.</p>' +
          '<label class="check"><input type="checkbox" name="ok" required><span>I\'m authorised to manage this business\'s listing, and I agree to the <a href="/terms/" target="_blank">terms</a>.</span></label>' +
          '<label class="check"><input type="checkbox" name="dw"><span>Also email me ideas from Dunnworks, the Bordon web designer who runs woolmer, about getting more customers online. Optional, and you can unsubscribe any time.</span></label>' +
          '<button class="btn btn-navy" type="submit" style="align-self:flex-start">Send my claim</button><p class="msg" role="status"></p></form>');
        var f = document.getElementById('cf');
        f.addEventListener('submit', function (e) {
          e.preventDefault(); var m = f.querySelector('.msg');
          if (!f.ok.checked) return msg(m, false, 'Please tick the box.');
          sb.from('wb_claims').insert({ place_id: p.id, user_id: user.id, email: user.email, full_name: f.full_name.value.trim(), role: f.role.value.trim() || null, phone: f.phone.value.trim() || null, evidence: f.evidence.value.trim() || null, dw_optin: !!(f.dw && f.dw.checked) }).then(function (r) {
            if (r.error) return msg(m, false, niceErr(r.error));
            html('<h2>Thanks, claim sent</h2><p>We\'ll check it and email ' + esc(user.email) + ', usually within a day. Once it\'s approved you can edit your listing from <a href="/account/">your account</a>.</p>');
          });
        });
      });
    });
  }

  // ---------------------------------------------------------------- posting
  function post() {
    var rid = qs.get('review'), ask = qs.get('ask'), ans = qs.get('answer');
    var done = function (what) { html('<h2>Thanks</h2><p>Your ' + what + ' has been sent. We check everything before it goes live, usually within a day.</p>' + (back ? '<a class="btn btn-navy" href="' + back + '">Back</a>' : '<a class="btn btn-navy" href="/">Home</a>')); };
    var guide = '<p class="notice" style="margin:0">Posting as <strong>' + esc(profile.display_name) + '</strong>. Please follow the <a href="/guidelines/" target="_blank">guidelines</a>: your own experience, facts and opinions, no links, no personal details about staff.</p>';
    if (rid) {
      getPlace('id', +rid).then(function (p) {
        if (!p) return html('<p>Listing not found.</p>');
        html('<h2>Review ' + esc(p.name) + '</h2><form class="form" id="rf">' +
          '<fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:500;font-size:14px;margin-bottom:6px">Your rating</legend><div class="seg" role="radiogroup">' + [1, 2, 3, 4, 5].map(function (n) { return '<label style="flex-direction:row;align-items:center;gap:4px;padding:6px 10px"><input type="radio" name="rating" value="' + n + '" required> ' + n + '★</label>'; }).join('') + '</div></fieldset>' +
          '<label>Your review<textarea name="body" rows="6" minlength="20" maxlength="2000" required placeholder="What did you have, what was good, what wasn\'t?"></textarea></label>' +
          '<label>When did you go? (optional)<input name="visited" maxlength="40" placeholder="e.g. Friday night, last week"></label>' + guide +
          '<label class="check"><input type="checkbox" name="honest" required><span>This is my honest experience, and I have no connection to this business and haven\'t been offered anything for this review.</span></label>' +
          '<button class="btn btn-navy" type="submit" style="align-self:flex-start">Send review</button><p class="msg" role="status"></p></form>');
        var f = document.getElementById('rf');
        f.addEventListener('submit', function (e) {
          e.preventDefault(); var m = f.querySelector('.msg'), rating = f.querySelector('input[name=rating]:checked');
          if (!rating) return msg(m, false, 'Pick a rating.');
          if (!f.honest.checked) return msg(m, false, 'Please tick the box.');
          sb.from('wb_reviews').insert({ place_id: p.id, user_id: user.id, display_name: profile.display_name, rating: +rating.value, body: f.body.value.trim(), visited: f.visited.value.trim() || null }).then(function (r) {
            if (r.error) return msg(m, false, niceErr(r.error)); done('review');
          });
        });
      });
    } else if (ask) {
      var town = ask === 'town';
      (town ? Promise.resolve(null) : getPlace('id', +ask)).then(function (p) {
        html('<h2>' + (town ? 'Ask the town' : 'Ask about ' + esc(p ? p.name : 'this business')) + '</h2><form class="form" id="qf">' +
          (town ? '<label>Topic<select name="topic"><option value="">General</option><option>Food & drink</option><option>Shopping</option><option>Kids & families</option><option>Sport & leisure</option><option>Trades & services</option><option>Out & about</option></select></label>' : '') +
          '<label>Your question<textarea name="body" rows="4" minlength="10" maxlength="500" required></textarea></label>' + guide +
          '<button class="btn btn-navy" type="submit" style="align-self:flex-start">Send question</button><p class="msg" role="status"></p></form>');
        var f = document.getElementById('qf');
        f.addEventListener('submit', function (e) {
          e.preventDefault(); var m = f.querySelector('.msg');
          sb.from('wb_questions').insert({ place_id: town ? null : p.id, topic: town ? (f.topic.value || null) : null, user_id: user.id, display_name: profile.display_name, body: f.body.value.trim() }).then(function (r) {
            if (r.error) return msg(m, false, niceErr(r.error)); done('question');
          });
        });
      });
    } else if (ans) {
      sb.from('wb_questions').select('id,body').eq('id', +ans).maybeSingle().then(function (r) {
        var q = r.data; if (!q) return html('<p>Question not found.</p>');
        html('<h2>Answer</h2><p><strong>Q: ' + esc(q.body) + '</strong></p><form class="form" id="af"><label>Your answer<textarea name="body" rows="4" maxlength="1000" required></textarea></label>' + guide +
          '<button class="btn btn-navy" type="submit" style="align-self:flex-start">Send answer</button><p class="msg" role="status"></p></form>');
        var f = document.getElementById('af');
        f.addEventListener('submit', function (e) {
          e.preventDefault(); var m = f.querySelector('.msg');
          sb.from('wb_answers').insert({ question_id: q.id, user_id: user.id, display_name: profile.display_name, body: f.body.value.trim() }).then(function (r2) {
            if (r2.error) return msg(m, false, niceErr(r2.error)); done('answer');
          });
        });
      });
    }
  }

  // ---------------------------------------------------------------- dashboard
  function menuToText(menu) {
    return (Array.isArray(menu) ? menu : []).map(function (s) {
      return '## ' + s.section + '\n' + (s.items || []).map(function (i) { return [i.name, i.price || '', i.desc || ''].join(' | ').replace(/( \| )+$/, ''); }).join('\n');
    }).join('\n\n');
  }
  function textToMenu(t) {
    var out = [], cur = null;
    String(t || '').split('\n').forEach(function (line) {
      line = line.trim(); if (!line) return;
      if (/^#+\s*/.test(line)) { cur = { section: line.replace(/^#+\s*/, '').slice(0, 60), items: [] }; out.push(cur); return; }
      if (!cur) { cur = { section: 'Menu', items: [] }; out.push(cur); }
      var p = line.split('|').map(function (x) { return x.trim(); });
      var item = { name: p[0].slice(0, 80) }; if (p[1]) item.price = p[1].replace(/^£/, '').slice(0, 12); if (p[2]) item.desc = p[2].slice(0, 160);
      cur.items.push(item);
    });
    return out.slice(0, 30);
  }

  function signedInChrome() {
    var a = document.querySelector('[data-acct]');
    if (a) a.innerHTML = (avatar ? '<img class="h-av" src="' + esc(avatar.url) + '" alt="">' : '') + 'My profile';
    document.querySelectorAll('[data-acct-tab]').forEach(function (x) { x.textContent = 'Profile'; });
    document.documentElement.classList.add('signed-in');
    var h = document.querySelector('[data-acct-h]'), pp = document.querySelector('[data-acct-p]');
    if (h && profile) h.textContent = profile.display_name;
    if (pp) pp.textContent = 'Your saved places and events, everything you\'ve posted, and your settings.';
  }
  var avatar = null;
  function loadAvatar() {
    return sb.from('wb_avatars').select('*').eq('user_id', user.id).maybeSingle().then(function (r) {
      avatar = r.data || null;
      try { if (avatar) localStorage.setItem('wb_av', avatar.url); else localStorage.removeItem('wb_av'); } catch (x) {}
    });
  }
  function avInner() {
    return avatar ? '<img src="' + esc(avatar.url) + '" alt="Your profile picture">' : '<span>' + esc((profile.display_name || '?').trim()[0].toUpperCase()) + '</span>';
  }
  function avStatus() {
    if (!avatar) return 'No picture yet. Your initial shows instead.';
    if (avatar.status === 'pending') return 'Thanks. We check every picture before anyone else sees it, usually within a day. You can see it now.';
    if (avatar.status === 'rejected') return 'This picture wasn\'t approved, so only you can see it. Try a different one.';
    return avatar.show_public === false ? 'Approved. Only you can see it, because sharing is off.' : 'Approved and showing on your reviews, questions and answers.';
  }
  function squareWebp(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var side = Math.min(img.width, img.height), c = document.createElement('canvas'), out = Math.min(400, side);
        c.width = c.height = out;
        c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, out, out);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('Could not read that picture')); }, 'image/webp', 0.85);
      };
      img.onerror = function () { rej(new Error('That file isn\'t a picture we can read')); };
      img.src = url;
    });
  }
  function uploadAvatar(file, m) {
    if (!file) return;
    if (!/^image\//.test(file.type)) return msg(m, false, 'Please pick a photo.');
    msg(m, true, 'Uploading…');
    var old = avatar && avatar.path, path = 'avatars/' + user.id + '/' + Date.now() + '.webp';
    squareWebp(file).then(function (blob) {
      return sb.storage.from('wb-public').upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' });
    }).then(function (r) {
      if (r.error) throw r.error;
      var url = sb.storage.from('wb-public').getPublicUrl(path).data.publicUrl;
      return sb.from('wb_avatars').upsert({ user_id: user.id, url: url, path: path }, { onConflict: 'user_id' });
    }).then(function (r) {
      if (r.error) throw r.error;
      if (old && old !== path) sb.storage.from('wb-public').remove([old]);
      return loadAvatar();
    }).then(function () { msg(m, true, 'Picture saved.'); paintAv(); }).catch(function (e) { msg(m, false, 'Upload failed: ' + niceErr(e)); });
  }
  function paintAv() {
    var a = app.querySelector('.pf-av'); if (a) { a.querySelectorAll('img,span:not(.pf-av-ed)').forEach(function (x) { x.remove(); }); a.insertAdjacentHTML('afterbegin', avInner()); }
    var pv = document.getElementById('pf-pic-pv'); if (pv) pv.innerHTML = avInner();
    var stx = document.getElementById('pf-pic-st'); if (stx) stx.textContent = avStatus();
    var rm = document.getElementById('pf-pic-rm'); if (rm) rm.hidden = !avatar;
    var sh = document.getElementById('pf-pic-share'); if (sh) { sh.checked = !avatar || avatar.show_public !== false; sh.disabled = !avatar; }
    signedInChrome();
  }

  var STATUS = { pending: ['Waiting to be checked', 'st-wait'], approved: ['Live', 'st-live'], rejected: ['Not published', 'st-no'], hidden: ['Hidden', 'st-no'] };
  function st(s) { var x = STATUS[s] || [s || '', 'st-wait']; return '<span class="st ' + x[1] + '">' + esc(x[0]) + '</span>'; }
  function when(d) { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

  function dashboard() {
    loadProfile().then(function (p) {
      if (!p) return profileForm(dashboard);
      if (p.banned) return html('<h2>Account suspended</h2><p class="muted">This account can\'t post on woolmer. If you think that\'s a mistake, email info@woolmer.info.</p>');
      return loadAvatar().then(function () { signedInChrome(); return Promise.all([
        sb.from('wb_owners').select('place_id').eq('user_id', user.id),
        sb.from('wb_claims').select('status,created_at,wb_places(name,slug)').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]).then(function (r) { draw((r[0].data || []).map(function (o) { return o.place_id; }), r[1].data || []); }); });
    });
  }

  function draw(owned, claims) {
    var tabs = [['saved', 'Saved'], ['posts', 'My posts'], ['settings', 'Settings']].concat(owned.length || claims.length ? [['biz', 'My business']] : []);
    var cur = (location.hash || '').slice(1); if (!tabs.some(function (t) { return t[0] === cur; })) cur = 'saved';
    html('<div class="pf-head"><label class="pf-av" title="Change your picture">' + avInner() + '<span class="pf-av-ed">Edit</span><input type="file" accept="image/*" hidden data-avin></label><div><h2>' + esc(profile.display_name) + '</h2><p class="muted">' + esc(user.email) + ' · on woolmer since ' + esc(new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })) + '</p></div><button class="btn btn-ghost btn-sm" id="so">Sign out</button></div>' +
      '<div class="pf-stats" id="pf-stats"></div>' +
      '<div class="pf-tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (t[0] === cur) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div data-pane="saved"' + (cur === 'saved' ? '' : ' hidden') + '><h3>Saved places</h3><div class="grid pf-grid" id="pf-places"><p class="muted">Loading…</p></div><h3 style="margin-top:24px">Saved events</h3><div class="evs" id="pf-events"><p class="muted">Loading…</p></div></div>' +
      '<div data-pane="posts"' + (cur === 'posts' ? '' : ' hidden') + '><div id="pf-posts"><p class="muted">Loading…</p></div></div>' +
      '<div data-pane="settings"' + (cur === 'settings' ? '' : ' hidden') + '>' + settingsHtml() + '</div>' +
      (tabs.length > 3 ? '<div data-pane="biz"' + (cur === 'biz' ? '' : ' hidden') + '>' + (claims.length ? '<h3>Your claims</h3><ul>' + claims.map(function (c) { return '<li>' + esc(c.wb_places ? c.wb_places.name : '') + ': <strong>' + esc(c.status) + '</strong></li>'; }).join('') + '</ul>' : '') + '<div id="owned"></div></div>' : ''));
    if (!owned.length) app.insertAdjacentHTML('beforeend', '<p class="notice" style="margin-top:24px">Run a local business? <a href="/search/">Find it</a> and press "Claim this listing". It\'s free.</p>');
    app.querySelectorAll('[data-tab]').forEach(function (b) {
      b.onclick = function () {
        app.querySelectorAll('[data-tab]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
        app.querySelectorAll('[data-pane]').forEach(function (x) { x.hidden = x.dataset.pane !== b.dataset.tab; });
        history.replaceState(null, '', '#' + b.dataset.tab);
      };
    });
    var hin = app.querySelector('[data-avin]');
    if (hin) hin.addEventListener('change', function () {
      var t = app.querySelector('[data-tab="settings"]'); if (t) t.click();
      uploadAvatar(hin.files[0], document.getElementById('pf-pic-msg')); hin.value = '';
    });
    document.getElementById('so').addEventListener('click', function () { sb.auth.signOut().then(function () { location.href = '/'; }); });
    var paintSaved = function () {
      WB.renderSavedPlaces(document.getElementById('pf-places'));
      WB.renderSavedEvents(document.getElementById('pf-events')).then(stats);
    };
    paintSaved();
    document.addEventListener('wb:saves', paintSaved);
    WB.syncSaves && WB.syncSaves();
    posts();
    settingsWire();
    owned.forEach(function (id) { ownerPanel(id); });
  }

  var counts = { r: 0, q: 0 };
  function stats() {
    var el = document.getElementById('pf-stats'); if (!el) return;
    var n = function (v, one, many) { return '<div><b>' + v + '</b><span>' + (v === 1 ? one : many) + '</span></div>'; };
    el.innerHTML = n(WB.saved('place').length, 'saved place', 'saved places') + n(WB.saved('event').length, 'saved event', 'saved events') + n(counts.r, 'review', 'reviews') + n(counts.q, 'question or answer', 'questions & answers');
  }

  function posts() {
    var box = document.getElementById('pf-posts');
    Promise.all([
      sb.from('wb_reviews').select('id,rating,body,status,owner_reply,created_at,wb_places(name,slug)').eq('user_id', user.id).order('created_at', { ascending: false }),
      sb.from('wb_questions').select('id,body,topic,status,created_at,wb_places(name,slug),wb_answers(id,status,display_name,is_owner,body)').eq('user_id', user.id).order('created_at', { ascending: false }),
      sb.from('wb_answers').select('id,body,status,created_at,wb_questions(body,place_id,wb_places(name,slug))').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]).then(function (r) {
      var rv = r[0].data || [], qs = r[1].data || [], an = r[2].data || [];
      counts = { r: rv.length, q: qs.length + an.length }; stats();
      var h = '<h3>Reviews</h3>' + (rv.length ? rv.map(function (x) {
        var pl = x.wb_places;
        return '<div class="pf-item"><div class="pf-row"><strong>' + (pl ? '<a href="/p/' + esc(pl.slug) + '/">' + esc(pl.name) + '</a>' : 'A business') + '</strong>' + st(x.status) + '</div>' +
          '<p class="meta"><span class="stars">' + '★★★★★'.slice(0, x.rating) + '</span> · ' + when(x.created_at) + '</p><p>' + esc(x.body) + '</p>' +
          (x.owner_reply ? '<div class="reply"><strong>Owner replied:</strong> ' + esc(x.owner_reply) + '</div>' : '') + '</div>';
      }).join('') : '<p class="muted">You haven\'t reviewed anywhere yet. Find somewhere you\'ve been and tap "Write a review".</p>');
      h += '<h3 style="margin-top:24px">Questions</h3>' + (qs.length ? qs.map(function (x) {
        var pl = x.wb_places, ans = (x.wb_answers || []).filter(function (a) { return a.status === 'approved'; });
        return '<div class="pf-item"><div class="pf-row"><strong>' + (pl ? '<a href="/p/' + esc(pl.slug) + '/">' + esc(pl.name) + '</a>' : '<a href="/ask/">Ask the town</a>' + (x.topic ? ' · ' + esc(x.topic) : '')) + '</strong>' + st(x.status) + '</div>' +
          '<p class="meta">' + when(x.created_at) + ' · ' + (ans.length ? ans.length + (ans.length === 1 ? ' answer' : ' answers') : 'no answers yet') + '</p><p>' + esc(x.body) + '</p>' +
          ans.slice(0, 3).map(function (a) { return '<div class="reply"><strong>' + esc(a.display_name) + (a.is_owner ? ' (owner)' : '') + ':</strong> ' + esc(a.body) + '</div>'; }).join('') + '</div>';
      }).join('') : '<p class="muted">No questions yet. <a href="/ask/">Ask the town</a> anything.</p>');
      if (an.length) h += '<h3 style="margin-top:24px">Your answers</h3>' + an.map(function (x) {
        var q = x.wb_questions || {}, pl = q.wb_places;
        return '<div class="pf-item"><div class="pf-row"><strong>' + (pl ? '<a href="/p/' + esc(pl.slug) + '/">' + esc(pl.name) + '</a>' : '<a href="/ask/">Ask the town</a>') + '</strong>' + st(x.status) + '</div><p class="meta">Q: ' + esc(q.body || '') + '</p><p>' + esc(x.body) + '</p></div>';
      }).join('');
      box.innerHTML = h;
    });
  }

  function settingsHtml() {
    return '<div class="form" id="pf-pic"><h3>Profile picture</h3><div class="pf-pic-row"><span class="pf-av pf-av-lg" id="pf-pic-pv">' + avInner() + '</span><div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;gap:8px;flex-wrap:wrap"><label class="btn btn-navy btn-sm" style="cursor:pointer">Upload a picture<input type="file" accept="image/*" hidden id="pf-pic-in"></label><button type="button" class="btn btn-ghost btn-sm" id="pf-pic-rm"' + (avatar ? '' : ' hidden') + '>Remove</button></div><p class="muted" id="pf-pic-st" style="margin:0;font-size:13px">' + esc(avStatus()) + '</p></div></div>' +
      '<label class="check"><input type="checkbox" id="pf-pic-share"' + (!avatar || avatar.show_public !== false ? ' checked' : '') + (avatar ? '' : ' disabled') + '><span>Show my picture on my reviews, questions and answers. Turn off to keep it just for you.</span></label>' +
      '<p class="muted" style="margin:0;font-size:13px">A clear photo of you, or anything you like that isn\'t rude, offensive or someone else\'s. We crop it to a square.</p><p class="msg" role="status" id="pf-pic-msg"></p></div>' +
      '<form class="form" id="pf-name" style="margin-top:24px"><h3>Your details</h3><label>Display name<input name="dn" required minlength="2" maxlength="40" value="' + esc(profile.display_name) + '"></label><p class="muted" style="font-size:13px;margin:0">Shows next to anything you post from now on. Your email is never shown.</p><button class="btn btn-navy btn-sm" style="align-self:flex-start">Save name</button><p class="msg" role="status"></p></form>' +
      '<div class="form" style="margin-top:24px"><h3>Emails</h3><label class="check"><input type="checkbox" id="pf-news" disabled><span>Send me the weekly woolmer email: what\'s on, new places and local offers</span></label><p class="msg" id="pf-news-msg" role="status"></p></div>' +
      '<div class="form" style="margin-top:24px"><h3>On this phone</h3><p class="muted" style="margin:0">Your saved places and events sync to your profile whenever you\'re signed in.</p><button type="button" class="btn btn-ghost btn-sm" id="pf-sync" style="align-self:flex-start">Sync now</button><p class="msg" role="status" id="pf-sync-msg"></p></div>' +
      '<div class="form pf-danger" style="margin-top:24px"><h3>Delete my woolmer data</h3><p class="muted" style="margin:0">Removes your profile, saved places and events, reviews, questions and answers from woolmer for good, and stops woolmer emails. It can\'t be undone.</p><button type="button" class="btn btn-ghost btn-sm" id="pf-del" style="align-self:flex-start">Delete my woolmer data</button><p class="msg" role="status" id="pf-del-msg"></p></div>';
  }
  function settingsWire() {
    var pm = document.getElementById('pf-pic-msg'), pin = document.getElementById('pf-pic-in');
    pin.addEventListener('change', function () { uploadAvatar(pin.files[0], pm); pin.value = ''; });
    document.getElementById('pf-pic-rm').onclick = function () {
      if (!avatar || !confirm('Remove your profile picture?')) return;
      var path = avatar.path;
      sb.from('wb_avatars').delete().eq('user_id', user.id).then(function (r) {
        if (r.error) return msg(pm, false, niceErr(r.error));
        sb.storage.from('wb-public').remove([path]);
        avatar = null; try { localStorage.removeItem('wb_av'); } catch (x) {}
        msg(pm, true, 'Removed.'); paintAv();
      });
    };
    var sh = document.getElementById('pf-pic-share');
    sh.addEventListener('change', function () {
      if (!avatar) return;
      sh.disabled = true;
      sb.from('wb_avatars').update({ show_public: sh.checked }).eq('user_id', user.id).then(function (r) {
        sh.disabled = false;
        if (r.error) { sh.checked = !sh.checked; return msg(pm, false, niceErr(r.error)); }
        avatar.show_public = sh.checked; msg(pm, true, sh.checked ? 'Your picture now shows on your posts.' : 'Your picture is now just for you.'); paintAv();
      });
    });
    var nf = document.getElementById('pf-name');
    nf.addEventListener('submit', function (e) {
      e.preventDefault(); var m = nf.querySelector('.msg'), v = nf.dn.value.trim();
      sb.from('wb_profiles').update({ display_name: v }).eq('user_id', user.id).then(function (r) {
        if (r.error) return msg(m, false, niceErr(r.error));
        profile.display_name = v; msg(m, true, 'Saved.');
        var h = document.querySelector('.pf-head h2'); if (h) h.textContent = v; signedInChrome();
      });
    });
    var nb = document.getElementById('pf-news'), nm = document.getElementById('pf-news-msg');
    sb.rpc('wb_my_newsletter').then(function (r) { if (!r.error) { nb.checked = !!r.data; nb.disabled = false; } });
    nb.addEventListener('change', function () {
      nb.disabled = true;
      sb.rpc('wb_set_newsletter', { p_on: nb.checked }).then(function (r) {
        nb.disabled = false;
        if (r.error) { nb.checked = !nb.checked; return msg(nm, false, niceErr(r.error)); }
        msg(nm, true, nb.checked ? 'You\'re on the list. See you Thursday.' : 'Done, no more woolmer emails.');
      });
    });
    document.getElementById('pf-sync').onclick = function () {
      var m = document.getElementById('pf-sync-msg'); msg(m, true, 'Syncing…');
      WB.syncSaves().then(function (ok) { msg(m, !!ok, ok ? 'All synced.' : 'Couldn\'t sync just now. Try again in a minute.'); });
    };
    document.getElementById('pf-del').onclick = function () {
      var m = document.getElementById('pf-del-msg');
      if (!confirm('Delete your woolmer profile, saves, reviews, questions and answers for good? This can\'t be undone.')) return;
      if (avatar && avatar.path) sb.storage.from('wb-public').remove([avatar.path]);
      sb.rpc('wb_delete_me').then(function (r) {
        if (r.error) return msg(m, false, niceErr(r.error));
        try { ['wb_av', 'wb_saved', 'wb_saved_ev', 'wb_saved_base', 'wb_saved_ev_base'].forEach(function (k) { localStorage.removeItem(k); }); } catch (x) {}
        sb.auth.signOut().then(function () { html('<h2>All done</h2><p>Your woolmer data has been deleted.</p><a class="btn btn-navy" href="/">Home</a>'); });
      });
    };
  }

  function ownerPanel(id) {
    getPlace('id', id).then(function (p) {
      if (!p) return;
      var hours = p.hours || {};
      var box = document.createElement('div');
      box.className = 'panel'; box.style.marginTop = '24px'; box.style.background = 'var(--page)';
      box.innerHTML = '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline"><h2 style="font-size:26px">' + esc(p.name) + '</h2><a href="/p/' + esc(p.slug) + '/">View listing</a></div>' +
        (p.website ? '' : '<p class="notice">No website yet? <a href="https://dunnworks.io/?utm_source=woolmer&utm_medium=referral&utm_campaign=owner">Dunnworks</a>, who built woolmer, makes fast websites for local businesses from £750, with no monthly fees. Ask for a free mock-up.</p>') +
        '<form class="form" data-f>' +
        '<div class="row2"><label>Phone<input name="phone" maxlength="40" value="' + esc(p.phone || '') + '"></label><label>Website<input name="website" type="url" maxlength="200" placeholder="https://" value="' + esc(p.website || '') + '"></label></div>' +
        '<label>Online menu or ordering link (optional)<input name="menu_url" type="url" maxlength="300" placeholder="https://, e.g. your Just Eat or Deliveroo page" value="' + esc(p.menu_url || '') + '"></label>' +
        '<label>Public email<input name="email" type="email" maxlength="200" value="' + esc(p.email || '') + '"></label>' +
        '<label>About your business<textarea name="description" rows="3" maxlength="1200">' + esc(p.description || '') + '</textarea></label>' +
        '<label>Tags, comma separated (e.g. Delivers, Vegan options, Dog friendly)<input name="tags" maxlength="300" value="' + esc((p.tags || []).join(', ')) + '"></label>' +
        '<fieldset style="border:1px solid var(--ln);border-radius:14px;padding:14px"><legend style="font-weight:600;padding:0 6px">Opening hours</legend><p class="muted" style="margin:0 0 10px;font-size:13px">Like 17:00-23:00, or 12:00-14:00, 17:00-22:30. Leave blank for closed.</p><div class="row2">' +
        DAYS.map(function (d) { return '<label>' + d[1] + '<input name="h_' + d[0] + '" maxlength="40" value="' + esc(hours[d[0]] && !/closed/i.test(hours[d[0]]) ? hours[d[0]] : '') + '"></label>'; }).join('') + '</div></fieldset>' +
        '<label>Menu<textarea name="menu" rows="10" style="font-family:ui-monospace,Menlo,monospace;font-size:13px" placeholder="## Starters\nSpring rolls | 3.50 | Vegetable\n## Mains\nChicken curry | 8.90">' + esc(menuToText(p.menu)) + '</textarea><span class="muted" style="font-size:13px;font-weight:400">A line starting ## is a section. Each item is: name | price | description.</span></label>' +
        '<button class="btn btn-navy" type="submit" style="align-self:flex-start">Save changes</button><p class="msg" role="status"></p><p class="muted" style="font-size:13px;margin:0">Changes show on your listing within the hour.</p></form>' +
        '<h3 style="margin-top:28px">Photos</h3><p class="muted" style="font-size:14px">Up to 6. The first one shows on your card and at the top of your listing. Only upload photos you took or have permission to use.</p><div class="ph-grid" data-ph></div><label class="btn btn-ghost btn-sm" style="align-self:flex-start;cursor:pointer;margin-top:10px">Add photos<input type="file" accept="image/*" multiple data-phin hidden></label><p class="msg" data-phmsg role="status"></p>' +
        '<h3 style="margin-top:28px">Deals</h3>' + (true
          ? '<p class="muted" style="font-size:14px">Post up to 3 offers at a time. They show on your listing and in Local deals on the home page. Free.</p><div data-deals><p class="muted">Loading…</p></div>' +
            '<form class="form" data-dealf style="margin-top:10px"><label>Offer<input name="title" maxlength="80" required placeholder="2 large pizzas for £20 on Tuesdays"></label><label>Details (optional)<input name="details" maxlength="300" placeholder="Collection only. Mention woolmer."></label><label>Ends on<input name="ends" type="date" required></label><button class="btn btn-navy btn-sm" style="align-self:flex-start">Post deal</button><p class="msg" role="status"></p></form>'
          : '') +
        '<h3 style="margin-top:28px">Reviews</h3><div data-rv><p class="muted">Loading…</p></div>';
      document.getElementById('owned').appendChild(box);
      var f = box.querySelector('[data-f]');
      // ---- deals
      var dealf = box.querySelector('[data-dealf]');
      if (dealf) {
        var dBox = box.querySelector('[data-deals]'), today = new Date().toISOString().slice(0, 10), max = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
        dealf.ends.min = today; dealf.ends.max = max; dealf.ends.value = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
        var loadDeals = function () {
          sb.from('wb_deals').select('id,title,details,ends_on').eq('place_id', p.id).gte('ends_on', today).order('ends_on').then(function (r) {
            var rows = r.data || [];
            dBox.innerHTML = rows.length ? rows.map(function (d) { return '<div class="item"><strong>' + esc(d.title) + '</strong><p class="meta">Until ' + esc(d.ends_on) + (d.details ? ' · ' + esc(d.details) : '') + '</p><button type="button" class="linkish" data-dd="' + d.id + '">Remove</button></div>'; }).join('') : '<p class="muted">No live deals.</p>';
            dBox.querySelectorAll('[data-dd]').forEach(function (b) { b.onclick = function () { sb.from('wb_deals').delete().eq('id', b.dataset.dd).then(loadDeals); }; });
          });
        };
        loadDeals();
        dealf.addEventListener('submit', function (e) {
          e.preventDefault(); var m = dealf.querySelector('.msg');
          sb.from('wb_deals').insert({ place_id: p.id, title: dealf.title.value.trim(), details: dealf.details.value.trim() || null, ends_on: dealf.ends.value }).then(function (r) {
            if (r.error) { msg(m, false, /row-level|policy/i.test(r.error.message) ? 'You can have up to 3 live deals at a time, each ending within 90 days.' : niceErr(r.error)); return; }
            msg(m, true, 'Posted. It shows on the site straight away.'); dealf.title.value = ''; dealf.details.value = ''; loadDeals();
          });
        });
      }
      // ---- photos
      var photos = Array.isArray(p.photos) ? p.photos.slice() : [], phBox = box.querySelector('[data-ph]'), phMsg = box.querySelector('[data-phmsg]');
      var savePhotos = function (note) {
        phMsg.textContent = 'Saving…';
        return sb.rpc('wb_owner_update', { p_place: p.id, p: { photos: photos } }).then(function (r) { phMsg.textContent = r.error ? niceErr(r.error) : (note || 'Saved. Live within the hour.'); paintPh(); });
      };
      var paintPh = function () {
        phBox.innerHTML = photos.map(function (x, i) {
          return '<figure><img src="' + esc(x.src) + '" alt=""><figcaption>' + (i === 0 ? '<b>Main photo</b>' : '<button type="button" class="linkish" data-main="' + i + '">Make main</button>') + ' · <button type="button" class="linkish" data-del="' + i + '">Remove</button></figcaption></figure>';
        }).join('') || '<p class="muted">No photos yet.</p>';
        phBox.querySelectorAll('[data-main]').forEach(function (b) { b.onclick = function () { var i = +b.dataset.main; photos.unshift(photos.splice(i, 1)[0]); savePhotos(); }; });
        phBox.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { if (!confirm('Remove this photo?')) return; photos.splice(+b.dataset.del, 1); savePhotos('Removed.'); }; });
      };
      paintPh();
      var shrink = function (file) {
        return new Promise(function (res, rej) {
          var img = new Image(), url = URL.createObjectURL(file);
          img.onload = function () {
            var s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
            c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
            c.toBlob(function (b) { b ? res(b) : rej(new Error('Could not read that image')); }, 'image/webp', 0.8);
          };
          img.onerror = function () { rej(new Error('That file is not an image we can read')); };
          img.src = url;
        });
      };
      box.querySelector('[data-phin]').addEventListener('change', function (e) {
        var files = [].slice.call(e.target.files || []).slice(0, Math.max(0, 6 - photos.length));
        if (!files.length) { phMsg.textContent = 'You already have 6 photos. Remove one first.'; return; }
        phMsg.textContent = 'Uploading ' + files.length + '…';
        files.reduce(function (chain, file, n) {
          return chain.then(function () {
            return shrink(file).then(function (blob) {
              var path = 'places/' + p.id + '/' + Date.now() + '-' + n + '.webp';
              return sb.storage.from('wb-public').upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' }).then(function (r) {
                if (r.error) throw r.error;
                photos.push({ src: sb.storage.from('wb-public').getPublicUrl(path).data.publicUrl, alt: p.name, credit: p.name, path: path });
              });
            });
          });
        }, Promise.resolve()).then(function () { e.target.value = ''; return savePhotos('Uploaded. Live within the hour.'); }).catch(function (er) { phMsg.textContent = 'Upload failed: ' + (er.message || er); paintPh(); });
      });
      f.addEventListener('submit', function (e) {
        e.preventDefault(); var m = f.querySelector('.msg');
        var h = {}; DAYS.forEach(function (d) { var v = f['h_' + d[0]].value.trim(); h[d[0]] = v || 'Closed'; });
        var allClosed = DAYS.every(function (d) { return h[d[0]] === 'Closed'; });
        var payload = { phone: f.phone.value.trim() || null, website: f.website.value.trim() || null, menu_url: f.menu_url.value.trim(), email: f.email.value.trim() || null, description: f.description.value.trim() || null,
          tags: f.tags.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean), hours: allClosed ? null : h, menu: textToMenu(f.menu.value) };
        if (!payload.menu.length) payload.menu = null;
        sb.rpc('wb_owner_update', { p_place: p.id, p: payload }).then(function (r) { msg(m, !r.error, r.error ? niceErr(r.error) : 'Saved.'); });
      });
      sb.from('wb_reviews').select('id,display_name,rating,body,owner_reply,created_at').eq('place_id', p.id).eq('status', 'approved').order('created_at', { ascending: false }).then(function (r) {
        var rv = box.querySelector('[data-rv]'), rows = r.data || [];
        if (!rows.length) { rv.innerHTML = '<p class="muted">No reviews yet.</p>'; return; }
        rv.innerHTML = rows.map(function (x) {
          return '<div class="review"><strong>' + esc(x.display_name) + '</strong> <span class="stars">' + '★★★★★'.slice(0, x.rating) + '</span><p style="margin:4px 0">' + esc(x.body) + '</p>' +
            (x.owner_reply ? '<div class="reply"><strong>Your reply:</strong> ' + esc(x.owner_reply) + '</div>'
              : '<form class="form" data-reply="' + x.id + '"><textarea name="t" rows="2" maxlength="1000" placeholder="Reply publicly (once, be polite)"></textarea><button class="btn btn-ghost btn-sm" style="align-self:flex-start">Post reply</button><p class="msg"></p></form>') +
            ' <button class="linkish" type="button" data-report="review" data-id="' + x.id + '">Report this review</button></div>';
        }).join('');
        rv.querySelectorAll('[data-reply]').forEach(function (rf) {
          rf.addEventListener('submit', function (e) {
            e.preventDefault();
            sb.rpc('wb_owner_reply', { p_review: +rf.dataset.reply, p_text: rf.t.value.trim() }).then(function (res) {
              if (res.error) return msg(rf.querySelector('.msg'), false, niceErr(res.error));
              rf.outerHTML = '<div class="reply"><strong>Your reply:</strong> ' + esc(rf.t.value.trim()) + '</div>';
            });
          });
        });
      });
    });
  }

  start();
})();
