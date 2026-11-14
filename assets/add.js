/* woolmer — add your business */
(function () {
  var f = document.getElementById('addf'), WB = window.WB;
  if (!f) return;
  var c = new URLSearchParams(location.search).get('c');
  if (c) [].forEach.call(f.category.options, function (o) { if (o.value === c || o.text === c) o.selected = true; });
  f.onsubmit = function (e) {
    e.preventDefault();
    var m = f.querySelector('.msg'), b = f.querySelector('button');
    if (f.company_fax.value) return;
    var v = function (n) { var x = (f[n].value || '').trim(); return x || null; };
    var web = v('website');
    if (web && !/^https:\/\//i.test(web)) web = /^http:\/\//i.test(web) ? web.replace(/^http:/i, 'https:') : 'https://' + web;
    if (!v('name') || !f.category.value || !v('contact_name') || !v('contact_email') || !/.+@.+\..+/.test(v('contact_email'))) {
      m.className = 'msg err'; m.textContent = 'Please fill in the business name, type, your name and a valid email.'; return;
    }
    b.disabled = true; m.className = 'msg'; m.textContent = 'Sending…';
    WB.rest('wb_submissions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: {
      name: v('name'), category: f.category.value, area: f.area.value || null, address: v('address'), postcode: v('postcode') && v('postcode').toUpperCase(),
      phone: v('phone'), website: web, email: v('email'), description: v('description'),
      contact_name: v('contact_name'), contact_email: v('contact_email'), is_owner: f.is_owner.checked
    } }).then(function () {
      f.innerHTML = '<h2>Thanks, that\'s with us</h2><p>We check every new listing by hand, usually within a day or two. We\'ll email you when it\'s live.</p><p><a class="btn btn-ghost" href="/">Back to woolmer</a></p>';
    }).catch(function () { b.disabled = false; m.className = 'msg err'; m.textContent = 'Something went wrong. Please try again, or email info@woolmer.info.'; });
  };
})();
