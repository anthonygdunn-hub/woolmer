/* woolmer — Ask the town */
(function () {
  var WB = window.WB, list = document.getElementById('ask-list'), cta = document.getElementById('ask-cta');
  if (!list) return;
  var date = function (s) { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  WB.getSettings().then(function (s) {
    var on = s.reviews_enabled === true;
    cta.innerHTML = on ? '<a class="btn btn-navy" href="/account/?ask=town&back=/ask/">Ask a question</a>'
      : '<p class="notice">Ask the town opens soon. <a href="/#signup">Get told when it does</a>.</p>';
    WB.rest('wb_questions?select=id,display_name,body,topic,created_at,wb_answers(id,display_name,body,status,created_at)&place_id=is.null&status=eq.approved&order=created_at.desc&limit=50').then(function (rows) {
      if (!rows.length) { list.innerHTML = '<p class="muted" style="margin:0">No questions yet.</p>'; return; }
      list.innerHTML = rows.map(function (q) {
        var ans = (q.wb_answers || []).filter(function (a) { return a.status === 'approved'; });
        return '<article class="review"><strong>' + WB.esc(q.body) + '</strong><div class="muted" style="font-size:13px">' + WB.esc(q.display_name) + ' · ' + date(q.created_at) + (q.topic ? ' · ' + WB.esc(q.topic) : '') + ' · ' + ans.length + ' answer' + (ans.length === 1 ? '' : 's') + '</div>' +
          ans.map(function (a) { return '<div class="reply"><strong>' + WB.esc(a.display_name) + ':</strong> ' + WB.esc(a.body) + ' <button class="linkish" type="button" data-report="answer" data-id="' + a.id + '">Report</button></div>'; }).join('') +
          (on ? '<a class="linkish" href="/account/?answer=' + q.id + '&back=/ask/">Answer</a> ' : '') + '<button class="linkish" type="button" data-report="question" data-id="' + q.id + '">Report</button></article>';
      }).join('');
    }).catch(function () { list.innerHTML = '<p class="muted">Couldn\'t load questions just now.</p>'; });
  });
})();
