/* ===========================================================
   Giftorea — Thank-You Page (ORIGINAL v2.4 JS + requested fixes)
   - Logo redesign fee (+2000 DZD) in totals
   - Email body fixed (never empty) + attach PDF + include invoice URL
   - Upload PDF to WP Media (JWT) and use its URL in email
   - REQUIRED left-side notice under totals
   - Show Logo choice under Design in “Choix” card
   - Slightly increased spacing between choice rows
   =========================================================== */

/* libs */
window.jsPDF = window.jspdf.jsPDF;
try { emailjs.init("AUKVraZwu5iufPOe7"); } catch (_) {}

async function ensureEmailJSReady(){
  if (window.emailjs && typeof emailjs.send === 'function') {
    try { emailjs.init("AUKVraZwu5iufPOe7"); } catch(_) {}
    return true;
  }
  try {
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js";
      s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
    });
    emailjs.init("AUKVraZwu5iufPOe7");
    return true;
  } catch(err){
    console.error('EmailJS load/init failed:', err);
    return false;
  }
}


/* tokens + utils */
const BRAND_NAME = "Giftorea B2B";
const CONTACT_EMAIL = "contact@giftoreab2b.com";
const CONTACT_PHONE = "+213550100706";
const NAVY=[11,42,74], SLATE=[71,85,105], BORDER=[222,226,236];

function fmtDZD(n){ return `${Number(n||0).toLocaleString('en-US')} DZD`; }
function formatDate(d){ return d.toLocaleDateString('fr-FR',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }
function esc(s){ if(s==null) return ""; return String(s).replace(/[&<>"]/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m])); }

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

/* WP order save */
async function getOrderToken(){ try{ const r=await fetch('/wp-json/gft/v1/order-token',{method:'GET',credentials:'same-origin'}); const j=await r.json(); return (j&&j.ok)?j.token:null; }catch{ return null; } }
async function saveOrderToWP(orderData){
  try{
    const token=await getOrderToken(); const headers={'Content-Type':'application/json'}; if(token) headers['X-GFT-ORDER-TOKEN']=token;
    const r=await fetch('/wp-json/gft/v1/order',{method:'POST',credentials:'same-origin',headers,body:JSON.stringify(orderData)});
    const j=await r.json(); return (j&&j.ok&&j.public_id)?j.public_id:null;
  }catch{ return null; }
}

/* WP media upload for the PDF (JWT) */
async function getJwtToken(){
  try{
    const r = await fetch('/wp-json/gft/v1/token', { credentials:'include' });
    if (r.ok){ const j = await r.json(); return j?.token || j?.jwt || null; }
  }catch(e){}
  return null;
}
async function uploadInvoiceToWP(pdfBlob, filename){
  try{
    const jwt = await getJwtToken();
    if(!jwt) return null;
    const r = await fetch('/wp-json/wp/v2/media', {
      method:'POST',
      headers:{
        'Authorization': `Bearer ${jwt}`,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/pdf'
      },
      body: pdfBlob
    });
    if(!r.ok) return null;
    const media = await r.json();
    return media?.source_url || media?.guid?.rendered || null;
  }catch(e){ return null; }
}

/* Email (HTML body + attachment + invoice_url) */
async function sendOrderEmail(orderData, invoiceNumber=null, pdfBase64=null){
  try{
    const ready = await ensureEmailJSReady();
    if(!ready) { console.error('EmailJS not ready'); return; }

    const c = orderData.customerInfo || {};
    let messageBody;
    if(orderData.source === 'custom'){
      const itemsHTML = itemsTable(orderData.orderDetails?.products, orderData.orderDetails?.globalTotal);
      const inner = `${clientBlock(c)}${itemsHTML}
        <div style="margin-top:16px;text-align:right;">
          <a href="tel:${esc(c.phone)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font:600 13px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial;">Appeler le client</a>
        </div>`;
      messageBody = emailShell(inner);
    } else if(orderData.source === 'ready-pack'){
      const packHTML = packTable(orderData.packInfo || {});
      const inner = `${clientBlock(c)}${packHTML}
        <div style="margin-top:16px;text-align:right;">
          <a href="tel:${esc(c.phone)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font:600 13px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial;">Appeler le client</a>
        </div>`;
      messageBody = emailShell(inner);
    }

    const emailParams = {
      to_name: c.company || '',
      from_name: 'Giftorea B2B',
      invoice_number: invoiceNumber || '',
      // send body in multiple fields so the template never renders empty
      message: messageBody,
      message_html: messageBody,
      html: messageBody,
      content: messageBody
    };

    // keep your existing attachment param (if your template has a File var named "pdf_file")
    if (pdfBase64) {
      emailParams.pdf_file = pdfBase64;
      // optional: EmailJS attachments array (works even if the template doesn’t define a File var)
      emailParams.attachments = [{
        name: `Facture-Giftorea-${invoiceNumber||'commande'}.pdf`,
        data: pdfBase64
      }];
    }

    await emailjs.send('service_chey66l', 'template_fuau9gh', emailParams);
    console.log('Email sent successfully');
  }catch(err){
    console.error('Email sending error:', err);
  }
}


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

/* tiny icons for PDF */
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

/* products and fallbacks */
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

/* totals with logo fee */
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

/* PDF generator */
async function generateInvoice(invoiceNumber){
  showBusy('Génération de la facture…');

  const { cod, products, baseSubtotal } = getOrderDataWithFallback();
  const c = cod.customerInfo || {};
  const { customization, premiumFee, logoFee, rate, taxAmount, grandTotal } = computeTotals(cod, baseSubtotal);

  const styleLabel=(customization.designStyle||'modern').replace(/^\w/,m=>m.toUpperCase());
  const calLabel=customization.calendarType==='miladi'?'Miladi uniquement':'Hijri/Miladi';
  const langLabel=({ar:'Arabe',fr:'Français',en:'Anglais'})[customization.language]||'—';
  const packLabel=customization.designPackage==='premium'?'Premium (+3 500 DZD) — création sur mesure':'Standard (modèle optimisé)';
  const logoLabel=(customization?.logo?.option==='redesign_2000')
      ? 'Redessiner le logo (+2000 DZD)'
      : (customization?.logo?.option==='have_ai' ? 'AI/SVG fourni' : '—');
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
    doc.text(`N°: ${invoiceNumber||''}`, pageW-M.right, M.top-3, {align:'right'});
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

  // Choix card
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
    b+=7;

    doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
    doc.text('Logo :', rightX, b);
    doc.setFont('helvetica','normal'); doc.setTextColor(...SLATE); doc.text(logoLabel, rightX+14, b);

    const fy=y+h-6;
    doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
    drawIcon(doc,'receipt',M.left+4,fy-4.3,4,NAVY); doc.text('Facturation :',M.left+12,fy);
    doc.setFont('helvetica','normal'); doc.setTextColor(...SLATE); doc.text(invLabel,M.left+34,fy);
    return y+h+8;
  }

  // Compose PDF
  const docStatus = document.getElementById('invoice-status');
  if (docStatus) docStatus.textContent = 'Génération de la facture en cours…';

  header();
  let cursorY = M.top+10;
  cursorY = clientCard(cursorY);
  cursorY = optionsCard(cursorY);

  doc.setFont('helvetica','normal'); doc.setTextColor(120); doc.setFontSize(9);
  doc.text("Notice : ce document récapitule votre commande et sert de preuve de dépôt (TVA non applicable).", M.left, cursorY);
  cursorY += 5;

  const head=[['Article','Prix','QTT','Total']];
  const body=( (JSON.parse(localStorage.getItem('productData')||'{}').products)||[] )
    .filter(p=>Number(p.quantity ?? p.qty)>0)
    .map(p=>{
      const q=Number(p.quantity ?? p.qty ?? 0), price=Number(p.price||0);
      const total=Number(p.totalPrice!=null?p.totalPrice:price*q);
      return [ (p.name||''), fmtDZD(price), String(q), fmtDZD(total) ];
    });

  const startY=Math.max(cursorY+2, M.top+44);
  doc.autoTable({
    head, body, startY,
    margin:{left:M.left,right:M.right},
    theme:'grid',
    styles:{font:'helvetica',fontSize:10,cellPadding:2.6,textColor:[15,23,42],lineColor:BORDER,lineWidth:0.2},
    headStyles:{fillColor:[238,242,255],textColor:[23,37,84],lineColor:BORDER,lineWidth:0.2,fontStyle:'bold'},
    alternateRowStyles:{fillColor:[250,250,253]}
  });

  let tableBottom = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : startY+10;
  const pageW=210, pageH=297, Mleft=16, Mright=16, Mbottom=18;
  const needNewPage = tableBottom + 40 > pageH - Mbottom;
  if(needNewPage){ doc.addPage(); header(); tableBottom = M.top + 14; }
  const boxW=96, boxH=40, boxX=pageW - Mright - boxW, boxY=tableBottom + 8;
  doc.setDrawColor(...BORDER); doc.setFillColor(255,255,255); doc.roundedRect(boxX,boxY,boxW,boxH,2,2,'S');
  doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY); doc.setFontSize(10); doc.text('Résumé des frais', boxX+4, boxY+6);
  let ry=boxY+12, L=boxX+4, R=boxX+boxW-4;
  function row(lbl,val,bold){ doc.setFont('helvetica', bold?'bold':'normal'); doc.setTextColor(...(bold?NAVY:SLATE)); doc.text(lbl,L,ry); doc.text(val,R,ry,{align:'right'}); ry+=5.2; }

  const { grandTotal, taxAmount } = computeTotals(JSON.parse(localStorage.getItem('completeOrderData')||'{}'), sumProducts(JSON.parse(localStorage.getItem('productData')||'{}').products||[]));
  const { customization, premiumFee, logoFee, rate } = computeTotals(JSON.parse(localStorage.getItem('completeOrderData')||'{}'), 0);

  const baseSubtotal = sumProducts(JSON.parse(localStorage.getItem('productData')||'{}').products||[]);
  const pct = (Math.round((rate*100)*10)/10).toString().replace('.0','');
  const designRowLabel = premiumFee>0 ? 'Option design premium :' : 'Design standard (gratuit) :';
  row('Sous-total produits :', fmtDZD(baseSubtotal), false);
  row(designRowLabel, fmtDZD(premiumFee), false);
  if (logoFee > 0) row('Frais de redesign du logo :', fmtDZD(logoFee), false);
  row(`Frais de facturation (${pct}%) :`, fmtDZD(taxAmount), false);
  doc.setDrawColor(...BORDER); doc.line(L, ry-3.2, R, ry-3.2);
  row('Total général :', fmtDZD(grandTotal), true);

  const BOTTOM_NOTICE = "Notice: text will be here";
  const noticeY = Math.min(tableBottom + 7, pageH - M.bottom - 4);
  doc.setTextColor(90); doc.setFontSize(9);
  doc.text(BOTTOM_NOTICE, M.left, noticeY, { align:'left', maxWidth: (pageW/2) - M.left });
  doc.setTextColor(0);

  const totalPages = doc.getNumberOfPages();
  for(let i=1;i<=totalPages;i++){ doc.setPage(i); footer(i,totalPages); }

  const filename = 'Facture-Giftorea-B2B.pdf';
  const pdfBlob  = doc.output('blob');
  const pdfBase64 = doc.output('datauristring');

  let invoiceUrl = null;
  try { invoiceUrl = await uploadInvoiceToWP(pdfBlob, filename); } catch(_){}

  doc.save(filename);

  const cod = JSON.parse(localStorage.getItem('completeOrderData')||'{}') || {};
  await sendOrderEmail(cod, invoiceNumber, pdfBase64, invoiceUrl);

  if (docStatus) docStatus.textContent = 'Facture générée et enregistrée.';
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
  const orderData = handleOrderSource();
  if(!orderData){ hideBusy(); return; }
  let serverId = await saveOrderToWP(orderData);
  if(!serverId){ serverId = localDailyId(); }
  const refEl = document.getElementById('order-number');
  if(refEl) refEl.textContent = '#'+serverId;
  await generateInvoice(serverId);
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
