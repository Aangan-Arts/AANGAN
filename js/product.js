/* Product detail page */
(function(){
const A=window.AANGAN,P=window.AANGAN_PRODUCTS,C=window.AANGAN_COLLECTIONS,el=document.getElementById('pdp');
const id=window.AANGAN_PID||new URLSearchParams(location.search).get('id'),p=P.find(x=>x.id==id);
/* old product.html?id= links move to the product's own address (keeps one address per product for Google) */
if(!window.AANGAN_PID&&p&&p.url&&/^https?:/.test(location.protocol)){location.replace(new URL(p.url,document.baseURI).href);return}
function draw(){
 if(!p){el.innerHTML='<div class="empty"><h3>We could not find that piece</h3><p>It may have been moved or is no longer listed.</p><a class="btn-a" href="index.html">Back to shop</a></div>';return}
 document.title=p.name+' | AANGAN';
 const rel=P.filter(x=>x.id!=p.id&&x.category==p.category).concat(P.filter(x=>x.id!=p.id&&x.category!=p.category)).slice(0,3);
 el.innerHTML=`<nav class="crumb" aria-label="Breadcrumb"><a href="index.html">Shop</a> / ${p.name}</nav>
 <div class="pdp-grid"><div class="pdp-img"><img src="${p.image}" alt="${p.alt}" width="1086" height="1448" fetchpriority="high"></div>
 <div class="pdp"><h1>${p.name}</h1><p class="price">${A.inr(p.price)}${A.offer(p)}</p>${A.off(p)?`<p class="save">You save ${A.inr(p.mrp-p.price)}</p>`:''}<div class="live" data-live="${p.id}" hidden></div>
 <p class="mt-4">${p.desc}</p>
 <div class="ctas">${p.available===false?'<span class="note">Currently unavailable</span>':`<button class="btn-b" data-add="${p.id}">Add to bag</button><button class="btn-a" data-buy="${p.id}">Buy now</button>`}</div>
 <div class="acc mt-4">${Object.keys(p.details||{}).length?`<details open><summary>Details</summary><dl>${Object.entries(p.details).map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></details>`:''}
 ${p.care&&p.care.length?`<details><summary>Care</summary>${Array.isArray(p.care)?`<ul>${p.care.map(c=>`<li>${c}</li>`).join('')}</ul>`:`<p>${p.care}</p>`}</details>`:''}${p.dispatch?`<details><summary>Dispatch</summary><p>${p.dispatch}</p></details>`:''}</div>
 ${p.dummy?'<p class="small mt-3 sample">Sample listing details for preview. Replace in js/products.js.</p>':''}</div></div>
 <div class="mt-5 pt-5"><h2 class="mb-5">You may also love</h2><div class="row g-4">${rel.map(x=>`<div class="col-6 col-lg-4">${A.card(x)}</div>`).join('')}</div></div>`}
draw();document.dispatchEvent(new Event('aangan:render'));
})();
