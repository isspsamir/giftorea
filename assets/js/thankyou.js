
/* ===========================================================
   Giftorea — Thank-You Page (email-only changes)
   - Email lists ONLY selected products (qty>0 & total>0)
   - Styled email (gradient header + table)
   - Auto-shrinks to stay under EmailJS 50KB cap
   - No PDF attached to EmailJS
   =========================================================== */

/* libs */
window.jsPDF = window.jspdf.jsPDF;
try { emailjs.init("AUKVraZwu5iufPOe7"); } catch (_){}

/* Brand / contacts */
const BRAND_NAME   = "Giftorea B2B";
const CONTACT_EMAIL= "contact@giftoreab2b.com";
const CONTACT_PHONE= "+213550100706";

/* Colors for PDF */
const NAVY=[11,42,74], SLATE=[71,85,105], BORDER=[222,226,236];

/* Utils */
function fmtDZD(n){ return `${Number(n||0).toLocaleString('en-US')} DZD`; }
function formatDate(d){ return d.toLocaleDateString('fr-FR',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }
function esc(s){ if(s==null) return ""; return String(s).replace(/[&<>"]/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m])); }

/* EmailJS config */
const EMAILJS_PUBLIC_KEY = "AUKVraZwu5iufPOe7";
const EMAILJS_SERVICE_ID = "service_chey66l";
const EMAILJS_TEMPLATE_ID = "template_fuau9gh";

/* ensure EmailJS available */
async function ensureEmailJSReady(){
  if(window.emailjs && typeof emailjs.send === 'function'){ return true; }
  try{
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js";
      s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
    });
    emailjs.init(EMAILJS_PUBLIC_KEY);
    return true;
  } catch(err){
    console.error('EmailJS load/init failed:', err);
    return false;
  }
}

/* Wilaya map */
const WILAYA_MAP={"01":"Adrar","02":"Chlef","03":"Laghouat","04":"Oum El Bouaghi","05":"Batna","06":"Béjaïa","07":"Biskra","08":"Béchar","09":"Blida","10":"Bouira","11":"Tamanrasset","12":"Tébessa","13":"Tlemcen","14":"Tiaret","15":"Tizi Ouzou","16":"Alger","17":"Djelfa","18":"Jijel","19":"Sétif","20":"Saïda","21":"Skikda","22":"Sidi Bel Abbès","23":"Annaba","24":"Guelma","25":"Constantine","26":"Médéa","27":"Mostaganem","28":"M'Sila","29":"Mascara","30":"Ouargla","31":"Oran","32":"El Bayadh","33":"Illizi","34":"Bordj Bou Arréridj","35":"Boumerdès","36":"El Tarf","37":"Tindouf","38":"Tissemsilt","39":"El Oued","40":"Khenchela","41":"Souk Ahras","42":"Tipaza","43":"Mila","44":"Aïn Defla","45":"Naâma","46":"Aïn Témouchent","47":"Ghardaïa","48":"Relizane","49":"Timimoun","50":"Bordj Badji Mokhtar","51":"Ouled Djellal","52":"Béni Abbès","53":"In Salah","54":"In Guezzam","55":"Touggourt","56":"Djanet","57":"El M'Ghair","58":"El Meniaa"};
function resolveWilaya(state){ if(!state) return ""; const s=String(state).trim(); const m=s.match(/(\d{2})/); if(m&&WILAYA_MAP[m[1]]) return WILAYA_MAP[m[1]]; const pad=s.padStart(2,"0"); return WILAYA_MAP[pad]||s; }

/* busy overlay */
(function injectBusyCss(){
  const css = `
  #gft-busy{position:fixed;inset:0;display:none;align-items:center;justify-content:center;
    background:rgba(255,255,255,.78);backdrop-filter:blur(8px);z-index:99999;
    font:700 15px system-ui,-apple-system,Segoe UI,Roboto;color:#0B2A4A;letter-spacing:.2px}
  #gft-busy .spinner{width:14px;height:14px;border-radius:50%;
    border:2px solid rgba(11,42,74,.25);border-top-color:#0B2A4A;margin-left:10px;display:inline-block;animation:gftspin .8s linear infinite}
  @keyframes gftspin{to{transform:rotate(360deg)}}`;
  const s=document.createElement('style'); s.textContent=css; document.head.appendChild(s);
})();
function showBusy(msg){
  let el=document.getElementById('gft-busy');
  if(!el){ el=document.createElement('div'); el.id='gft-busy'; document.body.appendChild(el); }
  el.innerHTML = `<span>${esc(msg||"Préparation de votre facture…")}</span><span class="spinner"></span>`;
  el.style.display='flex';
}
function hideBusy(){ const el=document.getElementById('gft-busy'); if(el) el.style.display='none'; }

/* WP save */
async function getOrderToken(){ try{ const r=await fetch('/wp-json/gft/v1/order-token',{method:'GET',credentials:'same-origin'}); const j=await r.json(); return (j&&j.ok)?j.token:null; }catch{ return null; } }
async function saveOrderToWP(orderData){
  try{
    const token=await getOrderToken(); const headers={'Content-Type':'application/json'}; if(token) headers['X-GFT-ORDER-TOKEN']=token;
    const r=await fetch('/wp-json/gft/v1/order',{method:'POST',credentials:'same-origin',headers,body:JSON.stringify(orderData)});
    const j=await r.json(); return (j&&j.ok&&j.public_id)?j.public_id:null;
  }catch{ return null; }
}

/* Upload to WP Media */
async function getJwtToken(){
  try{
    const r = await fetch('/wp-json/gft/v1/token', { credentials:'include' });
    if (r.ok){ const j = await r.json(); return j?.token || j?.jwt || null; }
  }catch(e){}
  return null;
}
// Uses your existing getJwtToken() and getOrderToken() helpers.
// Uploads to our private invoices endpoint and returns a 7-day signed URL.
async function uploadInvoiceToWP(pdfBlob, filename, orderId){
  try{
    // Try JWT first, fall back to your order token if needed
    const jwt = await getJwtToken().catch(()=>null);
    const orderTok = jwt ? null : await getOrderToken().catch(()=>null);

    const fd = new FormData();
    fd.append('pdf', pdfBlob, filename || 'Facture-Giftorea.pdf');
    if (orderId) fd.append('order_id', String(orderId));

    const headers = {};
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
    else if (orderTok) headers['X-GFT-ORDER-TOKEN'] = orderTok;

    const res = await fetch('/wp-json/gft/v1/invoices/upload', {
      method: 'POST',
      headers,
      body: fd,
      credentials: 'same-origin'
    });

    if (!res.ok) {
      console.warn('WP upload HTTP error:', res.status, await res.text().catch(()=>'')); 
      return null;
    }
    const j = await res.json();
    // { ok:true, id:123, url:".../serve?id=...&exp=...&sig=...", expires_at:... }
    if (j && j.ok && j.url) return j.url;
    return null;
  }catch(err){
    console.error('WP upload failed:', err);
    return null;
  }
}


/* Fallback upload to your server */
const API_UPLOAD_URL = '/api/upload-invoice.php';
const API_UPLOAD_KEY = 'YOUR_SUPER_SECRET';
async function uploadInvoiceToServer(pdfBlob, filename, orderId){
  try{
    const fd = new FormData();
    fd.append('pdf', pdfBlob, filename);
    fd.append('order_id', orderId||'');
    const r = await fetch(API_UPLOAD_URL, {
      method:'POST',
      headers:{ 'X-API-KEY': API_UPLOAD_KEY },
      body: fd,
      credentials:'same-origin'
    });
    const j = await r.json();
    if (!j.ok) return null;
    return j.url || null;
  }catch(e){ return null; }
}

/* ---------- EMAIL: helpers to keep payload under 50KB ---------- */
function byteLen(str){ try{ return new TextEncoder().encode(String(str||"")).length; }catch(_){ return (String(str||"")||"").length; } }

/* Styled, compact HTML that ONLY includes selected items */
function buildEmailMessage(orderData, invoiceNumber, invoiceUrl){
  const c  = orderData?.customerInfo || {};
  const od = orderData?.orderDetails  || {};
  const customization = orderData?.customization || (function(){ try{ return JSON.parse(localStorage.getItem('customization')||'{}'); }catch(_){ return {}; } })();

  // Pretty labels
  const styleLabel = (customization.designStyle||'modern').replace(/^\w/,m=>m.toUpperCase());
  const calLabel   = customization.calendarType==='miladi'?'Miladi seulement':'Hijri + Miladi';
  const langLabel  = ({ar:'العربية',fr:'Français',en:'English'})[customization.language] || '—';
  const packLabel  = customization.designPackage==='premium' ? 'Premium (+3500 DZD)' : 'Standard (inclus)';
  const logoLabel  = customization?.logo?.option==='redesign_2000' ? 'Redessiner le logo (+2000 DZD)'
                    : (customization?.logo?.option==='have_ai' ? 'AI/SVG fourni' : '—');
  const invLabel   = customization.invoiceType==='standard' ? 'Facture standard (+10%)'
                    : (customization.invoiceType==='mokawil' ? 'Mokawil Dati (+0.5%)' : 'Sans facture (0%)');

  // Filter ONLY selected products (qty>0 and total>0)
  const selected = (od.products||[]).map(p=>{
    const q = Number(p.quantity ?? p.qty ?? 0);
    const price = Number(p.price||0);
    const total = (p.totalPrice!=null) ? Number(p.totalPrice) : (price*q);
    return { name:(p.name||'').toString(), q, price, total };
  }).filter(row => row.q > 0 && row.total > 0);

  // Base subtotal and totals (reuse your computeTotals if present)
  const baseSubtotal = selected.reduce((a,r)=>a + (r.total||0), 0);
  let premiumFee=0, logoFee=0, rate=0, taxAmount=0, grandTotal=baseSubtotal;
  try{
    const t = computeTotals(orderData || {}, baseSubtotal);
    premiumFee = t.premiumFee||0; logoFee=t.logoFee||0; rate=t.rate||0; taxAmount=t.taxAmount||0; grandTotal=t.grandTotal||baseSubtotal;
  }catch(_){ /* if computeTotals not available here, continue with baseSubtotal */ }

  // Build rows with cap; shrink if needed to stay < 45KB total
  let max = Math.min(30, selected.length);
  let html = make(max);
  while (byteLen(html) > 45000 && max > 5) { max = Math.floor(max*0.7); html = make(max); }
  if (byteLen(html) > 45000) html = make(0);

  return html;

  function make(limit){
    const rows = (limit? selected.slice(0,limit):[]).map(r=>`
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #EEF2FF">${esc(r.name.slice(0,120))}</td>
        <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #EEF2FF">${r.q}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #EEF2FF">${Number(r.price||0).toLocaleString('en-US')} DZD</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #EEF2FF;font-weight:700">${Number(r.total||0).toLocaleString('en-US')} DZD</td>
      </tr>`).join('');

    const more = (limit && selected.length>limit) ? 
      `<tr><td colspan="4" style="padding:10px 12px;text-align:center;color:#475569;border-bottom:1px solid #EEF2FF">… et ${selected.length-limit} articles de plus</td></tr>` : '';

    const summary = `
      <tr><td colspan="3" style="padding:10px 12px;text-align:right;color:#334155">Sous-total</td><td style="padding:10px 12px;text-align:right;font-weight:700">${baseSubtotal.toLocaleString('en-US')} DZD</td></tr>
      ${premiumFee>0?`<tr><td colspan="3" style="padding:6px 12px;text-align:right;color:#334155">Design premium</td><td style="padding:6px 12px;text-align:right;font-weight:700">${premiumFee.toLocaleString('en-US')} DZD</td></tr>`:''}
      ${logoFee>0?`<tr><td colspan="3" style="padding:6px 12px;text-align:right;color:#334155">Redesign logo</td><td style="padding:6px 12px;text-align:right;font-weight:700">${logoFee.toLocaleString('en-US')} DZD</td></tr>`:''}
      ${rate>0?`<tr><td colspan="3" style="padding:6px 12px;text-align:right;color:#334155">Majoration (${(rate*100).toFixed(1).replace('.0','')}%)</td><td style="padding:6px 12px;text-align:right;font-weight:700">${taxAmount.toLocaleString('en-US')} DZD</td></tr>`:''}
      <tr><td colspan="3" style="padding:12px 12px;text-align:right;color:#0B2A4A;font-weight:800;border-top:1px solid #E2E8F0">Total</td><td style="padding:12px 12px;text-align:right;font-weight:800;color:#0B2A4A;border-top:1px solid #E2E8F0">${grandTotal.toLocaleString('en-US')} DZD</td></tr>`;

    return `
      <div style="max-width:760px;margin:0 auto;background:#F8FAFF;border:1px solid #E6ECFF;border-radius:18px;overflow:hidden">
        <div style="background:linear-gradient(180deg,#EDE9FE, #E0E7FF);padding:16px 18px">
          <div style="font:800 18px/1.2 ui-sans-serif;color:#0B2A4A">Nouvelle commande reçue — Giftorea B2B</div>
          <div style="font:500 12px ui-sans-serif;color:#334155;opacity:.9;margin-top:2px">Notification interne. Merci d'appeler le client pour confirmer.</div>
        </div>

        <div style="padding:16px">
          <div style="border:1px solid #E6ECFF;background:#FFFFFF;border-radius:14px;padding:12px 14px">
            <div style="font:800 13px ui-sans-serif;color:#0B2A4A;margin-bottom:8px">Informations client</div>
            <table role="presentation" style="width:100%;border-collapse:collapse;font:400 13px ui-sans-serif;color:#334155">
              <tr>
                <td style="padding:4px 6px"><strong>Entreprise</strong></td><td style="padding:4px 6px">${esc(c.company||'-')}</td>
                <td style="padding:4px 6px"><strong>Nom</strong></td><td style="padding:4px 6px">${esc(c.name||'-')}</td>
              </tr>
              <tr>
                <td style="padding:4px 6px"><strong>Téléphone</strong></td><td style="padding:4px 6px">${esc(c.phone||'-')}</td>
                <td style="padding:4px 6px"><strong>Email</strong></td><td style="padding:4px 6px">${esc(c.email||'-')}</td>
              </tr>
              <tr>
                <td style="padding:4px 6px"><strong>Wilaya</strong></td><td style="padding:4px 6px">${esc(resolveWilaya(c.state)||'-')}</td>
                <td style="padding:4px 6px"><strong>Réf</strong></td><td style="padding:4px 6px">#${esc(invoiceNumber||'')}</td>
              </tr>
            </table>
          </div>

          <div style="margin-top:12px;border:1px solid #E6ECFF;background:#FFFFFF;border-radius:14px;padding:12px 14px">
            <div style="font:800 13px ui-sans-serif;color:#0B2A4A;margin-bottom:6px">Choix du client</div>
            <div style="font:400 13px ui-sans-serif;color:#334155">
              Style: ${esc(styleLabel)} · Calendrier: ${esc(calLabel)} · Langue: ${esc(langLabel)} ·
              Design: ${esc(packLabel)} · Logo: ${esc(logoLabel)} · Facturation: ${esc(invLabel)}
            </div>
          </div>

          <div style="margin-top:12px;border:1px solid #E6ECFF;background:#FFFFFF;border-radius:14px;overflow:hidden">
            <table style="width:100%;border-collapse:collapse;font:400 13px ui-sans-serif;color:#0B2A4A">
              <thead>
                <tr style="background:#EEF2FF">
                  <th style="text-align:left;padding:10px 12px">ARTICLE</th>
                  <th style="text-align:center;padding:10px 12px">QTT</th>
                  <th style="text-align:right;padding:10px 12px">PRIX</th>
                  <th style="text-align:right;padding:10px 12px">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `<tr><td colspan="4" style="padding:12px;text-align:center;color:#64748B">Aucun article sélectionné</td></tr>`}
                ${more}
                ${summary}
              </tbody>
            </table>
          </div>

          ${invoiceUrl ? `<div style="margin-top:12px"><a href="${esc(invoiceUrl)}" target="_blank" style="display:inline-block;background:#0B2A4A;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font:700 13px ui-sans-serif">Ouvrir la facture (PDF)</a></div>` : ''}

          <div style="margin-top:12px;text-align:right">
            <a href="tel:${esc(c.phone||'')}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font:600 13px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial">Appeler le client</a>
          </div>
        </div>
      </div>`;
  }
}

/* ========== Email sender (no attachment; compact message only) ========== */
async function sendOrderEmail(orderData, invoiceNumber=null, _pdfBase64_unused=null, invoiceUrl=null){
  try{
    const ready = await ensureEmailJSReady();
    if(!ready) throw new Error('EmailJS not ready');

    const c = orderData?.customerInfo || {};
    const message = buildEmailMessage(orderData, invoiceNumber, invoiceUrl);

    const params = {
      to_name: c.company || '',
      from_name: 'Giftorea B2B',
      invoice_number: invoiceNumber || '',
      invoice_url: invoiceUrl || '',
      message // keep template simple: render {{message}} only
    };

    // Safety against 50KB cap
    const approxSize = byteLen(JSON.stringify(params));
    if (approxSize > 50000) {
      console.warn('EmailJS vars near/over limit; switching to minimal body. Size=', approxSize);
      params.message = `Commande #${invoiceNumber||''}\nEntreprise: ${c.company||'-'}\nTéléphone: ${c.phone||'-'}\nEmail: ${c.email||'-'}${invoiceUrl?`\nPDF: ${invoiceUrl}`:''}`;
      delete params.invoice_url;
    }

    const res = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
    console.log('Email sent (no attachment):', res && res.status);

    const st = document.getElementById('invoice-status');
    if(st) st.textContent = 'Facture envoyée par email ✔';
  }catch(err){
    console.error('Email sending error:', err);
    const st = document.getElementById('invoice-status');
    if(st) st.textContent = 'Échec d’envoi email (voir console).';
  }
}

/* --------------------- Everything below unchanged --------------------- */

/* id fallback */
function localDailyId(){
  try{
    const tz='Africa/Algiers';
    const parts=new Intl.DateTimeFormat('fr-FR',{timeZone:tz,day:'2-digit',month:'2-digit',year:'2-digit'}).formatToParts(new Date());
    const d=parts.find(p=>p.type==='day').value, m=parts.find(p=>p.type==='month').value, y=parts.find(p=>p.type==='year').value;
    const key=`gft_daily_${d}${m}${y}`; const n=(+localStorage.getItem(key)||0)+1; localStorage.setItem(key,String(n));
    return `${d}${m}${y}-${String(n).padStart(2,'0')}`;
  }catch{
    const t=new Date(); return `${String(t.getDate()).padStart(2,'0')}${String(t.getMonth()+1).padStart(2,'0')}${String(t.getFullYear()).slice(-2)}-01`;
  }
}

/* logo preload */
async function preloadLogo(){
  const imgEl=document.getElementById('brandLogo'); const src=imgEl?.src; if(!src) return null;
  return new Promise(resolve=>{
    const img=new Image(); img.crossOrigin="anonymous";
    img.onload=()=>{ try{ const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; c.getContext('2d').drawImage(img,0,0); resolve(c.toDataURL('image/png')); }catch{ resolve(null); } };
    img.onerror=()=>resolve(null); img.src=src;
  });
}

/* icons for PDF */
function drawIcon(doc,name,x,y,s=4,color=NAVY){
  doc.setDrawColor(...color); doc.setLineWidth(0.3);
  switch(name){
    case'user': doc.circle(x+s*.5,y+s*.38,s*.22,'S'); doc.line(x+s*.15,y+s*.9,x+s*.85,y+s*.9); break;
    case'phone': doc.circle(x+s*.28,y+s*.6,s*.18,'S'); doc.circle(x+s*.72,y+s*.4,s*.18,'S'); doc.line(x+s*.35,y+s*.55,x+s*.65,y+s*.45); break;
    case'mail': doc.rect(x,y,s,s*.75,'S'); doc.line(x,y,x+s*.5,y+s*.38); doc.line(x+s,y,x+s*.5,y+s*.38); break;
    case'map': doc.circle(x+s*.5,y+s*.45,s*.22,'S'); doc.line(x+s*.5,y+s*.62,x+s*.5,y+s*.98); break;
    case'palette': doc.circle(x+s*.5,y+s*.55,s*.46,'S'); doc.circle(x+s*.3,y+s*.5,s*.08,'S'); doc.circle(x+s*.5,y+s*.35,s*.08,'S'); doc.circle(x+s*.7,y+s*.5,s*.08,'S'); break;
    case'calendar': doc.rect(x,y+s*.2,s,s*.75,'S'); doc.line(x,y+s*.45,x+s,y+s*.45); doc.line(x+s*.22,y,x+s*.22,y+s*.2); doc.line(x+s*.78,y,x+s*.78,y+s*.2); break;
    case'globe': doc.circle(x+s*.5,y+s*.5,s*.48,'S'); doc.ellipse(x+s*.5,y+s*.5,s*.3,s*.48,'S'); doc.line(x+s*.1,y+s*.5,x+s*.9,y+s*.5); break;
    case'star': doc.line(x,y+s*.5,x+s,y+s*.5); doc.line(x+s*.5,y,x+s*.5,y+s); break;
    case'receipt': doc.rect(x,y,s,s*.9,'S'); doc.line(x+s*.2,y+s*.35,x+s*.8,y+s*.35); doc.line(x+s*.2,y+s*.55,x+s*.8,y+s*.55); break;
  }
}

/* products + totals (includes logo fee) */
function sumProducts(products){
  return (products||[]).reduce((a,p)=>{
    const q = Number(p.quantity ?? p.qty ?? 0);
    const price = Number(p.price||0);
    const total = (p.totalPrice!=null)?Number(p.totalPrice):(price*q);
    return a + (Number.isFinite(total)?total:0);
  },0);
}
function getOrderDataWithFallback(){
  const cod = JSON.parse(localStorage.getItem('completeOrderData')||'null') || {};
  if(!cod.orderDetails){ cod.orderDetails = {}; }
  let products = Array.isArray(cod.orderDetails.products) ? cod.orderDetails.products : [];
  if(!products.length){
    const pd = JSON.parse(localStorage.getItem('productData')||'null');
    if(pd?.products?.length){
      products = pd.products;
      cod.orderDetails.products = products;
      cod.orderDetails.globalTotal = Number(pd.globalTotal || sumProducts(products));
    }
  }
  let baseSubtotal = Number(cod.orderDetails.globalTotal || 0);
  if(!baseSubtotal){ baseSubtotal = sumProducts(products); cod.orderDetails.globalTotal = baseSubtotal; }
  localStorage.setItem('completeOrderData', JSON.stringify(cod));
  return { cod, products, baseSubtotal };
}
function computeTotals(cod, baseSubtotal){
  const customization = cod.customization || JSON.parse(localStorage.getItem('customization')||'{}');
  const designPackage = customization.designPackage || 'standard';
  const invoiceType   = customization.invoiceType || 'no-invoice';
  const premiumFee = (designPackage === 'premium') ? 3500 : 0;
  const logoFee    = (customization && customization.logo && customization.logo.option === 'redesign_2000') ? 2000 : 0;
  const rate = (invoiceType === 'standard') ? 0.10 : (invoiceType === 'mokawil' ? 0.005 : 0);
  const taxAmount = Math.round((baseSubtotal + premiumFee + logoFee) * rate);
  const grandTotal = baseSubtotal + premiumFee + logoFee + taxAmount;
  return { customization, premiumFee, logoFee, rate, taxAmount, grandTotal };
}

/* --------- PDF generation (unchanged) --------- */
async function generateInvoice(invoiceNumber){
  showBusy('Génération de la facture…');

  const { cod, products, baseSubtotal } = getOrderDataWithFallback();
  const c = cod.customerInfo || {};
  const { customization, premiumFee, logoFee, rate, taxAmount, grandTotal } = computeTotals(cod, baseSubtotal);

  const styleLabel=(customization.designStyle||'modern').replace(/^\w/,m=>m.toUpperCase());
  const calLabel=customization.calendarType==='miladi'?'Miladi uniquement':'Hijri/Miladi';
  const langLabel=({ar:'Arabe',fr:'Français',en:'Anglais'})[customization.language]||'—';
  const packLabel=customization.designPackage==='premium'?'Premium (+3 500 DZD) — création sur mesure':'Standard (modèle optimisé)';
  const invLabel =customization.invoiceType==='standard'?'Facture standard — 10%':(customization.invoiceType==='mokawil'?'Mokawil Dati — 0,5%':'Sans facture — 0%');

  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
  doc.setFont('helvetica');
  const pageW=210, pageH=297, M={left:16,right:16,top:22,bottom:18};
  const logo = await preloadLogo();

  function header(){
    if(logo){ try{ const h=14, w=h*4.5; doc.addImage(logo,'PNG',M.left,M.top-6,w,h); }catch{} }
    doc.setTextColor(...NAVY); doc.setFont('helvetica','bold'); doc.setFontSize(18);
    if(!logo) doc.text(BRAND_NAME, M.left, M.top);
    doc.setFontSize(14); doc.text('Facture', pageW/2, M.top, {align:'center'});
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(...SLATE);
    doc.text(`N°: ${invoiceNumber}`, pageW-M.right, M.top-3, {align:'right'});
    doc.text(`Date: ${formatDate(new Date())}`, pageW-M.right, M.top+2, {align:'right'});
  }
  function footer(page,total){
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...SLATE);
    const y = pageH-10;
    doc.text(BRAND_NAME, pageW/2, y-4, {align:'center'});
    const mailX = pageW/2 - (doc.getTextWidth(CONTACT_EMAIL)+doc.getTextWidth(CONTACT_PHONE)+26)/2 + 10;
    drawIcon(doc,'mail',mailX-8,y-8,4,NAVY); doc.text(CONTACT_EMAIL, mailX, y, {align:'left'});
    const phoneX = mailX + doc.getTextWidth(CONTACT_EMAIL) + 16;
    drawIcon(doc,'phone',phoneX-8,y-8,4,NAVY); doc.text(CONTACT_PHONE, phoneX, y, {align:'left'});
    doc.text(`Page ${page} / ${total}`, pageW/2, y+4, {align:'center'});
  }

  function clientCard(y){
    const w=pageW-M.left-M.right, h=28;
    doc.setDrawColor(...BORDER); doc.roundedRect(M.left,y,w,h,2,2,'S');
    const col = w/2;
    doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY); doc.setFontSize(10);
    drawIcon(doc,'user',M.left+4,y+3.8,4,NAVY); doc.text('Informations client', M.left+12, y+7.8);

    doc.setFont('helvetica','normal'); doc.setTextColor(...SLATE);
    let x1 = M.left+12, yy = y+13;
    doc.text(`Société : ${esc(c.company||'')}`,x1,yy); yy+=5;
    drawIcon(doc,'phone',x1-8,yy-4.3,4,NAVY); doc.text(`${esc(c.phone||'')}`,x1,yy); yy+=5;
    doc.text(`Adresse : ${esc(c.city||'')}`,x1,yy);

    let x2 = M.left+col+12, y2 = y+13;
    drawIcon(doc,'mail',x2-8,y2-4.3,4,NAVY); doc.text(`Email : ${esc(c.email||'')}`,x2,y2); y2+=5;
    drawIcon(doc,'map',x2-8,y2-4.3,4,NAVY); const wil=resolveWilaya(c.state); doc.text(`Wilaya : ${esc(wil)}`,x2,y2);
    return y+h+6;
  }

  function optionsCard(y){
    const w=pageW-M.left-M.right, h=34;
    doc.setDrawColor(...BORDER); doc.roundedRect(M.left,y,w,h,2,2,'S');
    doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY); doc.setFontSize(10);
    drawIcon(doc,'star',M.left+4,y+3.8,4,NAVY); doc.text('Choix', M.left+12, y+7.8);

    const leftX=M.left+12, rightX=M.left+w/2+12; let a=y+13,b=y+13;

    doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
    drawIcon(doc,'palette',leftX-8,a-4.3,4,NAVY); doc.text('Style :',leftX,a);
    doc.setFont('helvetica','normal'); doc.setTextColor(...SLATE); doc.text(styleLabel,leftX+16,a);
    a+=7;

    doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
    drawIcon(doc,'calendar',leftX-8,a-4.3,4,NAVY); doc.text('Calendrier :',leftX,a);
    doc.setFont('helvetica','normal'); doc.setTextColor(...SLATE); doc.text(calLabel,leftX+26,a);

    doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
    drawIcon(doc,'globe',rightX-8,b-4.3,4,NAVY); doc.text('Langue :',rightX,b);
    doc.setFont('helvetica','normal'); doc.setTextColor(...SLATE); doc.text(langLabel,rightX+16,b);
    b+=7;

    doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
    drawIcon(doc,'star',rightX-8,b-4.3,4,NAVY); doc.text('Design :',rightX,b);
    doc.setFont('helvetica','normal'); doc.setTextColor(...SLATE); doc.text(packLabel,rightX+16,b);

    const fy=y+h-6;
    doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
    drawIcon(doc,'receipt',M.left+4,fy-4.3,4,NAVY); doc.text('Facturation :',M.left+12,fy);
    doc.setFont('helvetica','normal'); doc.setTextColor(...SLATE); doc.text(invLabel,M.left+34,fy);
    return y+h+8;
  }

  header();
  let cursorY = M.top+10;
  cursorY = clientCard(cursorY);
  cursorY = optionsCard(cursorY);

  doc.setFont('helvetica','normal'); doc.setTextColor(120); doc.setFontSize(9);
  doc.text("Notice : ce document récapitule votre commande et sert de preuve de dépôt (TVA non applicable).", M.left, cursorY);
  cursorY += 5;

  const head=[['Article','Prix','QTT','Total']];
  const body=(products||[]).filter(p=>Number(p.quantity ?? p.qty)>0).map(p=>{
    const q=Number(p.quantity ?? p.qty ?? 0), price=Number(p.price||0);
    const total=Number(p.totalPrice!=null?p.totalPrice:price*q);
    return [ (p.name||''), fmtDZD(price), String(q), fmtDZD(total) ];
  });
  const startY=Math.max(cursorY+2, M.top+44);
  try{
    doc.autoTable({
      head, body, startY,
      margin:{left:M.left,right:M.right},
      theme:'grid',
      styles:{font:'helvetica',fontSize:10,cellPadding:2.6,textColor:[15,23,42],lineColor:BORDER,lineWidth:0.2},
      headStyles:{fillColor:[238,242,255],textColor:[23,37,84],lineColor:BORDER,lineWidth:0.2,fontStyle:'bold'},
      alternateRowStyles:{fillColor:[250,250,253]}
    });
  }catch(e){ console.error('autoTable failed, continuing:', e); }

  let tableBottom = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : startY+10;
  const needNewPage = tableBottom + 40 > pageH - M.bottom;
  if(needNewPage){ doc.addPage(); header(); tableBottom = M.top + 14; }
  const boxW=96, boxH=40, boxX=pageW - M.right - boxW, boxY=tableBottom + 8;
  doc.setDrawColor(...BORDER); doc.setFillColor(255,255,255); doc.roundedRect(boxX,boxY,boxW,boxH,2,2,'S');
  doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY); doc.setFontSize(10); doc.text('Résumé des frais', boxX+4, boxY+6);
  let ry=boxY+12, L=boxX+4, R=boxX+boxW-4;
  function row(lbl,val,bold){ doc.setFont('helvetica', bold?'bold':'normal'); doc.setTextColor(...(bold?NAVY:SLATE)); doc.text(lbl,L,ry); doc.text(val,R,ry,{align:'right'}); ry+=5.2; }
  const t2 = computeTotals(cod, baseSubtotal);
  const pct = (Math.round((t2.rate*100)*10)/10).toString().replace('.0','');
  const designRowLabel = t2.premiumFee>0 ? 'Option design premium :' : 'Design standard (gratuit) :';
  row('Sous-total produits :', fmtDZD(baseSubtotal), false);
  row(designRowLabel, fmtDZD(t2.premiumFee), false);
  if (t2.logoFee > 0) row('Frais de redesign du logo :', fmtDZD(t2.logoFee), false);
  row(`Frais de facturation (${pct}%) :`, fmtDZD(t2.taxAmount), false);
  doc.setDrawColor(...BORDER); doc.line(L, ry-3.2, R, ry-3.2);
  row('Total général :', fmtDZD(t2.grandTotal), true);

  // left notice near totals
  const BOTTOM_NOTICE = "Notice: text will be here";
  const noticeY = Math.min(tableBottom + 7, pageH - M.bottom - 4);
  doc.setTextColor(90); doc.setFontSize(9);
  doc.text(BOTTOM_NOTICE, M.left, noticeY, { align:'left', maxWidth: (pageW/2) - M.left });
  doc.setTextColor(0);

  const totalPages = doc.getNumberOfPages();
  for(let i=1;i<=totalPages;i++){ doc.setPage(i); footer(i,totalPages); }

  const filename = 'Facture-Giftorea-B2B.pdf';
  const pdfBlob  = doc.output('blob');
  let invoiceUrl = null;
  try { invoiceUrl = await uploadInvoiceToWP(pdfBlob, filename); } catch(_){}
  if (!invoiceUrl) {
    try { invoiceUrl = await uploadInvoiceToServer(pdfBlob, filename, invoiceNumber); } catch(_){}
  }
  doc.save(filename);

  // Email (no attachment)
  await sendOrderEmail(cod, invoiceNumber, null, invoiceUrl);

  hideBusy();
}

/* bootstrap */
function handleOrderSource(){
  const data = JSON.parse(localStorage.getItem('completeOrderData'));
  if(!data || !data.source) return null;
  const downloads=document.querySelector('.download-section');
  if(data.source==='ready-pack' && downloads){ downloads.style.display='none'; }
  return data;
}
window.addEventListener('load', async ()=>{
  showBusy('Préparation de votre commande…');
  try{
    const orderData = handleOrderSource();
    if(!orderData){
      // No order in localStorage — nothing to do
      return;
    }

    // Don’t let the WP save hang forever; fall back to local ID after 3s
    const maybeId = await Promise.race([
      saveOrderToWP(orderData),
      new Promise(resolve => setTimeout(()=>resolve(null), 3000))
    ]);
    const serverId = maybeId || localDailyId();

    // ✅ Fix the typo here (use refEl only)
    const refEl = document.getElementById('order-number');
    if (refEl) refEl.textContent = '#'+serverId;

    // Continue normally
    await generateInvoice(serverId);
  } catch (err){
    console.error('Init error:', err);
    // Fail-safe fallback: still generate a local invoice so the user isn’t stuck
    const fallbackId = localDailyId();
    const refEl = document.getElementById('order-number');
    if (refEl) refEl.textContent = '#'+fallbackId;
    try { await generateInvoice(fallbackId); } catch(e){ console.error('generateInvoice failed:', e); }
  } finally {
    // Always clear the overlay even if something threw earlier
    hideBusy();
  }
});


/* hover polish */
document.addEventListener('pointermove', (e)=>{
  document.querySelectorAll('.download-btn').forEach(btn=>{
    const r=btn.getBoundingClientRect(); btn.style.setProperty('--mx', ((e.clientX-r.left)/r.width*100)+'%');
  });
});
document.addEventListener('click',(e)=>{
  const a=e.target.closest('a[href]'); if(!a) return;
  const href=a.getAttribute('href'); if(href==="#"||href===''){ e.preventDefault(); }
});
