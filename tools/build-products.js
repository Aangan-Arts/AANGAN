/* AANGAN — builds the catalogue and everything search engines and AI assistants read.
   Run from the website folder after adding or editing products:   node tools/build-products.js

   It reads every Products/<name>.json (paired with the image of the same name; a web copy in
   Products/web/<name>.jpg is used when present) and writes:
     js/products.js        the product list the site uses
     p/<slug>/index.html   one real page per product, readable without JavaScript, with its own
                           title, description, share preview and Product structured data
     index.html            pre-filled product grid, page title/description, structured data, FAQ
     sitemap.xml           every page, for Google Search Console and Bing Webmaster Tools
     llms.txt              a plain summary of the shop for AI assistants
     feed.xml              product feed for Google Merchant Center (free Shopping listings)

   Fields read from each .json file:
     product_title (required), product_description (required), product_care_suggestion (list, optional),
     price (offer price, number), mrp (actual price before the offer), available (false = unavailable),
     details ({"Size": "..."}), dispatch ("Dispatches in 3–5 working days."), slug (optional custom web address)
*/
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dir = path.join(root, 'Products'), webDir = path.join(dir, 'web');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), s); };

/* settings from js/config.js */
const cfgText = read('js/config.js');
const cfg = k => { const m = cfgText.match(new RegExp(k + "\\s*:\\s*'([^']*)'")); return m ? m[1] : ''; };
const SITE = (cfg('siteUrl') || 'https://aangan.co.in/').replace(/\/?$/, '/');
const INSTA = cfg('instagramUrl').split('?')[0];
const WA = cfg('whatsappNumber').replace(/\D/g, '');
const salePct = Number((cfgText.match(/salePercent\s*:\s*(\d+)/) || [])[1]) || 0;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = s => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().split(/[\s_-]+/).filter(Boolean).slice(0, 9).join('-');
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); if (s.length <= n) return s; const c = s.slice(0, n - 1); return c.slice(0, c.lastIndexOf(' ')).replace(/[,.;:]$/, '') + '…'; };
const today = new Date().toISOString().slice(0, 10);

/* ---------- read products ---------- */
const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
const stemOf = f => f.split('.')[0], isImg = f => /\.(jpe?g|png|webp)$/i.test(f);
const jsons = files.filter(f => /\.json$/i.test(f)).sort();
const products = [], problems = [], used = new Set();
for (const j of jsons) {
  const stem = stemOf(j); let d;
  try { d = JSON.parse(fs.readFileSync(path.join(dir, j), 'utf8')); } catch (e) { problems.push(`${j}: not valid JSON (${e.message}), skipped`); continue; }
  if (!d.product_title) { problems.push(`${j}: no product_title, skipped`); continue; }
  const web = fs.existsSync(webDir) && fs.readdirSync(webDir).find(f => stemOf(f) === stem && isImg(f));
  const orig = files.find(f => stemOf(f) === stem && isImg(f));
  if (!web && !orig) { problems.push(`${j}: no image named ${stem}.*, skipped`); continue; }
  const image = web ? `Products/web/${web}` : `Products/${orig}`;
  const size = fs.statSync(path.join(root, image)).size;
  if (size > 1.5e6) problems.push(`${image}: ${(size / 1e6).toFixed(1)} MB, slow to load. Add a smaller copy as Products/web/${stem}.jpg`);
  let slug = d.slug ? slugify(d.slug) : slugify(d.product_title), s0 = slug, k = 2;
  while (used.has(slug)) slug = `${s0}-${k++}`; used.add(slug);
  const num = v => (v === undefined || v === null || v === '' || isNaN(Number(v))) ? null : Number(v);
  products.push({
    id: stem, slug, url: `p/${slug}/`, name: d.product_title, price: num(d.price), mrp: num(d.mrp), category: d.category || '',
    image, alt: d.product_title, available: d.available !== false, desc: d.product_description || '',
    details: d.details || {}, care: d.product_care_suggestion || [], dispatch: d.dispatch || '',
    updated: fs.statSync(path.join(dir, j)).mtime.toISOString().slice(0, 10)
  });
}
const withJson = new Set(jsons.map(stemOf));
const noJson = files.filter(f => isImg(f) && !withJson.has(stemOf(f)));
if (noJson.length) problems.push(`Images with no .json (not listed on the site): ${noJson.join(', ')}`);

/* ---------- js/products.js ---------- */
const forJs = products.map(({ updated, ...p }) => p);
write('js/products.js', `/* AANGAN catalogue — GENERATED from the Products folder by tools/build-products.js.
   Do not edit by hand: edit the .json files in Products/ and run  node tools/build-products.js  again. */
window.AANGAN_COLLECTIONS = {};
window.AANGAN_PRODUCTS = ${JSON.stringify(forJs, null, 1)};
`);

/* ---------- shared pieces (same markup and price rules as js/main.js) ---------- */
const inr = n => n == null ? 'Price on request' : String(Math.round(n));
const inrWas = n => Number(n).toLocaleString('en-IN');
const off = p => { if (!(p.price != null && p.mrp && p.mrp > p.price)) return 0; const r = Math.round((p.mrp - p.price) / p.mrp * 100); return salePct ? Math.min(r, salePct) : r; };
const offer = p => off(p) ? ` <s class="was">${inrWas(p.mrp)}</s> <span class="off">${off(p)}% off</span>` : '';
const card = p => `<article class="pc"><a href="${p.url}" class="pimg" aria-label="View ${esc(p.name)}"><div class="ph"><img src="${p.image}" alt="${esc(p.alt)}" loading="lazy" width="1086" height="1448"></div></a>
<div class="body"><h3><a href="${p.url}">${esc(p.name)}</a></h3><div class="pr">${inr(p.price)}${offer(p)}</div><div class="live-sm" data-live="${p.id}" hidden></div>
<div class="d-flex gap-2 flex-wrap mt-3"><a class="btn-b sm" href="${p.url}">View details</a>${p.available === false ? '<span class="small align-self-center">Currently unavailable</span>' : `<button class="btn-a sm" data-add="${p.id}">Add to bag</button>`}</div></div></article>`;
const gridHtml = list => `<div class="row g-4">${list.map(p => `<div class="col-6 col-lg-4">${card(p)}</div>`).join('')}</div>`;
const abs = u => SITE + u.replace(/^\//, '');
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const org = { '@type': 'Organization', '@id': SITE + '#org', name: 'AANGAN', url: SITE, logo: abs('images/brand/favicon-192.png'), slogan: 'Where Tradition Glows', ...(INSTA ? { sameAs: [INSTA] } : {}), ...(WA ? { contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', telephone: '+' + WA, availableLanguage: ['en', 'hi'] } } : {}) };
const offerLd = p => p.price == null ? undefined : {
  '@type': 'Offer', url: abs(p.url), priceCurrency: 'INR', price: p.price, itemCondition: 'https://schema.org/NewCondition',
  availability: p.available === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', seller: { '@id': SITE + '#org' },
  ...(off(p) ? { priceSpecification: { '@type': 'UnitPriceSpecification', priceType: 'https://schema.org/StrikethroughPrice', price: p.mrp, priceCurrency: 'INR' } } : {})
};
const headTags = ({ title, desc, url, image, type }) => `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#622B30">
<meta property="og:site_name" content="AANGAN"><meta property="og:type" content="${type}"><meta property="og:locale" content="en_IN">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${image}"><meta property="og:image:width" content="1000"><meta property="og:image:height" content="1333">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${image}">`;

/* ---------- FAQ (shown on the page and given to search engines) ---------- */
const faq = [
  ['How do I order from AANGAN?', 'Add pieces to your bag, or tap Buy now, and fill in your delivery details. WhatsApp opens with your order ready to send. We confirm availability, shipping and your total, then share a payment link.'],
  ['When do I pay?', 'Only after we confirm your order on WhatsApp. Nothing is charged when you place an order on the website.'],
  ['Are AANGAN pieces handmade?', 'Yes. Every piece is handcrafted, with details such as pearls, mirror work, golden embellishments, stonework and embroidery.'],
  ['Do you deliver to my city?', 'We confirm delivery to your pincode, and the shipping cost, on WhatsApp before you pay.'],
  ['Can I order a custom design?', 'Yes. Tap “Request a custom creation” at the bottom of the page and tell us what you have in mind, the occasion and your budget. WhatsApp opens with your request, and we reply with ideas and a price.'],
  ['Are these good as Diwali gifts?', 'Yes. Diyas, tealight holders, torans and Shubh Labh hangings are traditional Diwali gifts, and you can add a gift note in the note field when you order.']
];
if (salePct) faq.splice(2, 0, ['Is there a Diwali offer?', `Yes. Every piece on offer is flat ${salePct}% off, and the offer price is shown on each one.`]);
const faqHtml = faq.map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n');

/* ---------- index.html ---------- */
const between = (s, tag, inner) => { const re = new RegExp(`<!--${tag}-->[\\s\\S]*?<!--/${tag}-->`); if (!re.test(s)) throw new Error(`index.html is missing <!--${tag}--> markers`); return s.replace(re, () => `<!--${tag}-->${inner}<!--/${tag}-->`); };
const hero = products.find(p => p.id === '20261020_1003') || products[0];
const homeTitle = 'Handmade Diwali Décor & Festive Gifts | AANGAN';
const homeDesc = clip(`Shop handcrafted Diwali décor from AANGAN: pearl and mirror-work diyas, tealight holders, torans and Shubh Labh hangings${salePct ? `, now flat ${salePct}% off` : ''}. Order easily on WhatsApp.`, 160);
let idx = read('index.html');
idx = between(idx, 'SEO:HEAD', '\n' + headTags({ title: homeTitle, desc: homeDesc, url: SITE, image: hero ? abs(hero.image) : abs('images/brand/favicon-192.png'), type: 'website' }) + '\n' + ld({
  '@context': 'https://schema.org', '@graph': [
    { ...org, '@type': ['Organization', 'Store'], description: 'Handcrafted Diwali and festive home décor: diyas, tealight holders, torans, Shubh Labh hangings, latkans and door hangings.', currenciesAccepted: 'INR', image: hero ? abs(hero.image) : undefined },
    { '@type': 'WebSite', '@id': SITE + '#site', url: SITE, name: 'AANGAN', publisher: { '@id': SITE + '#org' }, inLanguage: 'en-IN' },
    { '@type': 'ItemList', name: 'Handmade Diwali décor by AANGAN', itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(p.url), name: p.name })) },
    { '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }
  ]
}) + '\n');
idx = between(idx, 'SEO:GRID', gridHtml(products));
idx = between(idx, 'SEO:FAQ', '\n' + faqHtml + '\n');
write('index.html', idx);

/* ---------- one page per product ---------- */
fs.rmSync(path.join(root, 'p'), { recursive: true, force: true });
const tpl = read('product.html');
for (const p of products) {
  const title = `${p.name} | AANGAN`;
  const desc = clip(`${p.price != null ? `Price ${inr(p.price)}${off(p) ? ` (${off(p)}% off ${inrWas(p.mrp)})` : ''}. ` : ''}${p.desc}`, 160);
  const rel = products.filter(x => x.id !== p.id).slice(0, 3);
  const care = Array.isArray(p.care) ? p.care : (p.care ? [p.care] : []);
  const body = `<nav class="crumb" aria-label="Breadcrumb"><a href="index.html">Shop</a> / ${esc(p.name)}</nav>
<div class="pdp-grid"><div class="pdp-img"><img src="${p.image}" alt="${esc(p.alt)}" width="1086" height="1448" fetchpriority="high"></div>
<div class="pdp"><h1>${esc(p.name)}</h1><p class="price">${inr(p.price)}${offer(p)}</p>${off(p) ? `<p class="save">You save ${inr(p.mrp - p.price)}</p>` : ''}<div class="live" data-live="${p.id}" hidden></div>
<p class="mt-4">${esc(p.desc)}</p>
<div class="ctas">${p.available === false ? '<span class="note">Currently unavailable</span>' : `<button class="btn-b" data-add="${p.id}">Add to bag</button><button class="btn-a" data-buy="${p.id}">Buy now</button>`}</div>
<div class="acc mt-4">${Object.keys(p.details).length ? `<details open><summary>Details</summary><dl>${Object.entries(p.details).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>` : ''}
${care.length ? `<details><summary>Care</summary><ul>${care.map(c => `<li>${esc(c)}</li>`).join('')}</ul></details>` : ''}${p.dispatch ? `<details><summary>Dispatch</summary><p>${esc(p.dispatch)}</p></details>` : ''}</div></div></div>
<div class="mt-5 pt-5"><h2 class="mb-5">You may also love</h2>${gridHtml(rel)}</div>`;
  const productLd = ld({
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'Product', '@id': abs(p.url) + '#product', name: p.name, description: p.desc, image: [abs(p.image)], sku: p.id, url: abs(p.url),
        brand: { '@type': 'Brand', name: 'AANGAN' }, material: undefined, offers: offerLd(p) },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Shop', item: SITE }, { '@type': 'ListItem', position: 2, name: p.name, item: abs(p.url) }] },
      org
    ]
  });
  let html = tpl
    .replace('<head>', '<head><base href="../../">')
    .replace(/<title>[\s\S]*?<meta name="robots" content="noindex,follow">/, () => headTags({ title, desc, url: abs(p.url), image: abs(p.image), type: 'product' }) + (p.price != null ? `\n<meta property="product:price:amount" content="${p.price}"><meta property="product:price:currency" content="INR">` : '') + '\n' + productLd)
    .replace('<div class="container" id="pdp"></div>', () => `<div class="container" id="pdp">${body}</div>`)
    .replace('<script src="js/config.js"></script>', () => `<script>window.AANGAN_PID=${JSON.stringify(p.id)}</script><script src="js/config.js"></script>`);
  if (!html.includes('AANGAN_PID') || !html.includes('rel="canonical"')) throw new Error('product.html template changed; update tools/build-products.js');
  write(`${p.url}index.html`, html);
}

/* ---------- sitemap.xml ---------- */
const newest = products.reduce((a, p) => p.updated > a ? p.updated : a, '2000-01-01');
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<url><loc>${SITE}</loc><lastmod>${newest}</lastmod></url>
${products.map(p => `<url><loc>${abs(p.url)}</loc><lastmod>${p.updated}</lastmod><image:image><image:loc>${abs(p.image)}</image:loc></image:image></url>`).join('\n')}
</urlset>
`);

/* ---------- llms.txt (summary for AI assistants) ---------- */
const kinds = [['Diyas and diya holders', /diya/i], ['Tealight holders and runners', /tealight/i], ['Torans', /toran/i], ['Shubh Labh hangings, latkans and door hangings', /shubh|latkan|hanging/i]];
write('llms.txt', `# AANGAN

> AANGAN is an Indian brand of handcrafted Diwali and festive home décor: diyas and diya holders, tealight holders, torans, Shubh Labh hangings, latkans and door hangings, made by hand with pearls, mirror work, golden embellishments, stonework and embroidery. Tagline: Where Tradition Glows.

- Website: ${SITE}
${INSTA ? `- Instagram: ${INSTA}\n` : ''}${WA ? `- WhatsApp: https://wa.me/${WA}\n` : ''}- How to order: add pieces to the bag on the website (or tap Buy now) and enter delivery details; WhatsApp opens with the order. AANGAN confirms availability, shipping and the total, then shares a payment link. Nothing is charged before confirmation.
- Custom creations: requested through the website's "Request a custom creation" form, which opens WhatsApp with the brief.
- Prices are in Indian rupees (INR).${salePct ? ` Current offer: flat ${salePct}% off for Diwali.` : ''}

${kinds.map(([k, re]) => { const l = products.filter(p => re.test(p.name)); return l.length ? `## ${k}\n\n${l.map(p => `- [${p.name}](${abs(p.url)}): ${p.price == null ? 'price on request' : `INR ${p.price}${off(p) ? ` (was ${p.mrp}, ${off(p)}% off)` : ''}`}. ${clip(p.desc, 180)}`).join('\n')}\n` : ''; }).join('\n')}`);

/* ---------- feed.xml (Google Merchant Center) ---------- */
const x = s => esc(s);
write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>
<title>AANGAN</title><link>${SITE}</link><description>Handmade Diwali and festive décor</description>
${products.filter(p => p.price != null).map(p => `<item><g:id>${p.id}</g:id><g:title>${x(clip(p.name, 150))}</g:title><g:description>${x(clip(p.desc, 4900))}</g:description>
<g:link>${abs(p.url)}</g:link><g:image_link>${abs(p.image)}</g:image_link><g:availability>${p.available === false ? 'out_of_stock' : 'in_stock'}</g:availability>
<g:price>${(off(p) ? p.mrp : p.price).toFixed(2)} INR</g:price>${off(p) ? `<g:sale_price>${p.price.toFixed(2)} INR</g:sale_price>` : ''}<g:brand>AANGAN</g:brand><g:condition>new</g:condition><g:identifier_exists>no</g:identifier_exists><g:google_product_category>696</g:google_product_category></item>`).join('\n')}
</channel></rss>
`);

console.log(`Built ${products.length} products: js/products.js, ${products.length} product pages in p/, index.html, sitemap.xml, llms.txt, feed.xml.`);
problems.forEach(p => console.log('  • ' + p));
