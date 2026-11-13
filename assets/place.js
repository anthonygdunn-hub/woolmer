/* woolmer — business page: open now, live reviews and questions */
(function () {
  var el = document.getElementById('place'); if (!el) return;
  var WB = window.WB, id = +el.dataset.id, slug = el.dataset.slug;

  // open now
  try {
    var hours = el.dataset.hours ? JSON.parse(el.dataset.hours) : null;
    if (hours) {
      var keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], now = new Date(), d = keys[now.getDay()], mins = now.getHours() * 60 + now.getMinutes();
      var row = document.querySelector('.hours tr[data-day="' + d + '"]'); if (row) row.classList.add('today');
      var toMin = function (t) { var p = t.split(':'); return +p[0] * 60 + (+p[1] || 0); };
      var openAt = function (day, m, prev) {
        var v = String(hours[day] || ''); if (!v || /closed/i.test(v)) return false;
        return v.split(',').some(function (r) {
          var x = r.trim().split('-'); if (x.length < 2) return false;
          var a = toMin(x[0]), b = toMin(x[1]); if (b <= a) b += 1440;
          return prev ? (m + 1440 >= a && m + 1440 < b) : (m >= a && m < b);
        });
      };
      var yest = keys[(now.getDay() + 6) % 7];
      var open = openAt(d, mins) || openAt(yest, mins, true);
      var tag = document.getElementById('open-now');
      if (tag) tag.innerHTML = open ? '<span class="open-now">Open now</span>' : '<span class="closed-now">Closed now</span>';
    }
  } catch (e) {}

  var stars = function (n) { return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); };
  var date = function (s) { return new Date(s).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); };

  WB.getSettings().then(function (s) {
    var on = s.reviews_enabled === true;
    WB.rest('wb_reviews?select=id,display_name,rating,body,visited,owner_reply,owner_reply_at,created_at&place_id=eq.' + id + '&status=eq.approved&order=created_at.desc').then(function (rows) {
      var box = document.getElementById('reviews-list');
      if (!rows.length) { box.innerHTML = '<p class="muted">No reviews yet.' + (on ? ' Be the first.' : '') + '</p>'; }
      else box.innerHTML = rows.map(function (r) {
        return '<article class="review"><div class="who"><strong>' + WB.esc(r.display_name) + '</strong><span class="stars" aria-label="' + r.rating + ' out of 5">' + stars(r.rating) + '</span><span class="muted">' + date(r.created_at) + '</span></div>' +
          '<p style="margin:0">' + WB.esc(r.body) + '</p>' +
          (r.owner_reply ? '<div class="reply"><strong>Reply from the owner:</strong> ' + WB.esc(r.owner_reply) + '</div>' : '') +
          '<button class="linkish" type="button" data-report="review" data-id="' + r.id + '">Report</button></article>';
      }).join('');
    }).catch(function () { document.getElementById('reviews-list').innerHTML = '<p class="muted">Reviews couldn\'t load just now.</p>'; });

    WB.rest('wb_questions?select=id,display_name,body,created_at,wb_answers(id,display_name,body,is_owner,status,created_at)&place_id=eq.' + id + '&status=eq.approved&order=created_at.desc').then(function (rows) {
      var box = document.getElementById('q-list');
      if (!rows.length) { box.innerHTML = '<p class="muted">No questions yet.</p>'; return; }
      box.innerHTML = rows.map(function (q) {
        var ans = (q.wb_answers || []).filter(function (a) { return a.status === 'approved'; });
        return '<article class="review"><strong>Q: ' + WB.esc(q.body) + '</strong><div class="muted" style="font-size:13px">' + WB.esc(q.display_name) + ' · ' + date(q.created_at) + '</div>' +
          ans.map(function (a) { return '<div class="reply"><strong>' + (a.is_owner ? 'Owner' : WB.esc(a.display_name)) + ':</strong> ' + WB.esc(a.body) + ' <button class="linkish" type="button" data-report="answer" data-id="' + a.id + '">Report</button></div>'; }).join('') +
          (on ? '<a class="linkish" href="/account/?answer=' + q.id + '&back=' + encodeURIComponent(location.pathname) + '">Answer this</a> ' : '') +
          '<button class="linkish" type="button" data-report="question" data-id="' + q.id + '">Report</button></article>';
      }).join('');
    }).catch(function () { document.getElementById('q-list').innerHTML = ''; });

    document.getElementById('review-cta').innerHTML = on
      ? '<a class="btn btn-navy" style="margin-top:16px" href="/account/?review=' + id + '&back=' + encodeURIComponent(location.pathname) + '">Write a review</a> <a class="linkish" href="/guidelines/">Review guidelines</a>'
      : '<p class="notice" style="margin-top:14px">Local reviews open soon. <a href="/#signup">Get told when they do</a>.</p>';
    document.getElementById('q-cta').innerHTML = on
      ? '<a class="btn btn-ghost" style="margin-top:16px" href="/account/?ask=' + id + '&back=' + encodeURIComponent(location.pathname) + '">Ask a question</a>' : '';
  });
})();
