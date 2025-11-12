
/* === Giftorea — ONE JS FILE (merged) =========================================
   Order (priority):
   1) Giftorea Boot (hero priority + loading gate)
   2) Hard Cap DOM (one category at a time)  <-- runs before categories init (i just removed this - anaaa )
   3) GFT CORE (unchanged app logic)
   4) Categories & Products (cards, dropdowns, drag, etc.)
   5) Industry Slider
   6) Marquee
   7) Order Panel (desktop)
   8) Cart Sheet (mobile)
   9) Modal Gallery
  10) Warning Tip
=============================================================================*/


/* =========================================================
   Giftorea Boot: image priority, lazy-later, optional gate
   Safe for Elementor, no CDN, no site-wide settings needed.
   ========================================================= */
(function () {
  const doc = document;

  // ————— Utilities —————
  function addLink(rel, href, as, extra = {}) {
    try {
      const l = doc.createElement('link');
      l.rel = rel; l.href = href;
      if (as) l.as = as;
      Object.assign(l, extra);
      doc.head.appendChild(l);
      return l;
    } catch { /* noop */ }
  }
  function pickHeroImages() {
    // Primary hero image (please add class "gft-hero-img" to your TOP image widget)
    const mainHero = doc.querySelector('img.gft-hero-img');

    // First image inside the hero grid (please add class "gft-hero-grid" to that 4-image grid container)
    const gridFirst = doc.querySelector('.gft-hero-grid img');

    // Fallbacks if classes aren’t set yet: first <img> on the page, then 2nd <img>
    const firstImg  = mainHero || doc.querySelector('img');
    const secondImg = gridFirst || doc.querySelectorAll('img')?.[1];

    return { mainHero: firstImg || null, gridFirst: secondImg || null };
  }
  function forcePriority(img) {
    if (!img) return;
    try {
      img.loading = 'eager';
      img.decoding = 'sync';
      if ('fetchPriority' in img) img.fetchPriority = 'high';
      // Preload the source the browser will actually fetch
      const src = img.currentSrc || img.src;
      if (src) addLink('preload', src, 'image', img.srcset ? { imagesrcset: img.srcset } : {});
      // Preconnect to the image host (dynamic, no hard-coded CDN)
      const u = new URL(src, location.href);
      addLink('preconnect', u.origin);
      addLink('dns-prefetch', u.origin);
    } catch { /* noop */ }
  }
  function lazyifyRest(exclude = []) {
    const excludeSet = new Set(exclude);
    doc.querySelectorAll('img').forEach(img => {
      if (excludeSet.has(img)) return;
      try {
        if (!img.loading) img.loading = 'lazy';
        img.decoding = 'async';
        if ('fetchPriority' in img) img.fetchPriority = 'low';
      } catch { /* noop */ }
    });
  }
  function showGate() {
    if (doc.getElementById('gft-gate')) return;
    const gate = doc.createElement('div');
    gate.id = 'gft-gate';
    gate.innerHTML = `
      <div class="gft-gate-card" role="status" aria-live="polite">
        <div class="gft-gate-spinner" aria-hidden="true"></div>
        <p class="gft-gate-text">Asber chwey!… la page se charge</p>
      </div>
    `;
    doc.body.appendChild(gate);
  }
  function hideGate() {
    const el = doc.getElementById('gft-gate');
    if (el) el.remove();
  }

  // ————— Boot flow —————
  function boot() {
    // (A) Find our above-the-fold images
    const { mainHero, gridFirst } = pickHeroImages();

    // (B) Prioritize them
    forcePriority(mainHero);
    forcePriority(gridFirst);

    // (C) Lazy everything else
    lazyifyRest([mainHero, gridFirst].filter(Boolean));

    // (D) Optionally fix http→https on our own domain images (avoids mixed-content delays)
    doc.querySelectorAll('img[src^="http://"]').forEach(img => {
      try {
        const u = new URL(img.src);
        if (u.hostname.endsWith('giftorea.explovea.com')) {
          img.src = img.src.replace('http://', 'https://');
        }
      } catch { /* noop */ }
    });

    // (E) Gate timing: only show if the device is slow (after 800ms)
    let gateTimer = setTimeout(showGate, 800);

    // Consider the boot "ready" when the main hero settles (or after a timeout)
    const finish = () => {
      clearTimeout(gateTimer);
      hideGate();
      window.GFT_BOOT_READY = true;
      document.dispatchEvent(new CustomEvent('gft:boot-ready'));
      document.documentElement.setAttribute('data-gft-ready', '1');
    };

    const heroToWatch = mainHero || gridFirst;
    if (heroToWatch && !heroToWatch.complete) {
      heroToWatch.addEventListener('load', () => setTimeout(finish, 80), { once: true });
      heroToWatch.addEventListener('error', () => setTimeout(finish, 80), { once: true });
      // safety net for very slow connections
      setTimeout(finish, 1800);
    } else {
      // hero is already cached/ready
      setTimeout(finish, 50);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

// ________________________________________________________________________
 //  _____ function te3 category lawla loads first then other load by order ______________

(function(){
  document.addEventListener('DOMContentLoaded', function(){
    const root = document.getElementById('gft-categories');
    if (!root) return;

    // First category (Agendas) and its images (keep real src there)
    const firstCat  = root.querySelector('.gft-cat.cat--first');
    const firstImgs = firstCat ? Array.from(firstCat.querySelectorAll('.gft-cards img')) : [];

    // All other categories' images that use data-src
    const otherImgs = Array.from(
      root.querySelectorAll('.gft-cat:not(.cat--first) .gft-cards img[data-src]')
    );

    // Concurrency limiter
    const MAX_CONCURRENT = 4;
    let inFlight = 0;
    const queue = [];

    function swapSrc(img){
      return new Promise((resolve) => {
        if (!img || !img.dataset || !img.dataset.src) { resolve(); return; }

        const realSrc = img.dataset.src;
        const tmp = new Image();
        tmp.decoding = 'async';
        tmp.onload = tmp.onerror = function(){
          img.src = realSrc;
          img.removeAttribute('data-src');
          resolve();
        };
        tmp.src = realSrc;
      });
    }

    function processQueue(){
      if (inFlight >= MAX_CONCURRENT) return;
      const next = queue.shift();
      if (!next) return;
      inFlight++;
      swapSrc(next).finally(() => {
        inFlight--;
        processQueue();
      });
    }

    function enqueue(img){
      if (!img || !img.dataset || !img.dataset.src) return;
      if (!queue.includes(img)) queue.push(img);
      processQueue();
    }

    // IntersectionObserver: when images are near viewport, enqueue them
    const io = ('IntersectionObserver' in window)
      ? new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting){
              enqueue(entry.target);
              io.unobserve(entry.target);
            }
          });
        }, { root: null, rootMargin: '400px 0px' })
      : null;

    // Observe all non-first-category images
    otherImgs.forEach(img => {
      if (io) io.observe(img);
      else enqueue(img); // fallback without IO
    });

    // When ALL first-category images have loaded (or errored), warm up a few offscreen ones
    let firstLeft = firstImgs.length;
    if (firstLeft === 0) prewarmSome();
    firstImgs.forEach(img => {
      if (img.complete) {
        if (--firstLeft === 0) prewarmSome();
      } else {
        img.addEventListener('load',  onFirstDone, { once: true });
        img.addEventListener('error', onFirstDone, { once: true });
      }
    });
    function onFirstDone(){
      if (--firstLeft === 0) prewarmSome();
    }
    function prewarmSome(){
      // Kick off first 4 queued images so the page feels snappy
      const upfront = otherImgs.slice(0, 4);
      upfront.forEach(enqueue);
    }

    // BONUS: when a <details> category is opened, nudge its images to load sooner
    root.addEventListener('toggle', (e) => {
      const det = e.target;
      if (!det.matches('.gft-cat')) return;
      if (!det.open) return; // only when opening
      const imgs = det.querySelectorAll('.gft-cards img[data-src]');
      imgs.forEach(img => {
        // If not yet observed/queued, enqueue now so it starts soon
        enqueue(img);
        if (io) io.unobserve(img); // avoid double-callback
      });
    });
  });
})();

/* === GFT CORE (unchanged app logic) === */
(function(){
  const GFT = (window.GFT = window.GFT || {});
  GFT.config = {
    CURRENCY: 'DZD',
    MIN_ORDER_PRICE: 19900,
    CONFIRM_URL: '../orderconfirmation/orderconfirmation.html'
  };

  // ---- Catalog & State
  GFT.catalog = [];              // {id,name,image,moq,step,tierPrices:[{minQty,unitPrice}], gallery:[], el}
  GFT.state = new Map();         // id -> {qty}
  GFT._restoreById = null;       // populated by load(), applied in registerCards() first-run

  // ---- Utils
  const fmt = n => `${(n||0).toLocaleString('fr-DZ')} ${GFT.config.CURRENCY}`;
  function unitPriceFor(p,qty){
    if(qty<=0) return null;
    const tier=[...p.tierPrices].sort((a,b)=>b.minQty-a.minQty).find(t=>qty>=t.minQty);
    return tier ? tier.unitPrice : null;
  }
  function snapQty(p,qty){
    if(qty<=0) return 0;
    if(qty<p.moq) return p.moq;
    const over = qty - p.moq;
    return p.moq + Math.ceil(over / p.step) * p.step;
  }
  function computeGrandTotal(){
    let total=0;
    GFT.catalog.forEach(p=>{
      const q=(GFT.state.get(p.id)||{qty:0}).qty;
      const u=unitPriceFor(p,q);
      if(u) total += u*q;
    });
    return total;
  }

  // ---- Persistence
  function save(){
    try{
      const products = GFT.catalog.map(p=>{
        const q=(GFT.state.get(p.id)||{qty:0}).qty;
        const u=unitPriceFor(p,q)||0;
        return { id:p.id, name:p.name, image:p.image, price:u, quantity:q, totalPrice:u*q };
      });
      const payload = { products, globalTotal: products.reduce((s,x)=>s+x.totalPrice,0) };
      localStorage.setItem('productData', JSON.stringify(payload));
      localStorage.setItem('orderSource', 'cadeaux');
    }catch(e){}
  }
  function load(){
    try{
      const saved=JSON.parse(localStorage.getItem('productData'));
      if(saved && Array.isArray(saved.products)){
        // Store by id; applied later when catalog exists.
        GFT._restoreById = new Map(saved.products.map(sp => [sp.id, sp.quantity||0]));
      }
    }catch(e){}
  }

  // ---- Public API
  GFT.api = {
    fmt, unitPriceFor, snapQty, computeGrandTotal,
    registerCards(scope){
      // On first run, load any saved quantities (by id)
      if (GFT._restoreById === null) load();

      const cards = Array.from(scope.querySelectorAll('.gft-card[data-id]'));
      cards.forEach(el=>{
        const id = el.dataset.id;
        if(GFT.catalog.some(p=>p.id===id)) return; // avoid duplicates
        const p = {
          id,
          name: el.querySelector('.gft-name')?.textContent.trim() || id,
          image: el.querySelector('.gft-media img')?.src || '',
          moq: parseInt(el.dataset.moq)||0,
          step: parseInt(el.dataset.step)||1,
          tierPrices: JSON.parse(el.dataset.tier||'[]'),
          gallery: Array.from(el.querySelectorAll('.gft-gallery [data-gal-src]')).map(i=>i.getAttribute('data-gal-src')),
          el
        };
        GFT.catalog.push(p);
        if(!GFT.state.has(id)) GFT.state.set(id,{qty:0});
        if(GFT._restoreById && GFT._restoreById.has(id)){
          const q = GFT._restoreById.get(id) || 0;
          if (q > 0) GFT.state.set(id,{qty:q});
        }
      });

      document.dispatchEvent(new CustomEvent('gft:catalog-changed'));
      GFT.api.emitCartUpdated();
    },
    setQty(id, qty){
      const p = GFT.catalog.find(x=>x.id===id);
      if(!p) return;
      const snapped = snapQty(p,qty);
      GFT.state.set(id,{qty:snapped});
      save();
      GFT.api.emitCartUpdated();
    },
    inc(id){
      const p=GFT.catalog.find(x=>x.id===id); if(!p) return;
      const q=(GFT.state.get(id)||{qty:0}).qty;
      GFT.api.setQty(id, q===0 ? p.moq : q + p.step);
    },
    dec(id){
      const p=GFT.catalog.find(x=>x.id===id); if(!p) return;
      const q=(GFT.state.get(id)||{qty:0}).qty;
      if(q===p.moq) return GFT.api.setQty(id,0);
      const nq = Math.max(0, q - p.step);
      GFT.api.setQty(id, (nq<p.moq && nq>0) ? p.moq : nq);
    },
    emitCartUpdated(){
      const total = computeGrandTotal();
      const items = GFT.catalog.map(p=>{
        const q=(GFT.state.get(p.id)||{qty:0}).qty;
        const u=unitPriceFor(p,q);
        return u ? {id:p.id,name:p.name,image:p.image,qty:q,unit:u,total:u*q} : null;
      }).filter(Boolean);
      document.dispatchEvent(new CustomEvent('gft:cart-updated', {detail:{total,items}}));
    },
    placeOrder(){
      const total = computeGrandTotal();
      if(total < GFT.config.MIN_ORDER_PRICE){
        document.dispatchEvent(new CustomEvent('gft:warn', {detail:`Le minimum de commande est ${fmt(GFT.config.MIN_ORDER_PRICE)}.`}));
        document.dispatchEvent(new Event('gft:open-sheet'));
        return;
      }
      save();
      window.location.href = GFT.config.CONFIRM_URL;
    },
    openModal(images=[], desc=''){
      document.dispatchEvent(new CustomEvent('gft:open-modal', {detail:{images,desc}}));
    }
  };

  // Prevent accidental empty links from jumping
  document.addEventListener('click',(e)=>{
    const a = e.target.closest('a[href]');
    if(!a) return;
    const href = a.getAttribute('href');
    if(!href || href === '') e.preventDefault();
  });
})();

/* --- Slider (BANNER) ------------------------------------------ */
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const sliderContainer = document.querySelector('.slider-container');
    if (!sliderContainer) return;

    const sliderWrapper = sliderContainer.querySelector('.slider-wrapper');
    const slides        = sliderContainer.querySelectorAll('.slide');
    const dotsContainer = sliderContainer.querySelector('.dots');
    if (!slides.length || !sliderWrapper || !dotsContainer) return;

    const AUTOPLAY_MS   = 3000;     // autoplay interval
    const RESUME_DELAY  = 4000;     // resume after user stops interacting (ms)

    let currentIndex    = 0;
    let timer           = null;     // single autoplay timer
    let resumeTimer     = null;     // when to resume after interaction
    let userInteracting = false;    // flag to keep hover resume logic sane

    // ----- sizing -----
    function containerW() { return Math.round(sliderContainer.getBoundingClientRect().width); }

    function sizeSlides() {
      const w = containerW();
      slides.forEach(s => { s.style.width = w + 'px'; });
      sliderWrapper.style.width = (w * slides.length) + 'px';
    }

    // ----- dots -----
    function renderDots() {
      dotsContainer.innerHTML = '';
      for (let i = 0; i < slides.length; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot' + (i === 0 ? ' active' : '');
        dot.addEventListener('click', () => goTo(i, true), { passive: true });
        dotsContainer.appendChild(dot);
      }
    }

    function updateDots() {
      const dots = dotsContainer.querySelectorAll('.dot');
      dots.forEach(d => d.classList.remove('active'));
      if (dots[currentIndex]) dots[currentIndex].classList.add('active');
    }

    // ----- movement -----
    function updateSliderPosition() {
      const x = -(currentIndex * containerW());
      sliderWrapper.style.transform = `translateX(${x}px)`;
      updateDots();
    }

    function goTo(index, byUser = false) {
      if (byUser) userPauseThenResume();
      currentIndex = (index + slides.length) % slides.length;
      updateSliderPosition();
    }

    function next(byUser = false) { goTo(currentIndex + 1, byUser); }
    function prev(byUser = false) { goTo(currentIndex - 1, byUser); }

    // ----- timer control (single source of truth) -----
    function startAutoplay() {
      if (timer) return;                 // don't stack timers
      timer = setInterval(() => next(false), AUTOPLAY_MS);
    }

    function stopAutoplay() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    function userPauseThenResume() {
      userInteracting = true;
      stopAutoplay();
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        userInteracting = false;
        startAutoplay();
      }, RESUME_DELAY);
    }

    // ----- UI wiring -----
    // arrows
    const prevBtn = sliderContainer.querySelector('.slider-btn.prev');
    const nextBtn = sliderContainer.querySelector('.slider-btn.next');
    if (prevBtn) prevBtn.addEventListener('click', () => prev(true));
    if (nextBtn) nextBtn.addEventListener('click', () => next(true));

    // hover / pointer
    sliderContainer.addEventListener('mouseenter', () => {
      stopAutoplay();
    });
    sliderContainer.addEventListener('mouseleave', () => {
      // if user clicked dots/arrows recently, wait for scheduled resume
      if (!userInteracting) startAutoplay();
    });

    // touch (mobile)
    sliderContainer.addEventListener('touchstart', () => {
      stopAutoplay();
    }, { passive: true });
    sliderContainer.addEventListener('touchend', () => {
      userPauseThenResume();
    }, { passive: true });

    // page visibility (don’t run timers on hidden tab)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAutoplay();
      else if (!userInteracting) startAutoplay();
    });

    // resize
    window.addEventListener('resize', () => {
      stopAutoplay();
      sizeSlides();
      updateSliderPosition();
      if (!userInteracting) startAutoplay();
    });

    // init
    sizeSlides();
    renderDots();
    updateSliderPosition();
    startAutoplay();

    // expose for inline onclick handlers if you still use them elsewhere
    window.changeSlide  = (dir) => dir > 0 ? next(true) : prev(true);
    window.currentSlide = (idx) => goTo(idx, true);
  });
})();

/* --- Categories & Products script ------------------------------------------ */
(function(){
  const scope = document.getElementById('gft-categories');

  let dragLockUntil = 0;
  const nowMs = () => performance.now();

  // Register all cards with the core
  GFT.api.registerCards(scope);

  // === HARDEN MEDIA: disable clicks/selection/drag/context menu on product images ===
  (function hardenImages(){
    const mediaEls = scope.querySelectorAll('.gft-media');
    const imgs = scope.querySelectorAll('.gft-media img');

   imgs.forEach(img => {
  img.setAttribute('draggable','false');
  img.addEventListener('dragstart',  (e)=>{ e.preventDefault(); }, { passive: true });
  img.addEventListener('contextmenu',(e)=>{ e.preventDefault(); }, { passive: true });
  // No touchstart listener here
});

    mediaEls.forEach(el=>{
      ['contextmenu','selectstart'].forEach(ev=>{
        el.addEventListener(ev, (e)=>{ e.preventDefault(); }, {passive:false});
      });
    });

    scope.addEventListener('selectstart', (e)=>{
      if(e.target.closest('.gft-card')) { e.preventDefault(); }
    });
  })();

  // === Auto-upgrade all .gft-view buttons to icon + label (no manual HTML edits) ===
  (function upgradeViewButtons(){
    const SVG = '<svg class="gft-eye" viewBox="0 0 24 24" aria-hidden="true" width="17" height="17"><path fill="currentColor" d="M12 5c4.7 0 8.7 2.9 10.5 7-1.8 4.1-5.8 7-10.5 7S3.3 16.1 1.5 12C3.3 7.9 7.3 5 12 5zm0 2C8.6 7 5.7 8.9 4.1 12 5.7 15.1 8.6 17 12 17s6.3-1.9 7.9-5C18.3 8.9 15.4 7 12 7zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5z"/></svg>';
    scope.querySelectorAll('.gft-view').forEach(btn=>{
      if (!btn.querySelector('.gft-eye')) {
        btn.setAttribute('aria-label', 'View product');
        btn.innerHTML = SVG + '<span class="gft-view__label">View</span>';
      } else {
        const ico = btn.querySelector('.gft-eye');
        ico.setAttribute('width','17'); ico.setAttribute('height','17');
      }
    });
  })();

  // === Move MOQ beside the stepper on mobile; restore on desktop ===
  (function inlineMOQ(){
    const map = new WeakMap(); // moqEl -> {parent, next}
    function moveForMobile(){
      scope.querySelectorAll('.gft-card').forEach(card=>{
        const moq = card.querySelector('.gft-moq');
        const row = card.querySelector('.gft-row');
        if(!moq || !row) return;
        if(!map.has(moq)) map.set(moq, { parent: moq.parentNode, next: moq.nextSibling });
        if (moq.parentNode !== row) row.appendChild(moq);
      });
    }
    function restoreForDesktop(){
      scope.querySelectorAll('.gft-card').forEach(card=>{
        const moq = card.querySelector('.gft-moq');
        if(!moq) return;
        const info = map.get(moq);
        if(!info) return;
        if (moq.parentNode !== info.parent){
          info.parent.insertBefore(moq, info.next);
        }
      });
    }
    const mq = window.matchMedia('(max-width: 600px)');
    const apply = e => e.matches ? moveForMobile() : restoreForDesktop();
    apply(mq);
    (mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply));
  })();

  // ===== PRICE RANGE + DROPDOWN (glass, portal-fixed + live reposition) =====
  (function priceDropdowns(){
    // Create a portal attached to <body> so the menu never clips
    let portal = document.getElementById('gft-portal');
    if(!portal){
      portal = document.createElement('div');
      portal.id = 'gft-portal';
      portal.style.position = 'fixed';
      portal.style.inset = '0';
      portal.style.pointerEvents = 'none';
      portal.style.zIndex = '9999';
      document.body.appendChild(portal);
    }

    const CHEV = '<svg class="gft-price-chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>';

    // Track the single open dropdown
    let openDD = null; // { menu, toggle, pid }
    let raf = null;

    function closeOpenDD(){
      if(!openDD) return;
      openDD.menu.classList.remove('is-open','is-flip');
      openDD.menu.style.pointerEvents = 'none';
      openDD.menu.style.removeProperty('--arrow-x');
      openDD.toggle.setAttribute('aria-expanded','false');
      openDD.toggle.classList.remove('is-open');
      openDD = null;
    }

    // Compute and apply menu position relative to the toggle
    function positionMenu(toggle, menu){
      const margin = 10;
      const vw = window.innerWidth, vh = window.innerHeight;
      const tRect = toggle.getBoundingClientRect();

      // If anchor left viewport, close to avoid floating ghosts
      if (tRect.bottom < 0 || tRect.top > vh || tRect.right < 0 || tRect.left > vw){
        closeOpenDD(); return;
      }

      const mw = menu.offsetWidth || 260;
      const mh = menu.offsetHeight || 160;

      let left = Math.round(Math.min(Math.max(margin, tRect.left), vw - mw - margin));
      const openBelowTop = Math.round(tRect.bottom + 8);
      const openAboveTop = Math.round(tRect.top - mh - 8);

      let top = openBelowTop;
      let flip = false;
      if (openBelowTop + mh > vh - margin && openAboveTop > margin){
        top = openAboveTop; flip = true;
      }

      const arrowX = Math.round((tRect.left + tRect.width/2) - left);

      menu.style.left = left + 'px';
      menu.style.top  = top  + 'px';
      menu.classList.toggle('is-flip', flip);
      menu.style.pointerEvents = 'auto';
      menu.style.setProperty('--arrow-x', arrowX + 'px');
    }

    // rAF-throttled repositioner used on scroll/resize/orientation events
    function scheduleReposition(){
      if(!openDD) return;
      if(raf) return;
      raf = requestAnimationFrame(()=>{
        raf = null;
        if(openDD && document.contains(openDD.toggle)){
          positionMenu(openDD.toggle, openDD.menu);
        }else{
          closeOpenDD();
        }
      });
    }

    // Global listeners (once)
    document.addEventListener('click', (e)=>{
      if(!openDD) return;
      const inside = e.target.closest('.gft-price-menu, .gft-price-toggle');
      if(!inside) closeOpenDD();
    });
    document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeOpenDD(); });
    window.addEventListener('resize', scheduleReposition, {passive:true});
    window.addEventListener('orientationchange', scheduleReposition, {passive:true});
    // Reposition on any scrollable ancestor + window
    window.addEventListener('scroll', scheduleReposition, {passive:true, capture:true});

    function buildForProduct(p){
      const card  = p.el;
      const meta  = card.querySelector('.gft-meta');
      const range = card.querySelector('.gft-range');
      if(!meta || !range) return;

      // Ensure the toggle button sits right after the range text
      let toggle = meta.querySelector('.gft-price-toggle');
      if(!toggle){
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'gft-price-toggle';
        toggle.innerHTML = CHEV;
        toggle.setAttribute('aria-label','Voir les tarifs par quantité');
        toggle.setAttribute('aria-expanded','false');
        toggle.dataset.pid = p.id;
      }
      if(range.nextElementSibling !== toggle){
        range.insertAdjacentElement('afterend', toggle);
      }

      // Ensure this product’s floating menu exists in the portal
      let menu = portal.querySelector(`.gft-price-menu[data-pid="${p.id}"]`);
      if(!menu){
        menu = document.createElement('div');
        menu.className = 'gft-price-menu';
        menu.dataset.pid = p.id;
        menu.setAttribute('role','list');
        portal.appendChild(menu);
      }

      // Populate/refresh menu (ascending by minQty)
      function fillMenu(){
        menu.innerHTML = '';
        const tiers = (p.tierPrices||[]).slice().sort((a,b)=>a.minQty-b.minQty);
        tiers.forEach(t=>{
          const row = document.createElement('div');
          row.className = 'gft-price-item';
          row.setAttribute('role','listitem');
          row.dataset.min = String(t.minQty);
          row.dataset.price = String(t.unitPrice);
          row.innerHTML = `
            <span class="gft-price-q">≥ ${t.minQty}</span>
            <span class="gft-price-v">${GFT.api.fmt(t.unitPrice)}</span>
          `;
          menu.appendChild(row);
        });
      }
      fillMenu();

      // Active tier highlight (called by render)
      menu._syncActive = function(){
        const q = (GFT.state.get(p.id)||{qty:0}).qty||0;
        const tiers = (p.tierPrices||[]).slice().sort((a,b)=>a.minQty-b.minQty);
        let activeMin = null;
        for(const t of tiers){ if(q >= t.minQty) activeMin = t.minQty; }
        menu.querySelectorAll('.gft-price-item').forEach(row=>{
          row.classList.toggle('is-active', Number(row.dataset.min) === (activeMin||0));
        });
      };
      menu._syncActive();

      function openMenu(){
        if (nowMs() < dragLockUntil) return; // ignore immediately after drag
        // Close any other one first
        if(openDD && openDD.menu !== menu) closeOpenDD();

        toggle.setAttribute('aria-expanded','true');
        toggle.classList.add('is-open');
        menu.classList.add('is-open');
        openDD = { menu, toggle, pid: p.id };

        // First position immediately, then subsequent positions are rAF-throttled
        positionMenu(toggle, menu);
      }

      toggle.addEventListener('click', (e)=>{ e.stopPropagation(); openMenu(); });
      toggle.addEventListener('keydown', (e)=>{
        if(e.key==='Enter' || e.key===' '){ e.preventDefault(); openMenu(); }
        if(e.key==='Escape'){ closeOpenDD(); }
      });

      // Also reposition while the horizontal row scrolls (drag or wheel)
      const row = card.closest('.gft-cards');
      if(row){
        row.addEventListener('scroll', scheduleReposition, {passive:true});
      }
    }

    // Build for all products now and on catalog-ready
    GFT.catalog.forEach(buildForProduct);
    document.addEventListener('gft:catalog-ready', ()=>{ GFT.catalog.forEach(buildForProduct); });

    // Let render() keep the active tier highlight synced
    scope._syncPriceMenusFor = function(pid){
      const menu = document.querySelector(`.gft-price-menu[data-pid="${pid}"]`);
      if(menu && typeof menu._syncActive === 'function'){ menu._syncActive(); }
      if(openDD && openDD.pid === pid) scheduleReposition();
    };
  })();

  // ===== Helpers for UI text (range: smallest → largest) =====
  function priceRangeText(p){
    const prices = p.tierPrices.map(t=>t.unitPrice);
    if (!prices.length) return '';
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return `${min} – ${max} ${GFT.config.CURRENCY}`;
    // Or if you want formatted: `${GFT.api.fmt(min)} – ${GFT.api.fmt(max)}`
  }

  // ===== Render a single card =====
  function renderCard(p){
    const q = (GFT.state.get(p.id)||{qty:0}).qty;
    const u = GFT.api.unitPriceFor(p,q);
    const total = u ? u*q : 0;
    const rangeEl = p.el.querySelector('.gft-range'); if(rangeEl) rangeEl.textContent = priceRangeText(p);
    const moqEl = p.el.querySelector('.gft-moq'); if(moqEl) moqEl.textContent = `MOQ: ${p.moq}`;
    const totalEl = p.el.querySelector('.gft-total'); if(totalEl) totalEl.textContent = `Total: ${GFT.api.fmt(total)}`;
    const input = p.el.querySelector(`input[data-id="${p.id}"]`); if(input) input.value = q;

    // Keep the dropdown highlight in sync with current tier
    if(scope._syncPriceMenusFor) scope._syncPriceMenusFor(p.id);
  }
  function renderAll(){ GFT.catalog.forEach(renderCard); }

 // ===== Interactions =====
  scope.addEventListener('click', (e)=>{
    // ignore clicks immediately after a drag
    if (nowMs() < dragLockUntil) return;

    // Stepper (+ / −)
    const btn = e.target.closest('button[data-action]');
    if (btn){
      const id = btn.getAttribute('data-id');
      if (btn.dataset.action === 'inc') GFT.api.inc(id);
      else                              GFT.api.dec(id);
      renderAll();
      return;
    }

    // View (open gallery modal with images + description from HTML)
    const view = e.target.closest('button.gft-view');
    if (view){
      const card = view.closest('.gft-card');
      if (!card) return;

      // Images: prefer hidden gallery entries, otherwise fallback to cover image
      let imgs = Array.from(card.querySelectorAll('.gft-gallery [data-gal-src]'))
        .map(el => el.getAttribute('data-gal-src'))
        .filter(Boolean);
      if (!imgs.length){
        const cover = card.querySelector('.gft-media img');
        if (cover && cover.src) imgs = [cover.src];
      }

      // Title (optional, not required by your current modal code)
      const title = (card.querySelector('.gft-name')?.textContent || '').trim();

      // Description: from hidden .gft-desc inside the card (or data-desc if you prefer)
      const dEl = card.querySelector('.gft-desc');
      const descText = dEl ? dEl.textContent.trim()
                          : (card.getAttribute('data-desc') || '').trim();

      // Fire the existing modal event (your modal listens to 'gft:open-modal')
      document.dispatchEvent(new CustomEvent('gft:open-modal', {
        detail: { images: imgs, desc: descText, title }
      }));
    }
  });


  scope.addEventListener('change', (e)=>{
    if (nowMs() < dragLockUntil) return;
    const input=e.target.closest('input[type="number"][data-id]');
    if(!input) return;
    const id = input.getAttribute('data-id');
    let val = parseInt(input.value||'0',10); if(isNaN(val)||val<0) val=0;
    GFT.api.setQty(id,val);
    renderAll();
  });

  // Micro-interactions for view + stepper buttons (force navy/blue, kill pink)
  scope.querySelectorAll('.gft-view, .gft-stepper button').forEach(btn=>{
    const down = () => btn.classList.add('is-pressed');
    const up   = () => btn.classList.remove('is-pressed');
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('blur', up);
    btn.style.webkitTapHighlightColor = 'rgba(36,118,196,0.25)';
  });

  // ===== Accessible, click-only toggles with animated open/close (height + fade) =====
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  scope.querySelectorAll('details > summary').forEach(sum=>{
    const d = sum.parentElement;
    const cards = () => d.querySelector(':scope > .gft-cards');
    sum.setAttribute('aria-expanded', d.open ? 'true' : 'false');

    function animateOpen(){
      const el = cards();
      if(!el){ d.open = true; sum.setAttribute('aria-expanded','true'); return; }
      d.open = true;
      if(reduceMotion){ sum.setAttribute('aria-expanded','true'); return; }

      el.style.overflow = 'hidden';
      el.style.height   = '0px';
      el.style.opacity  = '0';
      el.style.transition = 'none';
      requestAnimationFrame(()=>{
        el.style.transition = 'height 240ms ease, opacity 240ms ease';
        el.style.height  = el.scrollHeight + 'px';
        el.style.opacity = '1';
        const done = () => {
          el.style.transition = 'none';
          el.style.height = 'auto';
          el.style.overflow = '';
          el.removeEventListener('transitionend', done);
        };
        el.addEventListener('transitionend', done);
      });
      sum.setAttribute('aria-expanded','true');
    }

    function animateClose(){
      const el = cards();
      if(!el){ d.open = false; sum.setAttribute('aria-expanded','false'); return; }
      if(reduceMotion){ d.open = false; sum.setAttribute('aria-expanded','false'); return; }

      el.style.overflow   = 'hidden';
      el.style.height     = el.scrollHeight + 'px';
      el.style.opacity    = '1';
      el.style.transition = 'none';
      requestAnimationFrame(()=>{
        el.style.transition = 'height 240ms ease, opacity 240ms ease';
        el.style.height  = '0px';
        el.style.opacity = '0';
        const done = () => {
          d.open = false;
          sum.setAttribute('aria-expanded','false');
          el.style.transition = 'none';
          el.style.overflow = '';
          el.removeEventListener('transitionend', done);
        };
        el.addEventListener('transitionend', done);
      });
    }

    sum.addEventListener('click',(e)=>{
      e.preventDefault();
      d.open ? animateClose() : animateOpen();
      sum.focus();
    });

    sum.addEventListener('keydown',(e)=>{
      if(e.key==='Enter' || e.key===' '){
        e.preventDefault();
        d.open ? animateClose() : animateOpen();
      }
    });
  });

  // ===== Drag scroll for each row (calmer momentum) =====
  function enableDrag(root){
    let isDown=false, dragging=false, startX=0, startScroll=0, lastX=0, lastT=0, v=0, raf=null;
    const THRESH=6, SPEED=8, DAMP=0.90, VCAP=0.8, LOCK_MS=150;
    const stopMomentum=()=>{ if(raf){ cancelAnimationFrame(raf); raf=null; } };

    root.addEventListener('pointerdown',(e)=>{
      if(e.target.closest('button, input')) return;
      isDown=true; dragging=false;
      startX=e.clientX; startScroll=root.scrollLeft; lastX=startX; lastT=performance.now(); v=0;
      stopMomentum();
    },{passive:true});

    root.addEventListener('pointermove',(e)=>{
      if(!isDown) return;
      const dx=e.clientX-startX;
      if(!dragging && Math.abs(dx)>THRESH){
        dragging=true; root.classList.add('dragging');
      }
      if(dragging){
        const now=performance.now();
        const ddx=e.clientX-lastX;
        const dt=Math.max(1, now-lastT);
        v = Math.max(-VCAP, Math.min(VCAP, ddx/dt));
        root.scrollLeft = startScroll - dx;
        lastX=e.clientX; lastT=now;
        e.preventDefault();
      }
    },{passive:false});

    function momentum(){
      v *= DAMP;
      if(Math.abs(v) < 0.002){ stopMomentum(); return; }
      root.scrollLeft -= v * SPEED * 16;
      raf=requestAnimationFrame(momentum);
    }

    function end(){
      if(!isDown) return;
      isDown=false;
      if(dragging){
        root.classList.remove('dragging');
        stopMomentum();
        raf=requestAnimationFrame(momentum);
        dragLockUntil = nowMs() + LOCK_MS;
      }
      dragging=false;
    }

    root.addEventListener('pointerup', end, {passive:true});
    root.addEventListener('pointercancel', end, {passive:true});
    root.addEventListener('wheel', stopMomentum, {passive:true});
    root.addEventListener('touchstart', stopMomentum, {passive:true});
  }
  scope.querySelectorAll('.gft-cards').forEach(enableDrag);

  // ===== Initial paint + listen to cart updates =====
  renderAll();
  document.addEventListener('gft:cart-updated', renderAll);
})();


/* --- Industry slider -------------------------------------------------------- */
(function(){
  const root = document.getElementById('gftIndustrySlider');
  if(!root) return;

  // === Drag-to-scroll: same behavior & constants as product cards ===
  let isDown=false, dragging=false, startX=0, startScroll=0, lastX=0, lastT=0, v=0, raf=null;
  let dragLockUntil = 0;
  const nowMs = () => performance.now();
  const THRESH=6, SPEED=8, DAMP=0.90, VCAP=0.8, LOCK_MS=150;

  const stopMomentum = () => { if(raf){ cancelAnimationFrame(raf); raf=null; } };

  root.addEventListener('pointerdown',(e)=>{
    // Allow dragging even on <a>; clicks will be locked briefly after drag (same pattern)
    isDown=true; dragging=false;
    startX=e.clientX; startScroll=root.scrollLeft; lastX=startX; lastT=performance.now(); v=0;
    stopMomentum();
  },{passive:true});

  root.addEventListener('pointermove',(e)=>{
    if(!isDown) return;
    const dx=e.clientX-startX;
    if(!dragging && Math.abs(dx)>THRESH){
      dragging=true; root.classList.add('dragging');
    }
    if(dragging){
      const now=performance.now();
      const ddx=e.clientX-lastX;
      const dt=Math.max(1, now-lastT);
      v = Math.max(-VCAP, Math.min(VCAP, ddx/dt));
      root.scrollLeft = startScroll - dx;
      lastX=e.clientX; lastT=now;
      e.preventDefault(); // sticks to finger like the cards do
    }
  },{passive:false});

  function momentum(){
    v *= DAMP;
    if(Math.abs(v) < 0.002){ stopMomentum(); return; }
    root.scrollLeft -= v * SPEED * 16;
    raf=requestAnimationFrame(momentum);
  }

  function end(){
    if(!isDown) return;
    isDown=false;
    if(dragging){
      root.classList.remove('dragging');
      stopMomentum();
      raf=requestAnimationFrame(momentum);
      dragLockUntil = nowMs() + LOCK_MS; // brief click lock (same idea as cards)
    }
    dragging=false;
  }

  root.addEventListener('pointerup', end, {passive:true});
  root.addEventListener('pointercancel', end, {passive:true});
  root.addEventListener('wheel', stopMomentum, {passive:true});
  root.addEventListener('touchstart', stopMomentum, {passive:true});

  // Prevent accidental clicks when just finished dragging (mirrors cards’ lock)
  root.addEventListener('click', (e)=>{
    if (nowMs() < dragLockUntil){ e.preventDefault(); e.stopPropagation(); }
  }, true);
})();


/* --- Marquee --------------------------------------------------------------- */
(() => {
  const MOBILE = window.matchMedia('(max-width: 768px)');
  const MOBILE_SLOWDOWN = 0.5; // slightly slower on mobile

  document.querySelectorAll('.gft-marquee').forEach(initMarquee);

  function initMarquee(root){
    const track = root.querySelector('.gft-marquee__track');
    if(!track) return;

    // Remove any old CSS animations that could interfere
    track.style.animation = 'none';

    const seed = track.innerHTML;

    // Ensure the track is wider than the viewport so the modulo loop never shows blanks
    function ensureFill() {
      let guard = 0;
      while (track.scrollWidth < root.clientWidth * 1.25 && guard < 24) {
        track.insertAdjacentHTML('beforeend', seed);
        guard++;
      }
    }
    ensureFill();

    // One clone placed adjacent to the original; CSS handles direction-based transforms
    function mountClone() {
      const prev = root.querySelector('.gft-marquee__track--clone');
      if (prev) prev.remove();
      const clone = track.cloneNode(true);
      clone.className = 'gft-marquee__track gft-marquee__track--clone';
      root.appendChild(clone);
      return clone;
    }
    let clone = mountClone();

    // Measure width and expose it to CSS as a variable
    function measure() {
      ensureFill();
      const W = Math.max(1, track.scrollWidth);
      root.style.setProperty('--w', W + 'px');
    }
    measure();

    const ro1 = new ResizeObserver(measure);
    const ro2 = new ResizeObserver(() => { measure(); clone = mountClone(); });
    ro1.observe(root);
    ro2.observe(track);
    MOBILE.addEventListener('change', () => {/* speed is computed each frame */});

    // Animation loop: JS updates --x only; CSS uses --dir to decide left/right
    let last = 0, offset = 0;
    const baseSpeed = parseFloat(root.dataset.speed) || 90;

    function frame(t){
      if (!last) last = t;
      let dt = (t - last) / 1000; last = t;
      if (dt > 0.5) dt = 0.016; // clamp big jumps (tab switch)

      const speed = baseSpeed * (MOBILE.matches ? MOBILE_SLOWDOWN : 1);
      offset += speed * dt;

      const W = parseFloat(getComputedStyle(root).getPropertyValue('--w')) || track.scrollWidth || 1;
      const m = Math.round(((offset % W) + W) % W); // pixel-rounded -> no 1px seam

      root.style.setProperty('--x', m + 'px');

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
})();


/* --- Order Panel (desktop) ------------------------------------------------- */
(function(){
  const panel      = document.querySelector('.gft-orderPanel');
  const listEl     = document.getElementById('gftCartItems');
  const totalEl    = document.getElementById('gftGrandTotal');
  const btnPlace   = document.getElementById('gftPlaceOrder');
  const btnToggle  = document.getElementById('gftCartToggle');
  const btnClear   = document.getElementById('gftClearAll');

  let isMobile = window.matchMedia('(max-width: 1023px)').matches;
  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let lastItems = [];

  /* ========= UNDO BUFFER (unchanged) ========= */
  const undoBuf = new Map();
  const addUndo = (id, qty) => { if (!id || !qty) return; undoBuf.set(id, (undoBuf.get(id) || 0) + qty); updateClearRestoreUI(); };
  const addAllToUndo = (items=[]) => { undoBuf.clear(); items.forEach(x => addUndo(x.id, x.qty)); updateClearRestoreUI(); };
  const restoreUndo = () => { if (!undoBuf.size) return; for (const [id, qty] of undoBuf.entries()){ GFT.api.setQty(id, qty); } undoBuf.clear(); GFT.api.emitCartUpdated(); updateClearRestoreUI(); };
  const hasUndo = () => undoBuf.size > 0;

  function updateClearRestoreUI(){
    const emptyCart = (lastItems.length === 0);
    const canRestore = emptyCart && hasUndo();
    if (canRestore){
      btnClear.textContent = 'Restaurer les produits';
      btnClear.setAttribute('aria-label','Restaurer les produits');
      btnClear.classList.add('is-undo');
      btnClear.disabled = false;
    } else {
      btnClear.textContent = 'Tout supprimer';
      btnClear.setAttribute('aria-label','Tout supprimer');
      btnClear.classList.remove('is-undo');
      btnClear.disabled = (lastItems.length === 0 && !hasUndo());
    }
  }

  /* ========= COLLAPSE LIST ONLY (debounced + tokenized) ========= */
  const LS_KEY = 'gft:orderPanelListCollapsed';
  const getCollapsed = () => { try { return localStorage.getItem(LS_KEY) === '1'; } catch(e){ return false; } };
  const setCollapsed = (v)  => { try { localStorage.setItem(LS_KEY, v ? '1' : '0'); } catch(e){} };

  let animToken = 0;
  function setListCollapsed(collapsed){
    if (isMobile || !listEl) return;

    panel.classList.toggle('is-list-collapsed', !!collapsed);
    if (btnToggle){
      btnToggle.setAttribute('aria-expanded', String(!collapsed));
      btnToggle.setAttribute('aria-label', collapsed ? 'Ouvrir la liste des produits' : 'Réduire la liste des produits');
      btnToggle.title = collapsed ? 'Ouvrir la liste des produits' : 'Réduire la liste des produits';
      btnToggle.classList.toggle('is-collapsed', !!collapsed);
    }

    if (reduceMotion){
      listEl.style.transition = 'none';
      listEl.style.height = collapsed ? '0px' : 'auto';
      listEl.style.opacity = collapsed ? '0' : '1';
      listEl.style.overflow = collapsed ? 'hidden' : 'auto';
      listEl.style.display = collapsed ? 'none' : '';
      return;
    }

    // Cancel any previous animation
    animToken++;
    const token = animToken;

    if (collapsed){
      const h = listEl.scrollHeight;
      listEl.style.overflow = 'hidden';
      listEl.style.height   = h + 'px';
      listEl.style.opacity  = '1';
      requestAnimationFrame(()=>{
        if (token !== animToken) return;
        listEl.style.transition = 'height 240ms ease, opacity 200ms ease';
        listEl.style.height = '0px';
        listEl.style.opacity = '0';
      });
      const onEnd = () => {
        if (token !== animToken) return;
        listEl.style.display   = 'none';
        listEl.style.transition = 'none';
        listEl.style.height     = '0px';
        listEl.style.overflow   = 'auto';
        listEl.removeEventListener('transitionend', onEnd);
      };
      listEl.addEventListener('transitionend', onEnd);
    } else {
      listEl.style.display   = '';
      listEl.style.transition = 'none';
      const targetH = listEl.scrollHeight || 0;
      listEl.style.overflow = 'hidden';
      listEl.style.height   = '0px';
      listEl.style.opacity  = '0';
      requestAnimationFrame(()=>{
        if (token !== animToken) return;
        listEl.style.transition = 'height 240ms ease, opacity 200ms ease';
        listEl.style.height = targetH + 'px';
        listEl.style.opacity = '1';
        const onEnd = () => {
          if (token !== animToken) return;
          listEl.style.transition = 'none';
          listEl.style.height     = 'auto';
          listEl.style.overflow   = 'auto';
          listEl.removeEventListener('transitionend', onEnd);
        };
        listEl.addEventListener('transitionend', onEnd);
      });
    }
  }

  /* ========= Reveal once (unchanged) ========= */
  let revealed = false;
  (function setupRevealOnce(){
    panel.classList.add('is-hidden');
    const target =
      document.querySelector('#gft-categories') ||
      document.querySelector('[data-gft-categories]') ||
      document.querySelector('.gft-cards') || document.body;

    const io = new IntersectionObserver((entries, obs)=>{
      for (const e of entries){
        if (e.isIntersecting && !revealed){
          revealed = true;
          panel.classList.remove('is-hidden');
          if (!isMobile) setListCollapsed(getCollapsed());
          obs.disconnect();
          break;
        }
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -40% 0px' });

    io.observe(target);
  })();

  /* ========= Actions ========= */
  const openSheet = () => { GFT.api.emitCartUpdated(); document.dispatchEvent(new Event('gft:open-sheet')); };
  const place     = () => GFT.api.placeOrder();

  function applyMode(){
    isMobile = window.matchMedia('(max-width: 1023px)').matches;

    btnPlace.removeEventListener('click', openSheet);
    btnPlace.removeEventListener('click', place);

    if (isMobile){
      btnPlace.textContent = 'Voir Panier';
      btnPlace.setAttribute('aria-label', 'Voir le panier');
      btnPlace.disabled = false;
      btnPlace.addEventListener('click', openSheet);
      if (btnToggle) btnToggle.hidden = true;
      if (btnClear)  btnClear.hidden  = true;
    } else {
      btnPlace.textContent = 'Commander';
      btnPlace.setAttribute('aria-label', 'Commander');
      btnPlace.addEventListener('click', place);
      if (btnToggle) btnToggle.hidden = false;
      if (btnClear)  btnClear.hidden  = false;
      setListCollapsed(getCollapsed());
    }
  }

  function gotoProduct(pid){
    const card = document.querySelector(`.gft-card[data-id="${pid}"]`);
    if(!card) return;
    const det = card.closest('details.gft-cat');
    if (det && !det.open) det.open = true;
    const row = card.closest('.gft-cards');
    if (row){
      const left = Math.max(0, card.offsetLeft - (row.clientWidth/2 - card.clientWidth/2));
      row.scrollTo({ left, behavior: 'smooth' });
    }
    card.classList.add('gft-card--highlight');
    setTimeout(()=>card.classList.remove('gft-card--highlight'), 1600);
    card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  function render({ total, items }){
    lastItems = items || [];
    totalEl.textContent = GFT.api.fmt(total);
    if (!isMobile){
      btnPlace.disabled = total < GFT.config.MIN_ORDER_PRICE;
    }

    // rows (only "Modifier" action)
    listEl.innerHTML = (lastItems).map(x => `
      <div class="row" data-pid="${x.id || ''}">
        <div class="th"><img src="${x.image}" alt="${x.name}"></div>
        <div class="main">
          <div class="nm">${x.name}</div>
          <div class="mt">Qty: <strong>${x.qty}</strong> · Unit: <strong>${GFT.api.fmt(x.unit)}</strong></div>
        </div>
        <div class="ln">${GFT.api.fmt(x.total)}</div>
        <div class="ac" aria-hidden="true">
          <button class="btn btn-edit" type="button" title="Aller au produit" aria-label="Aller au produit">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 8a4 4 0 100 8 4 4 0 000-8zm0-6a1 1 0 011 1v2.06a8.01 8.01 0 015.94 5.94H21a1 1 0 110 2h-2.06A8.01 8.01 0 0113 18.94V21a1 1 0 11-2 0v-2.06A8.01 8.01 0 015.06 13H3a1 1 0 110-2h2.06A8.01 8.01 0 0111 5.06V3a1 1 0 011-1z"/></svg>
            <span>Modifier</span>
          </button>
        </div>
      </div>
    `).join('');

    updateClearRestoreUI();
  }

  // Only "edit" action
  listEl.addEventListener('click', (e)=>{
    const row = e.target.closest('.row');
    if (!row) return;
    const pid = row.getAttribute('data-pid');
    if (!pid) return;
    if (e.target.closest('.btn-edit')){ gotoProduct(pid); return; }
  });

  // Clear / Restore (unchanged)
  if (btnClear){
    btnClear.addEventListener('click', ()=>{
      const empty = (lastItems.length === 0);
      if (empty){ restoreUndo(); }
      else      { addAllToUndo(lastItems); lastItems.forEach(x => GFT.api.setQty(x.id, 0)); GFT.api.emitCartUpdated(); }
    });
  }

  // NEW: safe, debounced toggle to avoid instant re-toggle on laptop
  let toggleLockUntil = 0;
  if (btnToggle){
    btnToggle.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if (isMobile) return;
      const now = performance.now();
      if (now < toggleLockUntil) return;       // short lock against double toggles
      const next = !panel.classList.contains('is-list-collapsed');
      setListCollapsed(next);
      setCollapsed(next);
      toggleLockUntil = now + 350;             // 350ms feels snappy; adjust if needed
    });
  }

  window.addEventListener('resize', applyMode, { passive: true });
  document.addEventListener('gft:cart-updated', (e)=>render(e.detail));

  applyMode();
  GFT.api.emitCartUpdated(); // initial
})();


/* --- Cart Sheet (mobile) --------------------------------------------------- */
(function(){
  const el       = document.getElementById('gftSheet');
  const list     = document.getElementById('gftSheetList');
  const totalEl  = document.getElementById('gftSheetTotal');
  const go       = document.getElementById('gftSheetPlace');
  const btnClear = document.getElementById('gftSheetClear');
  const orderPanel = document.querySelector('.gft-orderPanel');

  let isOpen = false;
  let lastItems = [];

  // ---------- prevent clicks to desktop panel while open ----------
  function lockUnderlay(lock){
    if (orderPanel) orderPanel.style.pointerEvents = lock ? 'none' : '';
    document.body.classList.toggle('gft-sheet-open', !!lock);
  }

  function open(){
    if (isOpen) return;
    isOpen = true;
    el.classList.add('on');
    el.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    lockUnderlay(true);
    GFT.api.emitCartUpdated(); // fresh data on open
  }
  function close(){
    if (!isOpen) return;
    isOpen = false;
    el.classList.remove('on');
    el.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    lockUnderlay(false);
  }

  document.addEventListener('gft:open-sheet', open);
  document.addEventListener('gft:close-sheet', close);
  el.addEventListener('click', (e)=>{ if(e.target.hasAttribute('data-close')) close(); });

  // ---------- Undo buffer (clear/restore all) ----------
  const undoBuf = new Map(); // id -> qty
  const hasUndo = () => undoBuf.size > 0;
  function addAllToUndo(items){
    undoBuf.clear();
    (items||[]).forEach(x => { if (x && x.id && x.qty) undoBuf.set(x.id, x.qty); });
  }
  function restoreUndo(){
    if (!hasUndo()) return;
    for (const [id, qty] of undoBuf.entries()){
      GFT.api.setQty(id, qty);
    }
    undoBuf.clear();
    GFT.api.emitCartUpdated();
    updateClearUI();
  }
  function updateClearUI(){
    const emptyCart = (lastItems.length === 0);
    const canRestore = emptyCart && hasUndo();
    if (canRestore){
      btnClear.textContent = 'Restaurer les produits';
      btnClear.setAttribute('aria-label','Restaurer les produits');
      btnClear.classList.add('is-undo');
      btnClear.disabled = false;
    }else{
      btnClear.textContent = 'Tout supprimer';
      btnClear.setAttribute('aria-label','Tout supprimer');
      btnClear.classList.remove('is-undo');
      btnClear.disabled = (lastItems.length === 0 && !hasUndo());
    }
  }

  if (btnClear){
    btnClear.addEventListener('click', ()=>{
      const empty = (lastItems.length === 0);
      if (empty){ restoreUndo(); }
      else{
        addAllToUndo(lastItems);
        lastItems.forEach(x => GFT.api.setQty(x.id, 0));
        GFT.api.emitCartUpdated();
        updateClearUI();
      }
    });
  }

  // ---------- Jump to product from sheet ----------
  function gotoProduct(pid){
    const card = document.querySelector(`.gft-card[data-id="${pid}"]`);
    if(!card) return;

    const det = card.closest('details.gft-cat'); if (det && !det.open) det.open = true;

    const row = card.closest('.gft-cards');
    if(row){
      const left = Math.max(0, card.offsetLeft - (row.clientWidth/2 - card.clientWidth/2));
      row.scrollTo({ left, behavior:'smooth' });
    }
    card.classList.add('gft-card--highlight');
    setTimeout(()=>card.classList.remove('gft-card--highlight'), 1600);
    card.scrollIntoView({ block:'nearest', inline:'nearest', behavior:'smooth' });

    close();
  }

  // ---------- Render (only "Modifier" button; NO per-item delete) ----------
  document.addEventListener('gft:cart-updated', ({detail:{total,items}})=>{
    lastItems = items || [];
    totalEl.textContent = GFT.api.fmt(total);
    go.disabled = total < GFT.config.MIN_ORDER_PRICE;

    list.innerHTML = (lastItems.length)
      ? lastItems.map(x=>`
          <div class="row" data-pid="${x.id||''}">
            <div class="th"><img src="${x.image}" alt="${x.name}"></div>
            <div class="main">
              <div class="nm">${x.name}</div>
              <div class="mt">Qty: <strong>${x.qty}</strong> · Unit: <strong>${GFT.api.fmt(x.unit)}</strong></div>
            </div>
            <div class="ln">${GFT.api.fmt(x.total)}</div>
            <div class="act">
              <button class="btn btn-edit" type="button" aria-label="Modifier">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
                <span>Modifier</span>
              </button>
            </div>
          </div>
        `).join('')
      : '<div class="mt">Votre panier est vide.</div>';

    updateClearUI();
  });

  // delegate clicks for "Modifier"
  list.addEventListener('click', (e)=>{
    const row = e.target.closest('.row'); if(!row) return;
    const pid = row.getAttribute('data-pid'); if(!pid) return;
    if (e.target.closest('.btn-edit')){ gotoProduct(pid); }
  });

  // place order
  go.addEventListener('click', ()=>GFT.api.placeOrder());
})();


/* --- MODAL GALLERY (no extra JS) ------------------------------------------ */
(function(){
  const modal    = document.getElementById('gftModal');
  const imgEl    = document.getElementById('gftGalImg');
  const descEl   = document.getElementById('gftModalDesc');
  const prevBtn  = document.getElementById('gftGalPrev');
  const nextBtn  = document.getElementById('gftGalNext');
  const closeBtn = modal.querySelector('.gft-modalClose');

  let images = [];
  let i = 0;

  function open(payload){
    images = (payload && payload.images && payload.images.length) ? payload.images : [];
    i = 0;

    imgEl.src = images[0] || '';
    // Keep it simple: plain text string; CSS will preserve line breaks.
    descEl.textContent = (payload && payload.desc) ? payload.desc : '';

    modal.classList.add('on');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gft-modal-open');
  }

  function close(){
    modal.classList.remove('on');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gft-modal-open');
  }

  function step(delta){
    if (!images.length) return;
    i = (i + delta + images.length) % images.length;
    imgEl.src = images[i];
  }

  // External open trigger
  document.addEventListener('gft:open-modal', (e)=>open(e.detail));

  // Local controls
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e)=>{ if (e.target === modal) close(); });
  prevBtn.addEventListener('click', ()=>step(-1));
  nextBtn.addEventListener('click', ()=>step(1));
})();


/* --- Warning Tip ----------------------------------------------------------- */
(function(){
  const tip = document.getElementById('gftWarn'); let t=null;
  function show(msg){
    tip.textContent = msg || tip.textContent;
    tip.classList.add('on');
    clearTimeout(t); t=setTimeout(()=>tip.classList.remove('on'), 3000);
  }
  document.addEventListener('gft:warn', (e)=>show(e.detail));
})();

/* ==== PERF: cheap listeners ==== */
(function(){
  try{
    window.addEventListener('touchstart', ()=>{}, {passive:true});
    window.addEventListener('wheel',      ()=>{}, {passive:true});
  }catch(_){}

  const throttle = (fn, wait=150)=>{
    let t = 0;
    return (...a)=>{
      const n = Date.now();
      if (n - t > wait){ t = n; fn(...a); }
    };
  };

  window.addEventListener('resize', throttle(()=>{
    // if you had resize code, put it here or call your function here
  }, 200));
})();
