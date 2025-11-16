(function(){
  /* ================================
     EDIT HERE — BASIC CONFIG
     ================================ */

  // Path to your Cadeaux page (same-origin). Update to the REAL path.
  // Examples:
  // const PRODUCT_SOURCE_URL = '/cadeaux-fin-danne/index.html';
  // const PRODUCT_SOURCE_URL = '/';
  const PRODUCT_SOURCE_URL = '../cadeauxfindanne/cadeauxfindanne.html';

  // Routes
  const ROUTES = {
    customization: '../orderconfirmation/orderconfirmation.html',
    offers: '../cadeauxfindanne/cadeauxfindanne.html'
  };

  // Pack identity + content
  const PACK = {
    id: 'pack-standard-2026',
    name: 'Pack Standard',
    price: 79000, // DZD (number)
    suitableFor:
      'Idéal pour PME, agences, écoles & équipes commerciales — branding rapide, facture pro, livraison maîtrisée.',
    content: [
      { id:'cal1', qty:40 }, // Calendrier Mural
      { id:'cal6', qty:40 }, // Calendrier Mural
      { id:'cal10', qty:25 }, // Sous Main mini
      { id:'bn1',  qty:40 }, // Bloc Notes
      { id:'st1',  qty:60 }  // Stylo Standard
    ]
  };

  /* ================================
     RUNTIME — DO NOT EDIT BELOW
     ================================ */

  // Build absolute URL relative to the Cadeaux page
  const srcBase = new URL(PRODUCT_SOURCE_URL, location.origin);
  const absFromSource = (url) => {
    try { return new URL(url, srcBase).toString(); } catch { return url; }
  };

  // Product dictionary: id -> { id, name, image, gallery[], link, desc }
  const productIndex = new Map();

  // DOM refs
  const dom = {
    title: document.getElementById('packTitle'),
    statProducts: document.getElementById('statProducts'),
    statQty: document.getElementById('statQty'),
    statPrice: document.getElementById('statPrice'),
    suitableText: document.getElementById('suitableText'),
    contentCards: document.getElementById('contentCards'),
    orderTop: document.getElementById('orderTop'),
    orderSticky: document.getElementById('orderSticky'),
    stickyCta: document.getElementById('stickyCta'),
    stickyPackName: document.getElementById('stickyPackName'),
    stickyPackPrice: document.getElementById('stickyPackPrice')
  };

  // Modal refs
  const modal = document.getElementById('galleryModal');
  const mImg  = document.getElementById('mImg');
  const mDesc = document.getElementById('mDesc');
  const mPrev = document.getElementById('mPrev');
  const mNext = document.getElementById('mNext');
  const mClose= document.getElementById('modalClose');
  const mBack = document.getElementById('modalBackdrop');

  // Utils
  function fmt(n){ return `${Number(n||0).toLocaleString('fr-DZ')} DZD`; }
  function fmtRaw(n){ return Number(n||0); }
  function escapeHtml(s){
    return String(s||'').replace(/[&<>"]/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];
    });
  }

  function totals(){
    const totalProducts = PACK.content.length;
    const totalQty = PACK.content.reduce((s, i)=> s + Number(i.qty||0), 0);
    return { totalProducts, totalQty };
  }

  // ------------- CATALOG RESOLVER (robust) -------------
  async function buildCatalog(){
    // a) Try a global dataset from cadeaux JS (if it exposes one)
    const fromGlobal = readGlobalCatalog();
    if (fromGlobal.size){
      console.debug('[Pack] Using global catalog dataset');
      for (const [k,v] of fromGlobal) productIndex.set(k,v);
      return;
    }

    // b) Try fetching and parsing the Cadeaux HTML (static markup)
    const fromHtml = await readCatalogFromHtml();
    if (fromHtml.size){
      console.debug('[Pack] Using parsed catalog from HTML:', srcBase.toString());
      for (const [k,v] of fromHtml) productIndex.set(k,v);
      return;
    }

    // c) Fallback: placeholders so UI never looks empty
    console.warn('[Pack] No catalog found. Rendering placeholders from IDs.');
    PACK.content.forEach(it=>{
      productIndex.set(it.id, {
        id: it.id,
        name: it.id,
        image: '',
        gallery: [],
        link: srcBase.toString() + '#' + it.id,
        desc: ''
      });
    });
  }

  function readGlobalCatalog(){
    const map = new Map();
    const ids = new Set(PACK.content.map(x=>x.id));

    // Candidate globals to check
    const candidates = [
      'GFT_CATALOG','CADEAUX_CATALOG','GIFTOREA_CATALOG',
      'giftoreaProducts','products','catalog','CATALOG'
    ];

    const seen = new Set();

    function tryAdd(item){
      if(!item) return;
      const id = item.id || item.slug || item.code;
      if(!id || !ids.has(id) || seen.has(id)) return;
      const name = item.name || item.title || item.nom || id;
      const image = item.image || item.img || item.cover || '';
      const gallery = item.gallery || item.galerie || item.images || [];
      const desc = item.desc || item.description || '';
      map.set(id, {
        id,
        name,
        image,
        gallery: Array.isArray(gallery) ? gallery.map(absFromSource) : [],
        link: srcBase.toString() + '#' + id,
        desc
      });
      seen.add(id);
    }

    // 1) Named globals
    for(const key of candidates){
      const val = window[key];
      if(!val) continue;

      if(Array.isArray(val)){
        val.forEach(tryAdd);
      }else if(typeof val === 'object'){
        Object.keys(val).forEach(k=>{
          const node = val[k];
          if(typeof node === 'object') tryAdd({...node, id: node.id || node.slug || node.code || k});
        });
      }
    }

    // 2) Light scan of window for arrays/objects that look like a catalog
    if(map.size < ids.size){
      try{
        for (const k of Object.keys(window)){
          const v = window[k];
          if(!v) continue;
          if(Array.isArray(v)){
            // Array of items with ids
            const sample = v.find(x=>x && (ids.has(x.id)||ids.has(x.slug)||ids.has(x.code)));
            if(sample){ v.forEach(tryAdd); }
          }else if(typeof v === 'object'){
            const hasAny = Object.keys(v).some(key=> ids.has(key));
            if(hasAny){
              Object.keys(v).forEach(key=>{
                const node = v[key];
                if(typeof node === 'object') tryAdd({...node, id: node.id || node.slug || node.code || key});
              });
            }
          }
          if(map.size === ids.size) break;
        }
      }catch(e){
        console.debug('[Pack] Window scan skipped:', e);
      }
    }

    return map;
  }

  async function readCatalogFromHtml(){
    const out = new Map();
    let html = '';
    try{
      const res = await fetch(srcBase.toString(), { cache: 'no-store' });
      if(!res.ok) throw new Error('HTTP ' + res.status);
      html = await res.text();
    }catch(e){
      console.error('[Pack] Could not fetch catalog page at', srcBase.toString(), e);
      return out;
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const cards = Array.from(doc.querySelectorAll('article.gft-card[data-id]'));
    if(!cards.length){
      console.warn('[Pack] No .gft-card[data-id] found in HTML. Is the Cadeaux page building cards with JS?');
      return out;
    }

    cards.forEach(el=>{
      const id = el.getAttribute('data-id');
      const nameEl = el.querySelector('.gft-body .gft-name, .gft-name');
      const mediaImg= el.querySelector('.gft-media img');
      const galNodes= el.querySelectorAll('.gft-gallery [data-gal-src], .gft-gallery img');
      const descEl  = el.querySelector('.gft-gallery .gft-desc, .gft-desc');

      const name = nameEl ? nameEl.textContent.trim() : id;
      const image = mediaImg ? absFromSource(mediaImg.getAttribute('src')) : '';
      const gallery = Array.from(galNodes)
        .map(n=> n.getAttribute('data-gal-src') || n.getAttribute('src') || '')
        .filter(Boolean)
        .map(absFromSource);
      const desc = descEl ? descEl.textContent.trim() : '';

      out.set(id, {
        id,
        name,
        image,
        gallery: gallery.length ? gallery : (image ? [image] : []),
        link: srcBase.toString() + '#' + id,
        desc
      });
    });

    return out;
  }

  // ------------- RENDERING -------------
  function renderHeader(){
    dom.title.textContent = PACK.name;
    dom.suitableText.textContent = PACK.suitableFor;
    dom.stickyPackName.textContent = PACK.name;
    dom.stickyPackPrice.textContent = fmt(PACK.price);
    const { totalProducts, totalQty } = totals();
    dom.statProducts.textContent = String(totalProducts);
    dom.statQty.textContent = `${totalQty} pcs`;
    dom.statPrice.textContent = fmt(PACK.price);
  }

  function renderContent(){
    const wrap = dom.contentCards;
    wrap.innerHTML = '';

    PACK.content.forEach(item=>{
      const p = productIndex.get(item.id) || { id:item.id, name:item.id, image:'', gallery:[], link:'#', desc:'' };
      const images = (p.gallery && p.gallery.length) ? p.gallery : (p.image ? [p.image] : []);

      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <div class="card__media">
          ${p.image ? `<img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async">`
                    : `<div class="img-ph" aria-hidden="true"></div>`}
          <button type="button" class="view" aria-label="Voir ${escapeHtml(p.name)}">👀 Voir</button>
        </div>
        <div class="card__body">
          <h3 class="card__name">${escapeHtml(p.name)}</h3>
          <span class="qty"><span class="ico">🔢</span>QTT&nbsp;: <strong>${Number(item.qty)}</strong></span>
        </div>
      `;

      card.querySelector('.view').addEventListener('click', ()=>{
        if(images.length) openModal(images, p.desc);
        else window.open(p.link, '_blank', 'noopener');
      });

      wrap.appendChild(card);
    });
  }

  // ------------- MODAL GALLERY -------------
  let gal = []; let gi = 0;
  function openModal(images=[], desc=''){
    gal = images.slice(); gi = 0;
    if(!gal.length){ closeModal(); return; }
    mImg.src = gal[0];
    mDesc.textContent = desc || '';
    modal.hidden = false;
    document.body.classList.add('modal-open');
  }
  function closeModal(){
    modal.hidden = true;
    mImg.src = '';
    mDesc.textContent = '';
    document.body.classList.remove('modal-open');
  }
  function step(delta){
    if(!gal.length) return;
    gi = (gi + delta + gal.length) % gal.length;
    mImg.src = gal[gi];
  }

  // ------------- PERSIST & NAV -------------
  function persistAndGo(){
    try{ localStorage.setItem('orderSource','ready-pack'); }catch(_){}
    const { totalProducts, totalQty } = totals();
    const packInfo = {
      id: PACK.id, name: PACK.name, price: fmtRaw(PACK.price),
      totalProducts, totalQuantity: totalQty, suitableFor: PACK.suitableFor
    };
    try{ localStorage.setItem('packInfo', JSON.stringify(packInfo)); }catch(_){}

    const lines = [{ id:'pack:'+PACK.id, name: PACK.name+' (coffret)', quantity:1, price:PACK.price, totalPrice:PACK.price }];
    PACK.content.forEach(it=>{
      const p = productIndex.get(it.id);
      lines.push({
        id: it.id,
        name: (p?.name || it.id) + ' — inclus',
        quantity: Number(it.qty||0),
        price: 0,
        totalPrice: 0,
        note: 'Inclus dans le pack'
      });
    });

    const globalTotal = lines.reduce((s,l)=> s + Number(l.totalPrice||0), 0);
    try{ localStorage.setItem('productData', JSON.stringify({ products: lines, globalTotal })); }catch(_){}
    try{
      const ex = JSON.parse(localStorage.getItem('completeOrderData') || '{}') || {};
      const merged = { ...ex, source:'ready-pack', orderDetails:{ products: lines, globalTotal } };
      localStorage.setItem('completeOrderData', JSON.stringify(merged));
    }catch(_){}

    window.location.href = ROUTES.customization;
  }

  // ------------- EVENTS -------------
  function attachEvents(){
    dom.orderTop.addEventListener('click', persistAndGo);
    dom.orderSticky.addEventListener('click', persistAndGo);

    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        dom.stickyCta.classList.toggle('is-hidden', e.isIntersecting);
      });
    }, {threshold: 0.4});
    io.observe(dom.orderTop);

    mClose.addEventListener('click', closeModal);
    mBack.addEventListener('click', closeModal);
    mPrev.addEventListener('click', ()=>step(-1));
    mNext.addEventListener('click', ()=>step(1));
    window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); });

    // Swipe (mobile)
    let startX=null;
    mImg.addEventListener('touchstart', (e)=>{ startX = e.touches[0].clientX; }, {passive:true});
    mImg.addEventListener('touchend', (e)=>{
      if(startX==null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if(Math.abs(dx) > 40) step(dx>0 ? -1 : 1);
      startX=null;
    }, {passive:true});
  }

  async function boot(){
    attachEvents();
    renderHeader();
    await buildCatalog();  // names/images/gallery into productIndex
    renderContent();
    console.debug('[Pack] Catalog entries:', Array.from(productIndex.keys()));
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
