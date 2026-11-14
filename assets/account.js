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
          '<button class="btn btn-navy" type="submit" style="align-self:flex-start">Send my claim</button><p class="msg" role="status"></p></form>');
        var f = document.getElementById('cf');
        f.addEventListener('submit', function (e) {
          e.preventDefault(); var m = f.querySelector('.msg');
          if (!f.ok.checked) return msg(m, false, 'Please tick the box.');
          sb.from('wb_claims').insert({ place_id: p.id, user_id: user.id, email: user.email, full_name: f.full_name.value.trim(), role: f.role.value.trim() || null, phone: f.phone.value.trim() || null, evidence: f.evidence.value.trim() || null }).then(function (r) {
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

  function dashboard() {
    Promise.all([
      loadProfile(),
      sb.from('wb_owners').select('place_id').eq('user_id', user.id),
      sb.from('wb_claims').select('status,created_at,wb_places(name,slug)').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]).then(function (r) {
      var owned = (r[1].data || []).map(function (o) { return o.place_id; });
      var claims = r[2].data || [];
      var h = '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><h2>Hello' + (profile ? ', ' + esc(profile.display_name) : '') + '</h2><button class="btn btn-ghost btn-sm" id="so">Sign out</button></div>' +
        '<p class="muted">Signed in as ' + esc(user.email) + '</p>';
      if (claims.length) h += '<h3 style="margin-top:20px">Your claims</h3><ul>' + claims.map(function (c) { return '<li>' + esc(c.wb_places ? c.wb_places.name : '') + ': <strong>' + esc(c.status) + '</strong></li>'; }).join('') + '</ul>';
      if (!owned.length) h += '<p class="notice" style="margin-top:20px">Run a local business? <a href="/search/">Find it</a> and press "Claim this listing".</p>';
      h += '<div id="owned"></div>';
      html(h);
      document.getElementById('so').addEventListener('click', function () { sb.auth.signOut().then(function () { location.href = '/'; }); });
      owned.forEach(function (id) { ownerPanel(id); });
    });
  }

  function ownerPanel(id) {
    getPlace('id', id).then(function (p) {
      if (!p) return;
      var hours = p.hours || {};
      var box = document.createElement('div');
      box.className = 'panel'; box.style.marginTop = '24px'; box.style.background = 'var(--page)';
      var featured = p.featured_until && p.featured_until >= new Date().toISOString().slice(0, 10);
      box.innerHTML = '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline"><h2 style="font-size:26px">' + esc(p.name) + '</h2><a href="/p/' + esc(p.slug) + '/">View listing</a></div>' +
        (featured ? '<p class="notice">Featured until ' + esc(p.featured_until) + '.</p>' : '<p class="notice">Want to be top of ' + esc(p.category) + '? <a href="/business/#featured">Get featured</a>.</p>') +
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
        '<h3 style="margin-top:28px">Reviews</h3><div data-rv><p class="muted">Loading…</p></div>';
      document.getElementById('owned').appendChild(box);
      var f = box.querySelector('[data-f]');
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
