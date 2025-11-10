// Guard: don't allow skipping customization if a cart exists
document.addEventListener('DOMContentLoaded', function(){
  try{
    const productData   = JSON.parse(localStorage.getItem('productData') || 'null');
    const customization = JSON.parse(localStorage.getItem('customization') || 'null');

    if (productData && !customization){
      // User came here without answering the wizard
      window.location.replace('/personalisation/');
      return;
    }
  }catch(_){}
  loadSavedFormData();
  setupAutoSave();
});

// Order source
function checkOrderSource(){
  return localStorage.getItem('orderSource') || 'custom';
}

// New: build a single payload that includes products + customization + computed pricing
function prepareOrderData(formData){
  const source        = checkOrderSource();
  const productData   = JSON.parse(localStorage.getItem('productData') || 'null');
  const customization = JSON.parse(localStorage.getItem('customization') || 'null');

  // Compute pricing using customization if present
  const baseSubtotal = Number(productData?.globalTotal || 0);
  const premiumAdded = (customization?.designPackage === 'premium') ? Number(customization?.premiumFee || 3900) : 0;
  const taxRate      = (customization?.invoiceType === 'standard') ? 0.10 : (customization?.invoiceType === 'mokawil' ? 0.005 : 0);
  const taxAmount    = Math.round((baseSubtotal + premiumAdded) * taxRate);
  const grandTotal   = baseSubtotal + premiumAdded + taxAmount;

  const payload = {
    source,
    customerInfo: formData,
    productData: productData || null,
    customization: customization || null,
    pricing: { baseSubtotal, premiumAdded, taxAmount, grandTotal }
  };

  if (source === 'ready-pack'){
    payload.packInfo = JSON.parse(localStorage.getItem('packInfo') || 'null');
  } else if (source === 'industry'){
    payload.industryInfo = JSON.parse(localStorage.getItem('industryInfo') || 'null');
  }
  return payload;
}

// Number input validation
function isNumberKey(evt) {
  var charCode = (evt.which) ? evt.which : evt.keyCode;
  if (charCode > 31 && (charCode < 48 || charCode > 57)) return false;
  return true;
}

// Simple back navigation using history
function goBack() { window.history.back(); }

// Load saved form data when page loads
function loadSavedFormData() {
  try {
    const savedFormData = localStorage.getItem('customerFormData');
    if (savedFormData) {
      const parsedData = JSON.parse(savedFormData);
      document.getElementById('fullName').value = parsedData.fullName || '';
      document.getElementById('company').value = parsedData.company || '';
      document.getElementById('phone').value = parsedData.phone || '';
      document.getElementById('email').value = parsedData.email || '';
      document.getElementById('state').value = parsedData.state || '';
      document.getElementById('city').value = parsedData.city || '';
    }
  } catch (error) {
    console.error('Failed to load saved form data:', error);
  }
}

// Setup auto-save on input
function setupAutoSave() {
  const formInputs = ['fullName','company','phone','email','state','city'];
  formInputs.forEach(inputId => {
    const inputElement = document.getElementById(inputId);
    if(!inputElement) return;
    inputElement.addEventListener('input', function() {
      try {
        const formData = {
          fullName: document.getElementById('fullName').value,
          company:  document.getElementById('company').value,
          phone:    document.getElementById('phone').value,
          email:    document.getElementById('email').value,
          state:    document.getElementById('state').value,
          city:     document.getElementById('city').value
        };
        localStorage.setItem('customerFormData', JSON.stringify(formData));
      } catch (error) {
        console.error('Failed to save form data:', error);
      }
    });
  });
}

// Submit
document.getElementById('registrationForm').addEventListener('submit', function(e) {
  e.preventDefault();

  const formData = {
    fullName: document.getElementById('fullName').value,
    company:  document.getElementById('company').value,
    phone:    document.getElementById('phone').value,
    email:    document.getElementById('email').value,
    state:    document.getElementById('state').value,
    city:     document.getElementById('city').value
  };

  localStorage.setItem('customerFormData', JSON.stringify(formData));

  const orderData = prepareOrderData(formData);
  if (!orderData) {
    alert('Une erreur est survenue. Veuillez réessayer.');
    return;
  }

  localStorage.setItem('completeOrderData', JSON.stringify(orderData));

  // Thank-you page (local)
  window.location.href = '../thankyou/thankyou.html';
});
