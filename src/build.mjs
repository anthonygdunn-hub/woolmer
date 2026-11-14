#!/usr/bin/env node
/*
 * woolmer.info static build.
 *
 *   node src/build.mjs                 live data from Supabase (CI)
 *   node src/build.mjs --fixture       data/fixture.json (local testing)
 *
 * Writes the whole site to _site/. Listings come from the wb_places table
 * (anon key, RLS only exposes listable rows). Reviews and questions are
 * loaded live in the browser, so they show as soon as they're approved.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let REV = false; // reviews switched on in admin settings
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
const SITE = 'https://woolmer.info';
const SB_URL = process.env.SUPABASE_URL || 'https://acdpgarasgfhvupzsbxf.supabase.co';
const SB_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_OWTVpDyadL1lITnCp4gfAQ_EZxVHldY';
const FIXTURE = process.argv.includes('--fixture');

// ------------------------------------------------------------------ data
async function sb(pathq) {
  const r = await fetch(`${SB_URL}/rest/v1/${pathq}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) throw new Error(`${pathq}: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}
async function load() {
  if (FIXTURE) return JSON.parse(fs.readFileSync(path.join(ROOT, 'data/fixture.json'), 'utf8'));
  const cols = 'id,slug,name,category,address,postcode,area,hygiene_rating,rated_on,lat,lng,fhrs_id,claimed,featured_until,phone,website,email,description,hours,menu,photos,tags';
  const since = new Date(Date.now() - 36e5 * 24).toISOString();
  const [places, stats, settings, events] = await Promise.all([
    sb(`wb_places?select=${cols}&listable=eq.true&order=name`),
    sb('wb_place_stats?select=id,reviews,rating'),
    sb('wb_settings?select=key,value'),
    sb(`wb_events?select=id,title,place_id,venue,starts_at,ends_at,details,price,url,kind&published=eq.true&starts_at=gte.${since}&order=starts_at&limit=300`).catch(() => []),
  ]);
  return { places, stats, settings: Object.fromEntries(settings.map(s => [s.key, s.value])), events };
}

// ------------------------------------------------------------------ helpers
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const slugify = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, 'and').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const today = new Date().toISOString().slice(0, 10);
const isFeatured = p => p.featured_until && p.featured_until >= today;

// ------------------------------------------------------------------ events (times shown in UK time)
const TZ = 'Europe/London';
const fmt = (d, o) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...o }).format(new Date(d));
const ukDay = d => fmt(d, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
const evTime = e => fmt(e.starts_at, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(':00', '').replace(' ', '') + (e.ends_at ? '–' + fmt(e.ends_at, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(':00', '').replace(' ', '') : '');
const evEnd = e => new Date(e.ends_at || new Date(e.starts_at).getTime() + 3 * 36e5);
function evCard(e, bySlug) {
  const pl = e.place_id && bySlug[e.place_id];
  const venue = pl ? `<a href="/p/${pl.slug}/">${esc(pl.name)}</a>` : esc(e.venue || '');
  return `<article class="ev" data-start="${esc(e.starts_at)}" data-end="${esc(evEnd(e).toISOString())}" data-day="${ukDay(e.starts_at)}">
  <div class="ev-date"><span>${fmt(e.starts_at, { weekday: 'short' })}</span><b>${fmt(e.starts_at, { day: 'numeric' })}</b><span>${fmt(e.starts_at, { month: 'short' })}</span></div>
  <div class="ev-body"><p class="ev-when"><span class="ev-flag" hidden></span>${evTime(e)}${e.kind ? ` · ${esc(e.kind)}` : ''}</p><h3>${e.url ? `<a href="${esc(e.url)}" rel="nofollow noopener" target="_blank">${esc(e.title)}</a>` : esc(e.title)}</h3>${venue ? `<p class="ev-venue">${venue}</p>` : ''}${e.details ? `<p class="ev-det">${esc(e.details)}</p>` : ''}${e.price ? `<p class="ev-price">${esc(e.price)}</p>` : ''}</div>
</article>`;
}

const CATS = [
  { name: 'Takeaways', blurb: 'Chippies, pizza, Chinese, Indian, kebabs and more', icon: 'bag' },
  { name: 'Pubs & bars', blurb: 'Locals, food pubs and clubs', icon: 'glass' },
  { name: 'Cafés & restaurants', blurb: 'Coffee, breakfasts, lunches and sit-down meals', icon: 'cup' },
  { name: 'Supermarkets', blurb: 'The big shops', icon: 'cart' },
  { name: 'Shops', blurb: 'Convenience stores, pharmacies and specialists', icon: 'shop' },
  { name: 'Food & catering', blurb: 'Caterers, street food and event food', icon: 'chef' },
  { name: 'Local producers', blurb: 'Wine, beer and food made here', icon: 'leaf' },
  { name: 'Places to stay', blurb: 'B&Bs and hotels', icon: 'bed' },
  { name: 'Hair & beauty', blurb: 'Hairdressers, barbers, nails, beauty and tattoos', icon: 'scissors' },
  { name: 'Health & care', blurb: 'GP surgeries, dentists, pharmacies and vets', icon: 'health' },
  { name: 'Motoring', blurb: 'Garages, MOTs, petrol stations and bikes', icon: 'car' },
  { name: 'Sport & fitness', blurb: 'Gyms, the leisure centre and golf', icon: 'run' },
  { name: 'Services', blurb: 'Solicitors, estate agents, trades and advice', icon: 'tool' },
  { name: 'Community', blurb: 'Village halls, the library and post offices', icon: 'home' },
].map(c => ({ ...c, slug: slugify(c.name) }));
const catBySlug = Object.fromEntries(CATS.map(c => [c.name, c]));
const AREAS = ['Bordon', 'Whitehill', 'Lindford', 'Headley', 'Headley Down', 'Kingsley', 'Oakhanger', 'Standford', 'Frith End', 'Blackmoor'];

const ICONS = {
  bag: '<path d="M5 8h10l-1 9H6zM7.5 8V6a2.5 2.5 0 0 1 5 0v2"/>',
  glass: '<path d="M6 3h8l-1 7a3 3 0 0 1-6 0zM10 13v4M7 17h6"/>',
  cup: '<path d="M4 7h10v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM14 8h1.5a2 2 0 0 1 0 4H14"/>',
  cart: '<path d="M3 4h2l2 9h8l2-6H6M8 17h.01M14 17h.01"/>',
  shop: '<path d="M3 8l1.5-4h11L17 8M4 8v9h12V8M3 8h14"/>',
  chef: '<path d="M6 10a3 3 0 1 1 2-5 3 3 0 0 1 4 0 3 3 0 1 1 2 5v6H6z"/>',
  leaf: '<path d="M4 16C4 8 9 4 16 4c0 7-4 12-12 12zM4 16l7-7"/>',
  bed: '<path d="M3 15V6M3 11h14v4M17 15v-3a2 2 0 0 0-2-2H9v1"/>',
  scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="14" r="2.5"/><path d="M8 7.5l9 7M8 12.5l9-7"/>',
  health: '<path d="M10 16.5s-6-3.6-6-8.2A3.3 3.3 0 0 1 10 6a3.3 3.3 0 0 1 6 2.3c0 4.6-6 8.2-6 8.2z"/>',
  car: '<path d="M3 13v-2l2-5h10l2 5v2zM3 13v2h2.5v-2M14.5 13v2H17v-2M6 10.5h.01M14 10.5h.01"/>',
  run: '<path d="M4 8v4M16 8v4M6 6v8M14 6v8M6 10h8"/>',
  tool: '<path d="M12.5 3.5a3.5 3.5 0 0 0-3.3 4.6L3.5 13.8 6.2 16.5l5.7-5.7a3.5 3.5 0 0 0 4.6-3.3l-2 2-2.2-.5-.5-2.2z"/>',
  home: '<path d="M3 9l7-5 7 5M5 8v8h10V8M8.5 16v-4h3v4"/>',
  pin: '<path d="M10 17s5-5 5-9a5 5 0 0 0-10 0c0 4 5 9 5 9z"/><circle cx="10" cy="8" r="1.8"/>',
};
const icon = (k, c = '#55C2C3', s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] || ICONS.pin}</svg>`;
const TREE = (s = 26, w = 2.2) => `<svg width="${s}" height="${s}" viewBox="0 0 26 26" aria-hidden="true"><path d="M13 2.5 L8 8.5 M13 2.5 L18 8.5 M13 8 L5.5 15.5 M13 8 L20.5 15.5 M13 13.5 L3 23 M13 13.5 L23 23 M13 2.5 V23.5" stroke="#FF862F" stroke-width="${w}" stroke-linecap="round" fill="none"/></svg>`;

// "Atlantis Fish Bar 28 Petersfield Road, Whitehill, Bordon" -> "28 Petersfield Road, Whitehill, Bordon"
function cleanAddress(p) {
  let a = p.address || '';
  const n = p.name.replace(/\b(limited|ltd)\b\.?/ig, '').trim();
  for (const pre of [p.name, n, n.replace(/^the\s+/i, '')]) {
    if (pre && a.toLowerCase().startsWith(pre.toLowerCase() + ' ')) { a = a.slice(pre.length + 1); break; }
  }
  return a;
}
const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
const fsaBadge = p => {
  const r = p.hygiene_rating;
  if (!/^[0-5]$/.test(r || '')) return r === 'AwaitingInspection' ? '<span class="fsa">Food hygiene: awaiting inspection</span>' : '';
  return `<span class="fsa"><i class="${+r <= 2 ? 'lo' : ''}">${r}</i>Food hygiene rating</span>`;
};

// ------------------------------------------------------------------ layout
const TABS = [['Home', '/', 'home'], ['Near me', '/near/', 'pin'], ['Search', '/search/', 'search'], ['Saved', '/saved/', 'heart'], ['Account', '/account/', 'user']];
const ic = (d) => `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const TAB_ICONS = {
  home: ic('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  pin: ic('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  search: ic('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  heart: ic('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'),
  user: ic('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5"/>'),
};
const NAV = [['Takeaways', '/takeaways/'], ['Pubs & bars', '/pubs-and-bars/'], ['Cafés', '/cafes-and-restaurants/'], ['Shops', '/shops/'], ["What's on", '/whats-on/'], ['Ask the town', '/ask/'], ['For businesses', '/business/']];
function page({ title, desc, path: p, body, head = '', scripts = '', noindex = false, jsonld = null }) {
  const url = SITE + p;
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta name="theme-color" content="#0C243C">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${p === '/' ? '<link rel="preload" as="image" href="/assets/img/hero-broxhead-960.webp" media="(max-width:800px)"><link rel="preload" as="image" href="/assets/img/hero-broxhead-1920.webp" media="(min-width:801px)">' : ''}
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="woolmer">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
${head}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-h">
  <div class="wrap">
    <a class="logo" href="/" aria-label="woolmer home">${TREE()}<b>woolmer</b><small>the W&amp;B guide</small></a>
    <nav class="nav" id="nav" aria-label="Main">${NAV.filter(([, h]) => REV || h !== "/ask/").map(([t, h]) => `<a href="${h}"${p.startsWith(h) ? ' aria-current="page"' : ''}>${esc(t)}</a>`).join('')}</nav>
    <div class="h-actions">
      <a class="btn btn-ghost btn-sm" href="/account/">Sign in</a>
      <a class="btn btn-navy btn-sm" href="/business/">List your business</a>
      <button class="menu-btn" type="button" aria-label="Menu" aria-controls="nav" aria-expanded="false"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 5h12M3 9h12M3 13h12" stroke="#0C243C" stroke-width="1.8" stroke-linecap="round"/></svg></button>
    </div>
  </div>
</header>
<div class="evstrip" id="evstrip" hidden></div>
<main id="main">
${body}
</main>
<footer class="site-f">
  <div class="wrap">
    <div style="max-width:320px">
      <span class="logo">${TREE(22)}<b>woolmer</b></span>
      <p style="margin:12px 0 0">An independent guide to Whitehill &amp; Bordon, built by people who live here. Named after the <a href="/#why-woolmer">Royal Forest of Woolmer</a>.</p>
    </div>
    <div class="cols">
      <div><strong>Explore</strong>${CATS.slice(0, 5).map(c => `<a href="/${c.slug}/">${esc(c.name)}</a>`).join('')}<a href="/whats-on/">What's on</a><a href="/search/">Search</a></div>
      <div><strong>Businesses</strong><a href="/business/">Claim your listing</a><a href="/business/#featured">Get featured</a><a href="/account/">Owner sign in</a></div>
      <div><strong>woolmer</strong><a href="/guidelines/">Review guidelines</a><a href="/terms/">Terms</a><a href="/privacy/">Privacy</a><a href="mailto:info@woolmer.info">info@woolmer.info</a></div>
    </div>
    <p class="small">Food hygiene ratings and some business details come from the Food Standards Agency and contain public sector information licensed under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">Open Government Licence v3.0</a>. Some other listings use data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, available under the <a href="https://opendatacommons.org/licenses/odbl/">Open Database Licence</a>. Featured listings are paid placements and are always labelled. © ${new Date().getFullYear()} woolmer</p>
  </div>
</footer>
<script>window.WB={url:${JSON.stringify(SB_URL)},key:${JSON.stringify(SB_KEY)}};</script>
<div class="install" id="install" hidden><span class="ico">${TREE(22)}</span><p>Get the free woolmer app on your phone.</p><button class="btn btn-fountain btn-sm" type="button" data-install hidden>Install</button><button class="x" type="button" data-close aria-label="Not now">×</button></div>
<nav class="tabbar" aria-label="App">${TABS.map(([t, h, ic]) => `<a href="${h}"${(h === '/' ? p === '/' : p.startsWith(h)) ? ' aria-current="page"' : ''}>${TAB_ICONS[ic]}<span>${t}</span></a>`).join('')}</nav>
<script src="/assets/site.js" defer></script>
<script src="/assets/app.js" defer></script>
<script src="/assets/events.js" defer></script>
${scripts}
</body>
</html>`;
}

// ------------------------------------------------------------------ components
function card(p, stat) {
  const c = catBySlug[p.category];
  const sub = [c ? c.name : p.category, p.area].filter(Boolean).join(' · ');
  return `<a class="card" href="/p/${p.slug}/" data-slug="${p.slug}" data-area="${esc(p.area || '')}" data-name="${esc(p.name.toLowerCase())}">
  <div class="art"><span class="initial" aria-hidden="true">${esc(p.name.replace(/^the\s+/i, '')[0] || '')}</span>${isFeatured(p) ? '<span class="badge badge-f">Featured</span>' : p.claimed ? '<span class="badge badge-v">Owner-verified</span>' : ''}</div>
  <div class="body">
    <h3>${esc(p.name)}</h3>
    <span class="meta">${esc(sub)}</span>
    ${stat && stat.reviews ? `<span class="meta"><span class="stars">★ ${stat.rating}</span> from ${stat.reviews} review${stat.reviews > 1 ? 's' : ''}</span>` : ''}
    <div class="tags">${fsaBadge(p)}${(p.tags || []).slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
  </div>
</a>`;
}
const sortPlaces = (a, b) => (isFeatured(b) - isFeatured(a)) || (b.claimed - a.claimed) || a.name.localeCompare(b.name);

const signupBlock = `<section class="sec" id="signup"><div class="wrap"><div class="panel" style="display:flex;flex-wrap:wrap;gap:36px">
  <div style="flex:1 1 280px;min-width:0"><h2>Stay in the loop</h2><p class="muted">Get the odd email when new places, events and features land. Run a local business? Tell us and we'll help you get your listing looking its best.</p></div>
  <form class="form" id="su-form" style="flex:2 1 400px;min-width:0" novalidate>
    <div class="seg" role="group" aria-label="I am"><button type="button" data-kind="resident" aria-pressed="true">I live locally</button><button type="button" data-kind="business" aria-pressed="false">I run a business</button></div>
    <div class="row2"><label>Your name<input name="name" autocomplete="name" maxlength="120"></label><label>Email<input name="email" type="email" autocomplete="email" required maxlength="200"></label></div>
    <div class="biz-only" hidden><div class="row2"><label>Business name<input name="business_name" autocomplete="organization" maxlength="160"></label><label>Phone (optional)<input name="phone" type="tel" autocomplete="tel" maxlength="40"></label></div></div>
    <label class="hp" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>
    <label class="check"><input type="checkbox" name="consent" required><span>I'm happy for woolmer to email me. You can ask us to delete your details any time. <a href="/privacy/">Privacy</a>.</span></label>
    <button class="btn btn-navy" type="submit" style="align-self:flex-start">Sign me up</button>
    <p class="msg" role="status" aria-live="polite"></p>
  </form>
</div></div></section>`;

const whyBlock = `<section class="sec" id="why-woolmer"><div class="wrap"><div class="why-card">
  <div class="why-l dk">${TREE(56, 1.8)}<div><p class="eyebrow">Why "woolmer"?</p><h2>Named after the forest we all live in.</h2></div></div>
  <div class="why-r">
    <p>Long before the Army arrived, before the regeneration and long before Bordon had a high street, this whole area was the <strong>Royal Forest of Woolmer</strong>, open heath and woodland where kings came to hunt deer. Edward I hunted here in the 13th century, and Gilbert White wrote about "Wolmer Forest" in his Natural History of Selborne.</p>
    <p>In the 1860s the forest was enclosed and turned into Army training land. That brought the camps at Bordon and Longmoor, and Bordon grew from a hamlet of about a hundred people into the town we know.</p>
    <p>The name never left. It's on Woolmer Road, the Woolmer Trading Estate and the Woolmer Forest Heritage Society, and the protected heathland is still on our doorstep. We chose it so the guide belongs to all of us, in Whitehill, Bordon, Lindford and Headley Down, and keeps the place's oldest name alive.</p>
  </div>
</div></div></section>`;

// ------------------------------------------------------------------ pages
function build(data) {
  const places = data.places.map(p => ({ ...p, address_clean: cleanAddress(p) }));
  const stats = Object.fromEntries((data.stats || []).map(s => [s.id, s]));
  const settings = data.settings || {};
  REV = settings.reviews_enabled === true;
  const files = {};
  const byId = Object.fromEntries(places.map(p => [p.id, p]));
  const upcoming = (data.events || []).filter(e => evEnd(e) > new Date()).sort((a, b) => a.starts_at < b.starts_at ? -1 : 1);
  const sitemap = ['/', '/whats-on/', '/search/', '/ask/', '/business/', '/guidelines/', '/terms/', '/privacy/'];

  // home
  const counts = Object.fromEntries(CATS.map(c => [c.name, places.filter(p => p.category === c.name).length]));
  const featured = places.filter(isFeatured);
  const showcase = (featured.length ? featured : places.filter(p => p.category === 'Takeaways')).sort(sortPlaces);
  files['index.html'] = page({
    title: 'woolmer — the Whitehill & Bordon guide',
    desc: `Every takeaway, pub, café and shop in Whitehill & Bordon in one place: ${places.length} local businesses with food hygiene ratings, opening hours${REV ? ', menus and local reviews' : ' and menus'}.`,
    path: '/',
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'woolmer', url: SITE + '/', potentialAction: { '@type': 'SearchAction', target: SITE + '/search/?q={q}', 'query-input': 'required name=q' } },
    body: `<section class="hero hero-photo dk"><div class="hero-bg" aria-hidden="true"></div><div class="wrap">
  <p class="eyebrow">Whitehill · Bordon · Lindford · Headley Down</p>
  <h1>Everything local, finally in <span>one place.</span></h1>
  <p class="lead">${places.length} local takeaways, pubs, cafés and shops, with maps, food hygiene ratings, opening hours and menus${REV ? ', and answers from people who live here' : ''}.</p>
  <form class="search" action="/search/" role="search"><label class="sr" for="q">Search woolmer</label><input id="q" name="q" type="search" placeholder="Try &quot;chippy&quot;, &quot;pub Headley&quot; or &quot;Lidl&quot;"><button class="btn btn-fountain" type="submit">Search</button></form>
  <div class="chips"><a class="chip" href="/near/">📍 Near me</a>${CATS.slice(0, 5).map(c => `<a class="chip" href="/${c.slug}/">${esc(c.name)}</a>`).join('')}</div>
</div><p class="hero-credit">Photo: <a href="https://commons.wikimedia.org/wiki/File:Pond_on_Broxhead_Common,_Hampshire_-_geograph.org.uk_-_5927349.jpg" rel="nofollow">Pond on Broxhead Common</a> by John P Reeves, <a href="https://creativecommons.org/licenses/by-sa/2.0/" rel="nofollow">CC BY-SA 2.0</a></p></section>
<section class="sec sec-band"><div class="wrap">
  <div class="sec-head"><h2>What are you after?</h2><a href="/search/">Search everything</a></div>
  <div class="cats">${CATS.filter(c => counts[c.name]).map((c, i) => `<a class="cat" style="--i:${i}" href="/${c.slug}/"><span class="ico">${icon(c.icon)}</span><span><b>${esc(c.name)}</b><span>${counts[c.name]} place${counts[c.name] > 1 ? 's' : ''}</span></span></a>`).join('')}</div>
</div></section>
<section class="sec" id="wo-home"${upcoming.length ? '' : ' hidden'}><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow" style="color:var(--teal-d)">Coming up</p><h2>What's on</h2></div><a href="/whats-on/">All events</a></div>
  <div class="evs" id="wo-list" data-limit="6">${upcoming.slice(0, 6).map(e => evCard(e, byId)).join('')}</div>
</div></section>
<section class="sec"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow" style="color:var(--teal-d)">${featured.length ? 'Featured' : '<span data-night>Tonight, sorted</span>'}</p><h2>${featured.length ? 'Featured local businesses' : 'Takeaways'}</h2></div><a href="/takeaways/">All takeaways</a></div>
  <div class="grid" data-split="${featured.length ? 'today' : 'tonight'}" data-limit="8">${showcase.map((p, i) => card(p, stats[p.id]).replace('<a class="card"', i >= 8 ? '<a hidden class="card"' : '<a class="card"')).join('')}</div>
</div></section>
<section class="sec" style="padding-top:0"><div class="wrap"><div class="panel panel-dk dk" style="display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between">
  <div style="flex:1 1 420px"><h2>Run a local business?</h2><p style="margin:8px 0 0">Your business is probably already here. Claim it free to add your menu, opening hours, photos and contact details${REV ? ', and reply to reviews' : ''}.</p></div>
  <a class="btn btn-fountain" href="/business/">Claim your listing</a>
</div></div></section>
${whyBlock}
${signupBlock}`,
  });

  // categories
  for (const c of CATS) {
    const list = places.filter(p => p.category === c.name).sort(sortPlaces);
    if (!list.length) continue;
    const areas = [...new Set(list.map(p => p.area).filter(Boolean))].sort((a, b) => AREAS.indexOf(a) - AREAS.indexOf(b));
    const pins = list.filter(p => p.lat && p.lng).map(p => ({ n: p.name, s: p.slug, lat: p.lat, lng: p.lng }));
    sitemap.push(`/${c.slug}/`);
    files[`${c.slug}/index.html`] = page({
      title: `${c.name} in Whitehill & Bordon — woolmer`,
      desc: `${list.length} ${c.name.toLowerCase()} in Whitehill, Bordon and nearby villages, with food hygiene ratings, opening hours${REV ? ' and local reviews' : ''}.`,
      path: `/${c.slug}/`,
      head: pins.length ? '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">' : '',
      scripts: pins.length ? '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin="" defer></script>' : '',
      body: `<section class="ph dk"><div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / ${esc(c.name)}</nav><h1>${esc(c.name)} in Whitehill &amp; Bordon</h1><p>${esc(c.blurb)}. ${list.length} place${list.length > 1 ? 's' : ''}.</p></div></section>
<section class="sec" style="padding-top:28px"><div class="wrap">
  <div class="chips" role="group" aria-label="Filter by area" style="margin:0 0 20px"><button class="chip chip-l" type="button" data-area="" aria-pressed="true">Everywhere</button>${areas.map(a => `<button class="chip chip-l" type="button" data-area="${esc(a)}" aria-pressed="false">${esc(a)}</button>`).join('')}</div>
  ${pins.length ? `<div class="map map-lg" id="map" data-pins="${esc(JSON.stringify(pins))}" role="region" aria-label="Map of ${esc(c.name.toLowerCase())}" style="margin-bottom:24px"></div>` : ''}
  <div class="grid" id="list" data-split="${c.name === 'Takeaways' ? 'tonight' : 'today'}">${list.map(p => card(p, stats[p.id])).join('')}</div>
  <p class="muted" style="font-size:14px;margin-top:24px">Missing somewhere? <a href="mailto:info@woolmer.info?subject=Missing%20from%20woolmer">Tell us</a> and we'll add it.</p>
</div></section>`,
    });
  }

  // areas
  for (const a of AREAS) {
    const list = places.filter(p => p.area === a).sort(sortPlaces);
    if (!list.length) continue;
    const slug = `area/${slugify(a)}`;
    sitemap.push(`/${slug}/`);
    const groups = CATS.map(c => [c, list.filter(p => p.category === c.name)]).filter(([, l]) => l.length);
    files[`${slug}/index.html`] = page({
      title: `Local businesses in ${a} — woolmer`,
      desc: `${list.length} takeaways, pubs, cafés and shops in ${a}, near Bordon, with food hygiene ratings and opening hours.`,
      path: `/${slug}/`,
      body: `<section class="ph dk"><div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / ${esc(a)}</nav><h1>${esc(a)}</h1><p>${list.length} local business${list.length > 1 ? 'es' : ''}.</p></div></section>
${groups.map(([c, l]) => `<section class="sec" style="padding-bottom:0"><div class="wrap"><div class="sec-head"><h2>${esc(c.name)}</h2><a href="/${c.slug}/">All ${esc(c.name.toLowerCase())}</a></div><div class="grid">${l.map(p => card(p, stats[p.id])).join('')}</div></div></section>`).join('')}
<div style="height:64px"></div>`,
    });
  }

  // places
  for (const p of places) {
    const c = catBySlug[p.category];
    const st = stats[p.id];
    sitemap.push(`/p/${p.slug}/`);
    const addr = [p.address_clean, p.postcode].filter(Boolean).join(', ');
    const hours = p.hours && typeof p.hours === 'object' ? p.hours : null;
    const menu = Array.isArray(p.menu) ? p.menu : null;
    const ld = {
      '@context': 'https://schema.org', '@type': p.category === 'Takeaways' || p.category === 'Cafés & restaurants' ? 'Restaurant' : p.category === 'Pubs & bars' ? 'BarOrPub' : p.category === 'Places to stay' ? 'LodgingBusiness' : 'LocalBusiness',
      name: p.name, url: `${SITE}/p/${p.slug}/`,
      address: { '@type': 'PostalAddress', streetAddress: p.address_clean || undefined, addressLocality: p.area || 'Bordon', postalCode: p.postcode || undefined, addressCountry: 'GB' },
      telephone: p.phone || undefined, sameAs: p.website ? [p.website] : undefined,
      geo: p.lat ? { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng } : undefined,
      aggregateRating: st && st.reviews ? { '@type': 'AggregateRating', ratingValue: st.rating, reviewCount: st.reviews } : undefined,
    };
    const dirUrl = p.lat ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ' ' + addr)}`;
    files[`p/${p.slug}/index.html`] = page({
      title: `${p.name}, ${p.area || 'Bordon'} — ${c ? c.name : p.category} — woolmer`,
      desc: p.description ? p.description.slice(0, 155) : (p.fhrs_id ? `${p.name} in ${p.area || 'Bordon'}${p.postcode ? ' (' + p.postcode + ')' : ''}: food hygiene rating ${/^[0-5]$/.test(p.hygiene_rating || '') ? p.hygiene_rating + ' out of 5' : 'pending'}, address and opening hours${REV ? ', plus local reviews' : ''}.` : `${p.name}, ${p.category.toLowerCase()} in ${p.area || 'Bordon'}${p.postcode ? ' (' + p.postcode + ')' : ''}: address, phone and opening hours${REV ? ', plus local reviews' : ''}.`),
      path: `/p/${p.slug}/`,
      jsonld: ld,
      head: p.lat ? '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">' : '',
      scripts: (p.lat ? '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin="" defer></script>' : '') + '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js" defer></script><script src="/assets/place.js" defer></script>',
      body: `<section class="ph dk"><div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / ${c ? `<a href="/${c.slug}/">${esc(c.name)}</a>` : esc(p.category)} / ${esc(p.name)}</nav>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${isFeatured(p) ? '<span class="badge badge-f">Featured</span>' : ''}${p.claimed ? '<span class="badge badge-v">Owner-verified listing</span>' : ''}<span id="open-now"></span></div>
  <h1>${esc(p.name)}</h1>
  <p>${esc([c ? c.name : p.category, addr].filter(Boolean).join(' · '))}</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">${p.phone ? `<a class="btn btn-fountain" href="tel:${esc(p.phone.replace(/\s+/g, ''))}">Call ${esc(p.phone)}</a>` : ''}<a class="btn btn-line" href="${esc(dirUrl)}" rel="noopener">Directions</a><button class="btn btn-line" type="button" data-save="${esc(p.slug)}" aria-pressed="false">♡ Save</button>${p.website ? `<a class="btn btn-line" href="${esc(p.website)}" rel="noopener nofollow">Website</a>` : ''}</div>
</div></section>
<section class="sec" style="padding-top:28px"><div class="wrap"><div class="place-grid" id="place" data-id="${p.id}" data-slug="${esc(p.slug)}" data-name="${esc(p.name)}" ${hours ? `data-hours='${esc(JSON.stringify(hours))}'` : ''}>
  <div class="place-main">
    ${p.description ? `<div class="panel"><h2>About</h2><p style="margin:0">${esc(p.description)}</p>${(p.tags || []).length ? `<div class="tags">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}</div>` : ''}
    ${menu && menu.length ? `<div class="panel" id="menu"><h2>Menu</h2>${menu.map(s => `<div class="menu-sec"><h3>${esc(s.section)}</h3>${(s.items || []).map(i => `<div class="menu-item"><span>${esc(i.name)}${i.desc ? `<small>${esc(i.desc)}</small>` : ''}</span>${i.price ? `<strong>£${esc(String(i.price).replace(/^£/, ''))}</strong>` : ''}</div>`).join('')}</div>`).join('')}<p class="muted" style="font-size:13px;margin:14px 0 0">Prices set by the business. Check allergens with them before you order.</p></div>` : ''}
    <div class="panel" id="reviews"><h2>Local reviews</h2><div id="reviews-list"><p class="muted">Loading reviews…</p></div><div id="review-cta"></div></div>
    <div class="panel" id="questions"><h2>Questions</h2><div id="q-list"><p class="muted">Loading…</p></div><div id="q-cta"></div></div>
  </div>
  <aside class="place-side">
    ${hours ? `<div class="panel"><h2 style="font-size:22px">Opening hours</h2><table class="hours"><tbody>${DAYS.map(([k, d]) => `<tr data-day="${k}"><td>${d}</td><td>${esc(hours[k] || 'Closed')}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="panel"><div class="facts">
      ${addr ? `<div><strong>Address</strong><br>${esc(addr)}</div>` : ''}
      ${p.phone ? `<div><strong>Phone</strong><br><a href="tel:${esc(p.phone.replace(/\s+/g, ''))}">${esc(p.phone)}</a></div>` : ''}
      ${p.email ? `<div><strong>Email</strong><br><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></div>` : ''}
      ${p.hygiene_rating ? `<div><strong>Food hygiene</strong><br>${fsaBadge(p) || esc(p.hygiene_rating)}${p.rated_on ? `<br><span class="muted" style="font-size:13px">Inspected ${new Date(p.rated_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. <a href="https://ratings.food.gov.uk/business/${p.fhrs_id}" rel="noopener">See it on the FSA site</a></span>` : ''}</div>` : ''}
    </div></div>
    ${p.lat ? `<div class="map" id="map" data-pins="${esc(JSON.stringify([{ n: p.name, s: p.slug, lat: p.lat, lng: p.lng }]))}" role="region" aria-label="Map showing ${esc(p.name)}"></div>` : ''}
    ${p.claimed ? `<p class="muted" style="font-size:13px;margin:0">This listing is managed by the business. Spotted something wrong? <button class="linkish" type="button" data-report="listing" data-id="${p.id}">Report it</button></p>`
      : `<div class="panel panel-dk dk"><h2 style="font-size:24px">Is this your business?</h2><p>Claim it free to add your menu, opening hours, photos and phone number${REV ? ', and reply to reviews' : ''}.</p><a class="btn btn-fountain" href="/claim/?p=${esc(p.slug)}">Claim this listing</a></div>`}
  </aside>
</div></div></section>`,
    });
  }

  // what's on
  const days = [...new Set(upcoming.map(e => ukDay(e.starts_at)))];
  files['whats-on/index.html'] = page({
    title: "What's on in Whitehill & Bordon — woolmer", desc: 'Live music, quizzes, markets, sport and family events in Whitehill, Bordon, Lindford and Headley Down.', path: '/whats-on/',
    jsonld: upcoming.length ? upcoming.slice(0, 30).map(e => { const pl = e.place_id && byId[e.place_id]; return { '@context': 'https://schema.org', '@type': 'Event', name: e.title, startDate: e.starts_at, endDate: evEnd(e).toISOString(), eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', description: e.details || undefined, location: { '@type': 'Place', name: pl ? pl.name : (e.venue || 'Whitehill & Bordon'), address: pl ? [pl.address_clean, pl.postcode].filter(Boolean).join(', ') || 'Whitehill & Bordon' : 'Whitehill & Bordon, Hampshire' } }; }) : null,
    body: `<section class="ph dk"><div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / What's on</nav><h1>What's on</h1><p>Live music, quizzes, markets, sport and family days around Whitehill &amp; Bordon.</p></div></section>
<section class="sec" style="padding-top:28px"><div class="wrap">
  <div class="chips wo-filter" role="group" aria-label="Show"><button class="chip chip-l on" data-f="all" type="button">Everything</button><button class="chip chip-l" data-f="today" type="button">Today</button><button class="chip chip-l" data-f="weekend" type="button">This weekend</button><button class="chip chip-l" data-f="week" type="button">Next 7 days</button></div>
  <div id="wo-all">${days.length ? days.map(d => `<div class="wo-day" data-day="${d}"><h2 class="wo-h">${fmt(d + 'T12:00:00Z', { weekday: 'long', day: 'numeric', month: 'long' })}</h2><div class="evs">${upcoming.filter(e => ukDay(e.starts_at) === d).map(e => evCard(e, byId)).join('')}</div></div>`).join('') : ''}</div>
  <p class="muted" id="wo-none"${days.length ? ' hidden' : ''}>Nothing listed yet. Running something? Email <a href="mailto:info@woolmer.info">info@woolmer.info</a> and we'll add it free.</p>
</div></section>`,
  });
  files['events.json'] = JSON.stringify(upcoming.map(e => { const pl = e.place_id && byId[e.place_id]; return { ...e, place: pl ? { slug: pl.slug, name: pl.name } : null }; }));

  // search
  files['search/index.html'] = page({
    title: 'Search Whitehill & Bordon — woolmer', desc: 'Search every local takeaway, pub, café and shop in Whitehill & Bordon.', path: '/search/',
    scripts: '<script src="/assets/search.js" defer></script>',
    body: `<section class="ph dk"><div class="wrap"><h1>Search</h1><form class="search" role="search" style="margin-top:20px" id="s-form"><label class="sr" for="s-q">Search woolmer</label><input id="s-q" name="q" type="search" placeholder="Name, type of food or village" autocomplete="off"><button class="btn btn-fountain" type="submit">Search</button></form></div></section>
<section class="sec" style="padding-top:28px"><div class="wrap"><p class="muted" id="s-count" aria-live="polite"></p><div class="grid" id="s-results"></div></div></section>`,
  });
  files['places.json'] = JSON.stringify(places.map(p => ({ s: p.slug, n: p.name, c: p.category, a: p.area || '', t: (p.tags || []).join(' '), d: (p.description || '').slice(0, 160), h: p.hygiene_rating, f: isFeatured(p) ? 1 : 0, v: p.claimed ? 1 : 0, la: p.lat ? +(+p.lat).toFixed(5) : undefined, lo: p.lng ? +(+p.lng).toFixed(5) : undefined, o: p.hours && Object.values(p.hours).some(v => v && !/closed/i.test(v)) ? p.hours : undefined })));

  // ask the town
  files['ask/index.html'] = page({
    title: 'Ask the town — woolmer', desc: 'Ask a question and get answers from people who live in Whitehill & Bordon.', path: '/ask/',
    scripts: '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js" defer></script><script src="/assets/ask.js" defer></script>',
    body: `<section class="ph dk"><div class="wrap"><h1>Ask the town</h1><p>Best chippy for a Monday? Under-8s football on Saturdays? Ask, and people who live here will answer.</p></div></section>
<section class="sec" style="padding-top:28px"><div class="wrap narrow"><div id="ask-cta"></div><div id="ask-list" class="panel" style="margin-top:20px"><p class="muted">Loading…</p></div></div></section>`,
  });

  // business
  const price = settings.featured_price_gbp ?? 20;
  files['business/index.html'] = page({
    title: 'For local businesses — woolmer', desc: `Claim your free woolmer listing: add your menu, opening hours and photos${REV ? ', reply to reviews' : ''}, and get featured in front of Whitehill & Bordon.`, path: '/business/',
    body: `<section class="ph dk"><div class="wrap"><h1>Your business, in front of the whole town</h1><p>woolmer lists local businesses across Whitehill &amp; Bordon from public records, including the Food Standards Agency and OpenStreetMap. Claim yours to make it yours.</p></div></section>
<section class="sec"><div class="wrap"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
  <div class="panel"><p class="eyebrow" style="color:var(--teal-d)">Free, forever</p><h2>Claim your listing</h2><ul style="padding-left:18px;margin:12px 0 20px"><li>Add your opening hours, phone and website</li><li>Put your full menu online</li>${REV ? '<li>Reply to reviews and answer questions</li>' : ''}<li>Get the "Owner-verified" badge</li></ul><a class="btn btn-navy" href="/search/">Find your business</a><p class="muted" style="font-size:14px;margin:12px 0 0">Not listed? <a href="mailto:info@woolmer.info?subject=Add%20my%20business%20to%20woolmer">Email us</a> and we'll add you.</p></div>
  <div class="panel panel-dk dk" id="featured"><p class="eyebrow">£${esc(price)} a month</p><h2>Get featured</h2><ul style="padding-left:18px;margin:12px 0 20px;color:var(--od2)"><li>Top of your category, with a Featured badge</li><li>On the woolmer home page</li><li>Shared on woolmer's Facebook and Instagram</li><li>No contract, cancel any month</li></ul><a class="btn btn-fountain" href="mailto:info@woolmer.info?subject=Featured%20listing%20on%20woolmer">Ask about featuring</a></div>
</div>
<div class="panel" style="margin-top:20px"><h2>Need a proper website?</h2><p class="muted" style="margin:8px 0 16px">woolmer is built by <a href="https://dunnworks.io">Dunnworks</a>, a Bordon web designer. Hand-coded, fast websites for local businesses, from £750, with no monthly platform fee.</p><a class="btn btn-ghost" href="https://dunnworks.io">See Dunnworks</a></div>
</div></section>`,
  });

  // claim + account (client side)
  const SBJS = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js" defer></script>';
  files['claim/index.html'] = page({
    title: 'Claim your listing — woolmer', desc: 'Claim your business listing on woolmer.', path: '/claim/', noindex: true,
    scripts: SBJS + '<script src="/assets/account.js" defer></script>',
    body: `<section class="ph dk"><div class="wrap"><h1>Claim your listing</h1><p>It's free. We check every claim, usually within a day, by ringing the business on its public number.</p></div></section>
<section class="sec" style="padding-top:28px"><div class="wrap narrow"><div class="panel" id="app" data-view="claim"><p class="muted">Loading…</p></div></div></section>`,
  });
  files['account/index.html'] = page({
    title: 'Your woolmer account', desc: 'Sign in to woolmer.', path: '/account/', noindex: true,
    scripts: SBJS + '<script src="/assets/account.js" defer></script>',
    body: `<section class="ph dk"><div class="wrap"><h1>Your account</h1><p>Sign in with a link sent to your email. No passwords.</p></div></section>
<section class="sec" style="padding-top:28px"><div class="wrap narrow"><div class="panel" id="app" data-view="account"><p class="muted">Loading…</p></div></div></section>`,
  });

  // legal pages
  const legal = (slug, title, html) => { files[`${slug}/index.html`] = page({ title: `${title} — woolmer`, desc: `${title} for woolmer.info`, path: `/${slug}/`, body: `<section class="ph dk"><div class="wrap"><h1>${title}</h1></div></section><section class="sec" style="padding-top:28px"><div class="wrap narrow"><div class="panel">${html}</div></div></section>` }); };
  for (const [slug, title] of [['terms', 'Terms of use'], ['guidelines', 'Review and Q&A guidelines'], ['privacy', 'Privacy']]) {
    legal(slug, title, fs.readFileSync(path.join(ROOT, 'content', `${slug}.html`), 'utf8'));
  }

  files['404.html'] = page({ title: 'Not found — woolmer', desc: 'Page not found', path: '/404', noindex: true, body: `<section class="ph dk"><div class="wrap"><h1>Lost in the forest</h1><p>That page isn't here. <a href="/" style="color:var(--fountain)">Head home</a> or <a href="/search/" style="color:var(--fountain)">search</a>.</p></div></section>` });
  // ---------------------------------------------------------------- app pages
  files['near/index.html'] = page({
    title: 'Near me — woolmer', desc: 'Takeaways, pubs, cafés and shops in Whitehill & Bordon, nearest first, and what\'s open right now.', path: '/near/',
    body: `<section class="ph dk"><div class="wrap"><h1>Near me</h1><p>Sorted by distance from where you are. Your location stays on your phone.</p>
  <div class="near-tools" id="near"><button class="btn btn-fountain btn-sm" type="button" id="near-locate">Use my location</button><button class="chip-t" type="button" id="near-open" aria-pressed="false">Open now</button><label class="sr" for="near-cat">Type of place</label><select id="near-cat"><option value="">Everything</option></select></div></div></section>
<section class="sec" style="padding-top:24px"><div class="wrap"><p class="muted" id="near-note" aria-live="polite">Loading places…</p><div class="grid" id="near-list"></div></div></section>`,
  });
  sitemap.push('/near/');
  files['saved/index.html'] = page({
    title: 'Saved — woolmer', desc: 'Your saved places on woolmer.', path: '/saved/', noindex: true,
    body: `<section class="ph dk"><div class="wrap"><h1>Saved</h1><p>Places you've saved. They stay on this phone, and work without signal.</p></div></section>
<section class="sec" style="padding-top:24px"><div class="wrap"><div class="grid" id="saved-list"></div>
<div class="panel" id="alerts" style="margin-top:28px;max-width:640px"><h2 style="font-size:22px">Local alerts</h2><p class="muted" style="margin:8px 0 14px">The odd alert worth having: new places opening, local events and offers from Whitehill &amp; Bordon businesses. No more than one or two a week.</p><button class="btn btn-navy btn-sm" type="button">Turn alerts on</button><p class="msg" role="status" aria-live="polite" style="margin:10px 0 0"></p></div>
</div></section>`,
  });
  files['offline/index.html'] = page({
    title: 'Offline — woolmer', desc: 'You are offline.', path: '/offline/', noindex: true,
    body: `<section class="ph dk"><div class="wrap"><h1>No signal right now</h1><p>Pages you've opened before and your <a href="/saved/" style="color:#fff">saved places</a> still work. Everything else will be back when you're online.</p></div></section>`,
  });
  files['manifest.webmanifest'] = JSON.stringify({
    name: 'woolmer: the Whitehill & Bordon guide', short_name: 'woolmer',
    description: 'Every takeaway, pub, café, shop and service in Whitehill, Bordon, Lindford and Headley, with what\'s open now and what\'s near you.',
    id: '/', start_url: '/?source=app', scope: '/', display: 'standalone', orientation: 'portrait',
    background_color: '#F5F7F8', theme_color: '#0C243C', categories: ['food', 'lifestyle', 'shopping', 'travel'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Open now', url: '/near/?open=1', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Near me', url: '/near/', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Takeaways', url: '/takeaways/', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Saved', url: '/saved/', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }, null, 2);
  files['sw.js'] = fs.readFileSync(path.join(ROOT, 'src/sw.template.js'), 'utf8').replace('__VERSION__', new Date().toISOString().replace(/\D/g, '').slice(0, 12));

  // old café URL from before accents were handled
  files['caf-s-and-restaurants/index.html'] = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Cafés & restaurants — woolmer</title><meta name="robots" content="noindex"><link rel="canonical" href="${SITE}/cafes-and-restaurants/"><meta http-equiv="refresh" content="0;url=/cafes-and-restaurants/"></head><body><p><a href="/cafes-and-restaurants/">Cafés & restaurants</a></p></body></html>\n`;
  files['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap.map(u => `<url><loc>${SITE}${u}</loc></url>`).join('')}</urlset>\n`;
  files['robots.txt'] = `User-agent: *\nAllow: /\nDisallow: /account/\nDisallow: /claim/\nDisallow: /admin/\nSitemap: ${SITE}/sitemap.xml\n`;
  files['CNAME'] = 'woolmer.info\n';
  files['.nojekyll'] = '';
  return files;
}

// ------------------------------------------------------------------ write
const data = await load();
fs.rmSync(OUT, { recursive: true, force: true });
const files = build(data);
for (const [f, c] of Object.entries(files)) {
  const p = path.join(OUT, f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, c);
}
for (const d of ['assets', 'admin', 'icons']) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });
for (const f of ['favicon.svg']) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
fs.copyFileSync(path.join(ROOT, 'privacy.html'), path.join(OUT, 'privacy.html'));
console.log(`Built ${Object.keys(files).length} files for ${data.places.length} places${FIXTURE ? ' (fixture)' : ''}`);
