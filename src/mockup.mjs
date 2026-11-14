// Dunnworks concept mock-ups: one sample website per local independent business on woolmer.
// Clearly labelled as a concept, not the business's official site, and kept out of search engines.

const CHAIN = /\b(tesco|lidl|aldi|asda|co-?op|boots|b&m|b & m|mcdonald|subway|costa|greggs|domino|papa john|kfc|burger king|spar|budgens|morrisons|sainsbury|shell|esso|\bbp\b|\bjet\b|texaco|iceland|home bargains|one stop|premier|londis|nisa|starbucks|wetherspoon|post office|specsavers|halfords|kwik fit|card factory|superdrug|lloyds|ladbrokes|coral|william hill|timpson|barclays|natwest|hsbc|santander|nationwide|jobcentre|citizens advice|screwfix|toolstation|wickes|pets at home|vets4pets|idh dentists|mydentist|bupa|the range|poundland|pound stretcher|savers|evans cycles|currys|argos|amazon|dpd|royal mail|travelodge|premier inn|snappy tomato)\b/i;
const NOT_BIZ = /\b(surgery|hospital|nhs|church|chapel|school|academy|library|council|village hall|community centre|recycling centre|jobcentre|scout|guides|play area|park|inclosure|recreation ground|common)\b/i;
const NO_MOCKUP_CATS = new Set(['Community', 'Parks & outdoors', 'Supermarkets']);

export function wantsMockup(p) {
  if (!p || !p.name || NO_MOCKUP_CATS.has(p.category)) return false;
  if (CHAIN.test(p.name)) return false;
  if (p.category === 'Doctors, dentists & vets' && /surgery|hospital|nhs/i.test(p.name)) return false;
  if (NOT_BIZ.test(p.name) && !/cafe|café|kitchen|bar|inn/i.test(p.name)) return false;
  return true;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DW = 'https://dunnworks.io/?utm_source=woolmer&utm_medium=referral&utm_campaign=mockup';
const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];

// One look per kind of business
const THEMES = {
  food:   { bg: '#FFF8F0', ink: '#2B1A10', accent: '#D9480F', accent2: '#FFC94A', soft: '#FFE8D6', display: 'Archivo Black', body: 'Inter', radius: '18px' },
  cafe:   { bg: '#FBF6EE', ink: '#2F2620', accent: '#8C5A3C', accent2: '#C9A27E', soft: '#F1E4D3', display: 'Fraunces', body: 'Inter', radius: '22px' },
  pub:    { bg: '#F4F1EA', ink: '#1F2A24', accent: '#1F4D3A', accent2: '#C8A24A', soft: '#E3E7DF', display: 'DM Serif Display', body: 'Inter', radius: '10px' },
  beauty: { bg: '#FCF7F8', ink: '#2A1E24', accent: '#A8476F', accent2: '#E9C2D2', soft: '#F6E6EC', display: 'DM Serif Display', body: 'Inter', radius: '28px' },
  trade:  { bg: '#F3F6F9', ink: '#0F1E2E', accent: '#1F5FA8', accent2: '#FFB020', soft: '#E1EAF4', display: 'Space Grotesk', body: 'Inter', radius: '12px' },
  health: { bg: '#F4FAF8', ink: '#123029', accent: '#17775A', accent2: '#7FD1B9', soft: '#DFF3EC', display: 'Fraunces', body: 'Inter', radius: '20px' },
  kids:   { bg: '#FFFBEF', ink: '#2A2140', accent: '#6C4BD8', accent2: '#FFB703', soft: '#F1ECFF', display: 'Fredoka', body: 'Inter', radius: '26px' },
  shop:   { bg: '#F7F7F5', ink: '#1C1C1C', accent: '#0C243C', accent2: '#FF862F', soft: '#ECEDEA', display: 'Space Grotesk', body: 'Inter', radius: '14px' },
};
function themeFor(cat) {
  if (cat === 'Takeaways' || cat === 'Food & catering') return ['food', THEMES.food];
  if (cat === 'Cafés & restaurants' || cat === 'Local producers') return ['cafe', THEMES.cafe];
  if (cat === 'Pubs & bars' || cat === 'Places to stay') return ['pub', THEMES.pub];
  if (cat === 'Hair & barbers' || cat === 'Health & beauty') return ['beauty', THEMES.beauty];
  if (cat === 'Trades & home services' || cat === 'Motoring' || cat === 'Services') return ['trade', THEMES.trade];
  if (cat === 'Doctors, dentists & vets' || cat === 'Sport & fitness') return ['health', THEMES.health];
  if (cat === 'Kids & family') return ['kids', THEMES.kids];
  return ['shop', THEMES.shop];
}

const where = (p) => p.area || 'Bordon';
function tagline(p) {
  const a = where(p), t = (p.tags || []).map((x) => String(x).toLowerCase()).join(' ');
  switch (p.category) {
    case 'Takeaways':
      if (/fish|chip/.test(t + p.name.toLowerCase())) return `Proper fish & chips, fried fresh in ${a}.`;
      if (/pizza/.test(t + p.name.toLowerCase())) return `Hot, fresh pizza for ${a} and around.`;
      if (/chinese|china|wok|wall/.test(t + p.name.toLowerCase())) return `Chinese takeaway favourites, cooked to order in ${a}.`;
      if (/indian|curry|spice|tandoori/.test(t + p.name.toLowerCase())) return `Curry house classics, made fresh in ${a}.`;
      if (/kebab|bbq/.test(t + p.name.toLowerCase())) return `Kebabs, grills and late-night favourites in ${a}.`;
      if (/burger/.test(t + p.name.toLowerCase())) return `Smash burgers and loaded fries in ${a}.`;
      return `Your local takeaway in ${a}.`;
    case 'Cafés & restaurants': return `Good food and a warm welcome in ${a}.`;
    case 'Pubs & bars': return `Your local in ${a}. Pull up a chair.`;
    case 'Places to stay': return `Somewhere comfortable to stay in ${a}.`;
    case 'Hair & barbers': return `Cuts, colour and a proper chat in ${a}.`;
    case 'Health & beauty': return `Time for you, in ${a}.`;
    case 'Trades & home services': return `Trusted local help for homes around ${a}.`;
    case 'Motoring': return `Keeping ${a} on the road.`;
    case 'Sport & fitness': return `Get moving in ${a}.`;
    case 'Kids & family': return `Fun for families around ${a}.`;
    case 'Doctors, dentists & vets': return `Caring for ${a}.`;
    case 'Local producers': return `Made locally, in and around ${a}.`;
    case 'Food & catering': return `Food for your event, from ${a}.`;
    default: return `Independent and local, in ${a}.`;
  }
}
function highlights(p, kind) {
  const L = {
    food: [['Order online', p.menu_url ? 'Tap order and it\'s on its way' : 'Ordering link goes here'], ['Collection & delivery', 'Hot food, ready when you are'], ['Local favourite', `Serving ${where(p)} and nearby`]],
    cafe: [['Fresh every day', 'Breakfasts, lunches and cake'], ['Eat in or take away', 'Pop in any time we\'re open'], ['Local', `Right here in ${where(p)}`]],
    pub: [['What\'s on', 'Quiz nights, live music and sport'], ['Food & drink', 'Menu and drinks list online'], ['Book a table', 'One tap to call or book']],
    beauty: [['Book online', 'See times and book in seconds'], ['Treatments & prices', 'Every service, clearly priced'], ['Gift vouchers', 'The easy present']],
    trade: [['Ask for a quote', 'One tap to call or message'], ['Local', `Covering ${where(p)} and nearby`], ['Recent work', 'Photos of jobs we\'ve done']],
    health: [['Book an appointment', 'One tap to call or book'], ['Services', 'What we offer, clearly explained'], ['Find us', `In ${where(p)}, with parking info`]],
    kids: [['Book a party', 'Dates, packages and prices'], ['What we do', 'Activities for every age'], ['Happy families', 'Photos and kind words']],
    shop: [['What we stock', 'Browse before you visit'], ['Opening hours', 'Always up to date'], ['Find us', `In ${where(p)}`]],
  };
  return L[kind] || L.shop;
}

function ctaFor(p, kind) {
  const tel = p.phone ? `tel:${p.phone.replace(/\s+/g, '')}` : '#contact';
  if (p.menu_url && kind === 'food') return ['Order online', p.menu_url];
  if (kind === 'beauty' || kind === 'health' || kind === 'kids') return ['Book now', tel];
  if (kind === 'trade') return ['Get a quote', tel];
  if (kind === 'pub') return ['Book a table', tel];
  return [p.phone ? 'Call us' : 'Find us', p.phone ? tel : '#contact'];
}

function hoursTable(h) {
  if (!h || typeof h !== 'object') return '';
  const rows = DAYS.map(([k, n]) => `<tr><th>${n}</th><td>${esc(h[k] && !/closed/i.test(h[k]) ? h[k].replace(/-/g, '–').replace(/,\s*/g, ', ') : 'Closed')}</td></tr>`).join('');
  return `<table class="hrs">${rows}</table>`;
}

function menuHtml(menu) {
  if (!Array.isArray(menu) || !menu.length) return '';
  return menu.slice(0, 8).map((s) => `<div class="msec"><h3>${esc(s.section)}</h3>${(s.items || []).slice(0, 14).map((i) => `<div class="mitem"><div><b>${esc(i.name)}</b>${i.desc ? `<small>${esc(i.desc)}</small>` : ''}</div>${i.price ? `<span>£${esc(String(i.price).replace(/^£/, ''))}</span>` : ''}</div>`).join('')}</div>`).join('');
}

export function mockupPage(p, { SITE, iconSvg }) {
  const [kind, T] = themeFor(p.category);
  const name = p.name;
  const addr = [p.address_clean || p.address, p.postcode].filter(Boolean).join(', ');
  const photo = Array.isArray(p.photos) && p.photos[0] ? p.photos[0] : null;
  const [ctaText, ctaHref] = ctaFor(p, kind);
  const hl = highlights(p, kind);
  const hyg = /^[45]$/.test(p.hygiene_rating || '') ? `<span class="pill">★ ${esc(p.hygiene_rating)}-star food hygiene</span>` : '';
  const about = p.description || `${name} is an independent ${(p.category || 'local business').toLowerCase().replace(/s$/, '').replace(/ & /g, ' and ')} in ${where(p)}. This is where a few friendly lines about who you are, what you do best and why locals keep coming back would go.`;
  const isFood = kind === 'food' || kind === 'cafe' || kind === 'pub';
  const menu = menuHtml(p.menu);
  const fontQ = [T.display, T.body].filter((v, i, a) => a.indexOf(v) === i).map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`).join('&');
  const map = p.lat ? `<iframe class="map" title="Map" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${(+p.lng - 0.008).toFixed(4)},${(+p.lat - 0.004).toFixed(4)},${(+p.lng + 0.008).toFixed(4)},${(+p.lat + 0.004).toFixed(4)}&amp;layer=mapnik&amp;marker=${(+p.lat).toFixed(5)},${(+p.lng).toFixed(5)}"></iframe>` : '';
  const initials = name.replace(/^the\s+/i, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const services = (p.tags || []).filter(Boolean).slice(0, 8);

  return `<!doctype html>
<html lang="en-GB"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} — website concept by Dunnworks</title>
<meta name="robots" content="noindex,nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${fontQ}&display=swap" rel="stylesheet">
<style>
:root{--bg:${T.bg};--ink:${T.ink};--a:${T.accent};--a2:${T.accent2};--soft:${T.soft};--r:${T.radius}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 '${T.body}',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}h1,h2,h3{font-family:'${T.display}',serif;line-height:1.08;margin:0;letter-spacing:-.01em}
.wrap{max-width:1120px;margin:0 auto;padding:0 22px}
.dw{position:sticky;top:0;z-index:50;background:#0C243C;color:#fff;font:13px/1.4 Inter,system-ui,sans-serif}
.dw .wrap{display:flex;gap:10px 18px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding-top:9px;padding-bottom:9px}
.dw b{color:#FF862F}.dw a{color:#fff}.dw .go{background:#55C2C3;color:#0C243C;font-weight:700;text-decoration:none;padding:7px 14px;border-radius:999px;white-space:nowrap}
.dw .back{color:#B9C6D2;white-space:nowrap}
header.top{position:sticky;top:42px;z-index:40;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid color-mix(in srgb,var(--ink) 8%,transparent)}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;height:68px}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-family:'${T.display}',serif;font-size:21px}
.mark{width:40px;height:40px;border-radius:calc(var(--r) / 2);background:var(--a);color:#fff;display:grid;place-items:center;font:700 15px Inter,sans-serif;letter-spacing:.02em}
nav.links{display:flex;gap:22px;font-weight:500;font-size:15px}nav.links a{text-decoration:none;opacity:.8}nav.links a:hover{opacity:1}
.btn{display:inline-flex;align-items:center;gap:8px;background:var(--a);color:#fff;text-decoration:none;font-weight:600;padding:13px 22px;border-radius:999px;border:0;transition:transform .2s,box-shadow .2s}
.btn:hover{transform:translateY(-2px);box-shadow:0 10px 24px -10px var(--a)}.btn.ghost{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--ink) 20%,transparent)}
.hero{position:relative;overflow:hidden;padding:84px 0 92px}
.hero .wrap{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}
.hero h1{font-size:clamp(42px,7vw,82px)}.hero p.lead{font-size:20px;opacity:.82;margin:20px 0 30px;max-width:30ch}
.hero .ctas{display:flex;gap:12px;flex-wrap:wrap}.pill{display:inline-block;background:var(--soft);color:var(--ink);font-weight:600;font-size:13px;padding:6px 12px;border-radius:999px;margin-bottom:18px}
.visual{position:relative;aspect-ratio:4/5;border-radius:calc(var(--r) * 1.4);overflow:hidden;background:linear-gradient(150deg,var(--a),color-mix(in srgb,var(--a) 55%,var(--a2)));box-shadow:0 40px 80px -40px color-mix(in srgb,var(--ink) 60%,transparent)}
.visual img{width:100%;height:100%;object-fit:cover}.visual .art{position:absolute;inset:0;display:grid;place-items:center;color:rgba(255,255,255,.9)}
.visual .art svg{width:46%;height:46%;stroke:currentColor;fill:none;stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}
.visual .stamp{position:absolute;left:18px;bottom:18px;background:#fff;color:var(--ink);border-radius:14px;padding:10px 14px;font-weight:600;font-size:14px;box-shadow:0 10px 30px -12px rgba(0,0,0,.4)}
.blob{position:absolute;width:520px;height:520px;border-radius:50%;background:var(--a2);opacity:.18;filter:blur(40px);right:-120px;top:-160px;pointer-events:none}
.hl{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:-46px;position:relative;z-index:2}
.hl div{background:#fff;border-radius:var(--r);padding:22px 22px;box-shadow:0 18px 40px -26px color-mix(in srgb,var(--ink) 50%,transparent)}
.hl b{display:block;font-family:'${T.display}',serif;font-size:19px;margin-bottom:4px}.hl span{opacity:.72;font-size:15px}
section.s{padding:84px 0}section.s.alt{background:var(--soft)}
.s h2{font-size:clamp(30px,4.4vw,46px);margin-bottom:18px}.eyebrow{font:700 12px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--a);margin:0 0 10px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
.about p{font-size:18px;opacity:.86;margin:0 0 14px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.chips span{background:#fff;border-radius:999px;padding:7px 14px;font-size:14px;font-weight:500}
.menu{columns:2 320px;column-gap:40px}.msec{break-inside:avoid;margin-bottom:28px}.msec h3{font-size:22px;padding-bottom:8px;border-bottom:2px solid var(--a);margin-bottom:8px}
.mitem{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px dashed color-mix(in srgb,var(--ink) 18%,transparent)}.mitem small{display:block;opacity:.65;font-size:13px}.mitem span{font-weight:700;white-space:nowrap}
.ph{border:2px dashed color-mix(in srgb,var(--ink) 20%,transparent);border-radius:var(--r);padding:34px;text-align:center;opacity:.8}
.hrs{width:100%;border-collapse:collapse;font-size:16px}.hrs th{text-align:left;font-weight:500;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--ink) 10%,transparent)}.hrs td{text-align:right;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--ink) 10%,transparent);font-variant-numeric:tabular-nums}
.contact{display:grid;gap:14px;font-size:17px}.contact a{font-weight:600}
.map{width:100%;height:320px;border:0;border-radius:var(--r);margin-top:22px;filter:saturate(.9)}
.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.gallery div{aspect-ratio:4/3;border-radius:var(--r);background:linear-gradient(135deg,var(--soft),color-mix(in srgb,var(--a2) 35%,var(--soft)));display:grid;place-items:center;font-size:13px;opacity:.75}
.gallery img{width:100%;height:100%;object-fit:cover;border-radius:var(--r)}
.band{background:var(--a);color:#fff;border-radius:calc(var(--r) * 1.4);padding:46px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}.band h2{font-size:clamp(26px,3.6vw,38px);margin:0}.band .btn{background:#fff;color:var(--a)}
footer.f{padding:46px 0 120px;font-size:14px;opacity:.75}footer.f .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.float{position:fixed;right:18px;bottom:18px;z-index:60;background:#0C243C;color:#fff;border-radius:18px;padding:16px 18px;max-width:300px;box-shadow:0 24px 50px -20px rgba(0,0,0,.55);font:14px/1.45 Inter,system-ui,sans-serif}
.float b{display:block;font-size:15px;margin-bottom:4px}.float a{display:inline-block;margin-top:10px;background:#FF862F;color:#fff;font-weight:700;text-decoration:none;padding:9px 16px;border-radius:999px}
.float button{position:absolute;top:6px;right:8px;background:none;border:0;color:#B9C6D2;font-size:20px;cursor:pointer}
@media (max-width:860px){.hero .wrap,.two{grid-template-columns:1fr}.hero{padding:48px 0 76px}.visual{aspect-ratio:16/11}nav.links{display:none}.hl{grid-template-columns:1fr}.gallery{grid-template-columns:repeat(2,1fr)}section.s{padding:60px 0}.band{padding:30px}.dw{position:relative}header.top{top:0}.gallery{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
</style>
</head><body>
<div class="dw"><div class="wrap"><span><b>Website concept by Dunnworks.</b> This is not ${esc(name)}'s official website. It's a free mock-up of what theirs could look like.</span><span style="display:flex;gap:14px;align-items:center"><a class="back" href="${SITE}/p/${esc(p.slug)}/">← Back to woolmer</a><a class="go" href="${DW}&utm_content=${encodeURIComponent(p.slug)}">Get this built</a></span></div></div>

<header class="top"><div class="wrap">
  <a class="brand" href="#top"><span class="mark">${esc(initials)}</span>${esc(name)}</a>
  <nav class="links"><a href="#about">About</a>${isFood ? '<a href="#menu">Menu</a>' : services.length ? '<a href="#services">Services</a>' : ''}<a href="#hours">Opening hours</a><a href="#contact">Find us</a></nav>
  <a class="btn" href="${esc(ctaHref)}">${esc(ctaText)}</a>
</div></header>

<section class="hero" id="top"><div class="blob"></div><div class="wrap">
  <div>${hyg}<h1>${esc(name)}</h1><p class="lead">${esc(tagline(p))}</p>
    <div class="ctas"><a class="btn" href="${esc(ctaHref)}">${esc(ctaText)}</a><a class="btn ghost" href="#contact">Find us</a></div></div>
  <div class="visual">${photo ? `<img src="${esc(photo.src)}" alt="${esc(photo.alt || name)}">` : `<div class="art">${iconSvg || ''}</div>`}<div class="stamp">${esc(where(p))}${p.postcode ? ' · ' + esc(p.postcode.split(' ')[0]) : ''}</div></div>
</div></section>

<div class="wrap"><div class="hl">${hl.map(([b, s]) => `<div><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('')}</div></div>

<section class="s" id="about"><div class="wrap two about">
  <div><p class="eyebrow">About us</p><h2>Local, independent, and proud of it</h2></div>
  <div><p>${esc(about)}</p>${services.length ? `<div class="chips">${services.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}</div>
</div></section>

${isFood ? `<section class="s alt" id="menu"><div class="wrap"><p class="eyebrow">Menu</p><h2>${menu ? 'What we cook' : 'Your menu goes here'}</h2>
  ${menu ? `<div class="menu">${menu}</div>` : `<div class="ph">Your full menu, with prices and allergens, laid out beautifully and easy to update yourself.${p.menu_url ? `<br><br><a class="btn" href="${esc(p.menu_url)}" rel="nofollow noopener">See today's menu</a>` : ''}</div>`}
</div></section>` : `<section class="s alt" id="services"><div class="wrap"><p class="eyebrow">What we do</p><h2>Services${kind === 'beauty' ? ' & prices' : ''}</h2>
  <div class="ph">Every service you offer${kind === 'beauty' ? ', with prices and online booking' : kind === 'trade' ? ', with photos of recent jobs and a quick quote form' : ''}, set out clearly.</div>
</div></section>`}

<section class="s" id="gallery"><div class="wrap"><p class="eyebrow">Gallery</p><h2>A look inside</h2>
  <div class="gallery">${(Array.isArray(p.photos) && p.photos.length > 1 ? p.photos.slice(1, 7).map((ph) => `<img src="${esc(ph.src)}" alt="${esc(ph.alt || name)}" loading="lazy">`) : ['Your photos', 'Your team', 'Your space'].map((t) => `<div>${t}</div>`)).join('')}</div>
</div></section>

<section class="s alt" id="hours"><div class="wrap two">
  <div><p class="eyebrow">Opening hours</p><h2>When to find us</h2></div>
  <div>${hoursTable(p.hours) || '<div class="ph">Your opening hours, always up to date and shown on Google too.</div>'}</div>
</div></section>

<section class="s" id="contact"><div class="wrap two">
  <div><p class="eyebrow">Find us</p><h2>Come and say hello</h2>
    <div class="contact">${addr ? `<div>${esc(addr)}</div>` : ''}${p.phone ? `<div><a href="tel:${esc(p.phone.replace(/\s+/g, ''))}">${esc(p.phone)}</a></div>` : ''}${p.email ? `<div><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></div>` : ''}</div></div>
  <div>${map || '<div class="ph">Map and directions</div>'}</div>
</div></section>

<div class="wrap"><div class="band"><h2>${isFood ? 'Hungry? We\'re ready when you are.' : 'Get in touch today.'}</h2><a class="btn" href="${esc(ctaHref)}">${esc(ctaText)}</a></div></div>

<footer class="f"><div class="wrap"><span>© ${new Date().getFullYear()} ${esc(name)}</span><span>Concept website by <a href="${DW}">Dunnworks</a> · Not the official site of ${esc(name)}</span></div></footer>

<div class="float" id="fl"><button type="button" aria-label="Close" onclick="this.parentNode.remove()">×</button><b>Like it? It could be yours.</b>Is this your business? Dunnworks will build you a real site like this from £750, with no monthly fees. Free changes until you love it.<br><a href="${DW}&utm_content=${encodeURIComponent(p.slug)}">Talk to Dunnworks</a></div>
</body></html>`;
}
