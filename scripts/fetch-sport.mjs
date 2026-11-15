// Local football results from FA Full-Time (fulltime.thefa.com only).
// Stage 1: saves the raw Full-Time pages so the parser can be written against the real markup.
import fs from 'node:fs';
const BASE = 'https://fulltime.thefa.com';
const pages = {
  wbfc_results: '/results.html?divisionseason=606670393&itemsPerPage=100',
  wbfc_fixtures: '/fixtures.html?divisionseason=606670393&itemsPerPage=100',
  wbfc_table: '/table.html?divisionseason=606670393',
  search_whitehill: '/home/search.html?searchText=Whitehill',
  search_bordon: '/home/search.html?searchText=Bordon',
  search_lindford: '/home/search.html?searchText=Lindford',
  search_headley: '/home/search.html?searchText=Headley',
  search_liphook: '/home/search.html?searchText=Liphook',
  search_passfield: '/home/search.html?searchText=Passfield',
};
fs.mkdirSync('data/sport-raw', { recursive: true });
for (const [k, p] of Object.entries(pages)) {
  try {
    const r = await fetch(BASE + p, { headers: { 'user-agent': 'woolmer.info local guide (hello@woolmer.info)' } });
    const t = await r.text();
    fs.writeFileSync(`data/sport-raw/${k}.html`, t);
    console.log(k, r.status, t.length);
  } catch (e) { console.log(k, 'error', String(e)); }
  await new Promise(r => setTimeout(r, 1500));
}
