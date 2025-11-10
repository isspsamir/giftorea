// orderconfirmation.js
document.addEventListener('DOMContentLoaded', () => {
  renderOrder();

  // Back button: safe same-origin back, fallback to home
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      try {
        const ref = document.referrer;
        if (ref && new URL(ref).origin === location.origin) {
          history.back();
        } else {
          window.location.href = '/';
        }
      } catch (_) {
        window.location.href = '/';
      }
    });
  }

  // Confirm: set flags (orderSource) then let the <a> navigate via href
  const confirmBtn = document.getElementById('confirmBtn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      try { setOrderSourceFlags(); } catch (e) { /* ignore */ }
    });
  }
});

const toDZD = (n) => (Number(n) || 0).toLocaleString('fr-DZ') + ' DZD';

function renderOrder() {
  const saved = JSON.parse(localStorage.getItem('productData') || 'null');
  const list = document.getElementById('orderItems');
  const totalEl = document.getElementById('globalTotal');

  if (!list || !totalEl) return;

  list.innerHTML = '';

  if (!saved || !Array.isArray(saved.products)) {
    totalEl.textContent = '0 DZD';
    list.insertAdjacentHTML('beforeend', `
      <div class="row row--empty" role="listitem">
        <span>Aucun article sélectionné.</span>
      </div>
    `);
    return;
  }

  saved.products.forEach(p => {
    if (Number(p.quantity) > 0) {
      const img = p.image || '';
      const name = p.name || 'Produit';
      const qty = p.quantity;
      const total = toDZD(p.totalPrice);

      list.insertAdjacentHTML('beforeend', `
        <div class="row" role="listitem">
          <div class="col produit">
            <div class="media"><img src="${img}" alt="${name}"></div>
            <span class="name" title="${name}">${name}</span>
          </div>
          <div class="col qtt" aria-label="Quantité">${qty}</div>
          <div class="col total" aria-label="Total">${total}</div>
        </div>
      `);
    }
  });

  const gt = (saved.globalTotal != null) ? toDZD(saved.globalTotal) : '0 DZD';
  totalEl.textContent = gt;
}

function setOrderSourceFlags() {
  const industry = JSON.parse(localStorage.getItem('industrySource') || 'null');
  const packInfo = JSON.parse(localStorage.getItem('packInfo') || 'null');

  if (industry && industry.slug) {
    localStorage.setItem('orderSource', 'industry');
    localStorage.setItem('industryInfo', JSON.stringify(industry));
  } else if (packInfo) {
    localStorage.setItem('orderSource', 'ready-pack');
  } else {
    localStorage.setItem('orderSource', 'custom');
  }
}
