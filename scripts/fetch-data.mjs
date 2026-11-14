// One-off data pull for audits: FSA (GU35), OpenStreetMap (Bordon area), Wikimedia Commons photos near Bordon.
import fs from 'node:fs';
const out = {};
const j = async (url, opt = {}) => { const r = await fetch(url, opt); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); };
try {
  const rows = [];
  for (let page = 1; page < 20; page++) {
    const d = await j(`https://api.ratings.food.gov.uk/Establishments?address=GU35&pageSize=500&pageNumber=${page}`, { headers: { 'x-api-version': '2', accept: 'application/json' } });
    rows.push(...d.establishments.map(e => ({ id: e.FHRSID, n: e.BusinessName, t: e.BusinessType, a: [e.AddressLine1, e.AddressLine2, e.AddressLine3].filter(Boolean).join(', '), pc: e.PostCode, r: e.RatingValue, la: e.geocode && e.geocode.latitude, lo: e.geocode && e.geocode.longitude })));
    if (d.establishments.length < 500) break;
  }
  out.fsa = rows;
} catch (e) { out.fsa_error = String(e); }
try {
  const q = `[out:json][timeout:60];(nwr["shop"](51.075,-0.92,51.145,-0.79);nwr["amenity"~"restaurant|cafe|fast_food|pub|bar|pharmacy|doctors|dentist|post_office|bank|library|community_centre|recycling|fuel|veterinary|childcare|place_of_worship"](51.075,-0.92,51.145,-0.79);nwr["leisure"~"sports_centre|fitness_centre|park|playground"](51.075,-0.92,51.145,-0.79);nwr["craft"](51.075,-0.92,51.145,-0.79);nwr["office"](51.075,-0.92,51.145,-0.79););out center tags;`;
  let d = null;
  for (const ep of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
    try { d = await j(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', 'user-agent': 'woolmer.info data audit (hello@woolmer.info)' } }); break; } catch (e) { out.osm_tries = (out.osm_tries || []).concat(String(e)); }
  }
  if (!d) throw new Error('all overpass endpoints failed');
  out.osm = d.elements.filter(e => e.tags && e.tags.name).map(e => ({ id: e.type + '/' + e.id, n: e.tags.name, k: e.tags.shop ? 'shop=' + e.tags.shop : e.tags.amenity ? 'amenity=' + e.tags.amenity : e.tags.leisure ? 'leisure=' + e.tags.leisure : e.tags.craft ? 'craft=' + e.tags.craft : 'office=' + e.tags.office, la: e.lat || (e.center && e.center.lat), lo: e.lon || (e.center && e.center.lon), pc: e.tags['addr:postcode'], st: e.tags['addr:street'], hn: e.tags['addr:housenumber'], ph: e.tags.phone || e.tags['contact:phone'], web: e.tags.website || e.tags['contact:website'], oh: e.tags.opening_hours }));
} catch (e) { out.osm_error = String(e); }
try {
  const photos = [];
  for (const [la, lo] of [[51.111, -0.863], [51.103, -0.868], [51.113, -0.865], [51.12, -0.85], [51.1, -0.88], [51.125, -0.835]]) {
    const d = await j(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=geosearch&ggscoord=${la}|${lo}&ggsradius=1500&ggslimit=100&ggsnamespace=6&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=800&iiextmetadatafilter=LicenseShortName|Artist|ImageDescription`, { headers: { 'user-agent': 'woolmer.info data audit (hello@woolmer.info)' } });
    for (const p of Object.values((d.query || {}).pages || {})) {
      const i = p.imageinfo && p.imageinfo[0]; if (!i) continue;
      const m = i.extmetadata || {};
      photos.push({ t: p.title, la: p.coordinates && p.coordinates[0].lat, w: i.width, h: i.height, th: i.thumburl, url: i.descriptionurl, lic: (m.LicenseShortName || {}).value, by: String((m.Artist || {}).value || '').replace(/<[^>]+>/g, '').trim(), desc: String((m.ImageDescription || {}).value || '').replace(/<[^>]+>/g, '').trim().slice(0, 200) });
    }
  }
  const seen = new Set(); out.photos = photos.filter(p => !seen.has(p.t) && seen.add(p.t));
} catch (e) { out.photos_error = String(e); }
fs.writeFileSync('audit.json', JSON.stringify(out));
console.log('fsa', (out.fsa || []).length, out.fsa_error || '', 'osm', (out.osm || []).length, out.osm_error || '', 'photos', (out.photos || []).length, out.photos_error || '');
