/* Giftorea • Personalisation Wizard (JS)
   - Small square cards
   - 6 steps (added Logo step)
   - Saves to localStorage
*/
(() => {
  const PREMIUM_PRICE_DZD = 3500;
  const LOGO_REDRAW_PRICE_DZD = 2000;

  const el = {
    stepsWrap: document.getElementById('gftSteps'),
    stepPill: document.getElementById('gftStepPill'),
    prev: document.getElementById('gftPrev'),
    next: document.getElementById('gftNext'),
  };

  const steps = Array.from(el.stepsWrap.querySelectorAll('.gft-step'));
  const TOTAL_STEPS = steps.length;

  // local state
  const state = {
    index: 0,
    selections: {
      designStyle: null,
      calendarType: null,
      language: null,
      designPackage: null,
      logoOption: null,     // 'have_ai' | 'redesign_2000'
      invoiceType: null,    // 'standard' | 'mokawil' | 'none'
    },
    fees: {
      premium: PREMIUM_PRICE_DZD,
      logoRedraw: LOGO_REDRAW_PRICE_DZD,
    }
  };

  // Restore from localStorage if present
  try {
    const saved = JSON.parse(localStorage.getItem('customization'));
    if (saved && typeof saved === 'object') {
      ['designStyle','calendarType','language','designPackage','invoiceType','logoOption'].forEach(k => {
        if (saved[k]) state.selections[k] = saved[k];
      });
      if (saved.premiumFee) state.fees.premium = saved.premiumFee;
      if (saved.logo && typeof saved.logo.fee === 'number') {
        state.fees.logoRedraw = saved.logo.fee || LOGO_REDRAW_PRICE_DZD;
      }
    }
  } catch(e) {}

  // Helpers
  const clamp = (n, min, max) => Math.max(min, Math.min(n, max));
  const currentStep = () => steps[state.index];
  const stepKey = (stepEl) => stepEl.getAttribute('data-step-key');

  function updateStepPill() {
    el.stepPill.textContent = `Step ${state.index + 1} of ${TOTAL_STEPS}`;
  }

  function syncNavButtons() {
    el.prev.disabled = state.index === 0;
    const key = stepKey(currentStep());
    el.next.disabled = !state.selections[key];
    el.next.textContent = (state.index === TOTAL_STEPS - 1) ? 'Finish' : 'Next';
  }

  function showStep(nextIndex) {
    steps.forEach(s => s.classList.remove('is-active'));
    state.index = clamp(nextIndex, 0, TOTAL_STEPS - 1);
    const stepEl = currentStep();
    stepEl.classList.add('is-active');

    const key = stepKey(stepEl);
    const selectedValue = state.selections[key];
    const cards = stepEl.querySelectorAll('.gft-card');

    cards.forEach(card => {
      const isSelected = card.getAttribute('data-value') === selectedValue;
      card.classList.toggle('is-selected', isSelected);
      card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });

    updateStepPill();
    syncNavButtons();
  }

  function saveToLocalStorage() {
    const s = state.selections;

    const premiumFee = (s.designPackage === 'premium') ? state.fees.premium : 0;

    const logo = {
      option: s.logoOption,
      hasVector: s.logoOption === 'have_ai',
      fee: (s.logoOption === 'redesign_2000') ? state.fees.logoRedraw : 0
    };

    const customization = {
      designStyle: s.designStyle,
      calendarType: s.calendarType,
      language: s.language,
      designPackage: s.designPackage,
      invoiceType: s.invoiceType,
      premiumFee: premiumFee,
      logo: logo
    };

    try {
      localStorage.setItem('customization', JSON.stringify(customization));
      const cod = JSON.parse(localStorage.getItem('completeOrderData') || '{}') || {};
      cod.customization = customization;
      localStorage.setItem('completeOrderData', JSON.stringify(cod));
    } catch (e) {
      console.warn('Failed to save customization:', e);
    }
  }

  // Card selection
  steps.forEach(stepEl => {
    stepEl.addEventListener('click', (ev) => {
      const target = ev.target.closest('.gft-card');
      if (!target) return;

      const key = stepKey(stepEl);
      const value = target.getAttribute('data-value');

      state.selections[key] = value;

      const cards = stepEl.querySelectorAll('.gft-card');
      cards.forEach(c => {
        const isSelected = c === target;
        c.classList.toggle('is-selected', isSelected);
        c.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      });

      syncNavButtons();
    });
  });

  // Keyboard support
  steps.forEach(stepEl => {
    stepEl.addEventListener('keydown', (ev) => {
      const cards = Array.from(stepEl.querySelectorAll('.gft-card'));
      const focusIndex = cards.indexOf(document.activeElement);
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        const next = cards[clamp(focusIndex + 1, 0, cards.length - 1)];
        if (next) next.focus();
      }
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        const prev = cards[clamp(focusIndex - 1, 0, cards.length - 1)];
        if (prev) prev.focus();
      }
      if (ev.key === 'Enter' || ev.key === ' ') {
        const target = document.activeElement.closest('.gft-card');
        if (target) target.click();
      }
    });
  });

  // Nav actions
  el.prev.addEventListener('click', () => {
    showStep(state.index - 1);
  });

  el.next.addEventListener('click', () => {
    if (state.index < TOTAL_STEPS - 1) {
      showStep(state.index + 1);
      return;
    }
    // Finish
    saveToLocalStorage();

    // CHANGED: go to ../form/ (was "/form/")
    window.location.href = '../form/form.html';
  });

  // Init
  showStep(state.index);
})();
