/* AANGAN — builds js/products.js from the Products folder.
   Run from the website folder after adding or editing products:   node tools/build-products.js

   How it works: every Products/<name>.json becomes one product, paired with the image that has the same name
   (for example 20261020_1000.json + 20261020_1000.jpeg). If a smaller web copy exists in Products/web/<name>.jpg,
   that copy is used on the site instead of the original photo.

   Fields read from each .json file:
     product_title            (required)  product name
     product_description      (required)  shown on the product page
     product_care_suggestion  (optional)  list of care points, shown under "Care"
     price                    (optional)  offer price as a number, e.g. 1499. Leave out for "Price on request"
     mrp                      (optional)  actual price before the offer, e.g. 1999. Shows the sale block and "You save"
     available                (optional)  false = "Currently unavailable"
     details                  (optional)  e.g. {"Size": "Approx. 20 cm", "Pieces": "Set of 2"}
     dispatch                 (optional)  e.g. "Dispatches in 3–5 working days."
*/
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dir = path.join(root, 'Products'), webDir = path.join(dir, 'web');
const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
const stemOf = f => f.split('.')[0];
const isImg = f => /\.(jpe?g|png|webp)$/i.test(f);
const jsons = files.filter(f => /\.json$/i.test(f)).sort();
const products = [], problems = [];

for (const j of jsons) {
  const stem = stemOf(j);
  let d;
  try { d = JSON.parse(fs.readFileSync(path.join(dir, j), 'utf8')); }
  catch (e) { problems.push(`${j}: not valid JSON (${e.message}), skipped`); continue; }
  if (!d.product_title) { problems.push(`${j}: no product_title, skipped`); continue; }
  const web = fs.existsSync(webDir) && fs.readdirSync(webDir).find(f => stemOf(f) === stem && isImg(f));
  const orig = files.find(f => stemOf(f) === stem && isImg(f));
  if (!web && !orig) { problems.push(`${j}: no image named ${stem}.*, skipped`); continue; }
  const image = web ? `Products/web/${web}` : `Products/${orig}`;
  const size = fs.statSync(path.join(root, image)).size;
  if (size > 1.5e6) problems.push(`${image}: ${(size / 1e6).toFixed(1)} MB, slow to load. Add a smaller copy as Products/web/${stem}.jpg`);
  const num = v => (v === undefined || v === null || v === '' || isNaN(Number(v))) ? null : Number(v);
  products.push({
    id: stem,
    name: d.product_title,
    price: num(d.price),
    mrp: num(d.mrp),
    category: d.category || '',
    image,
    alt: d.product_title,
    available: d.available !== false,
    desc: d.product_description || '',
    details: d.details || {},
    care: d.product_care_suggestion || [],
    dispatch: d.dispatch || ''
  });
}
const withJson = new Set(jsons.map(stemOf));
const noJson = files.filter(f => isImg(f) && !withJson.has(stemOf(f)));
if (noJson.length) problems.push(`Images with no .json (not listed on the site): ${noJson.join(', ')}`);

const out = `/* AANGAN catalogue — GENERATED from the Products folder by tools/build-products.js.
   Do not edit by hand: edit the .json files in Products/ and run  node tools/build-products.js  again. */
window.AANGAN_COLLECTIONS = {};
window.AANGAN_PRODUCTS = ${JSON.stringify(products, null, 1)};
`;
fs.writeFileSync(path.join(root, 'js', 'products.js'), out);
console.log(`Built js/products.js with ${products.length} products.`);
problems.forEach(p => console.log('  • ' + p));
