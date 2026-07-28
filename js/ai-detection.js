/* ============================================================================
 * ai-detection.js — Minimal Edge AI Waste Auto-Detection
 * ----------------------------------------------------------------------------
 * Runs silently in the background. No blocking, no big UI, no goofy emojis.
 * Just a subtle text hint next to the Category dropdown.
 * ==========================================================================*/
(function () {
  'use strict';

  const L10N = {
    en: { scanning: '✨ Auto-detecting...', found: '✨ Auto-selected', spam: '⚠️ No waste detected' },
    fr: { scanning: '✨ Détection...', found: '✨ Sélection auto', spam: '⚠️ Aucun déchet détecté' },
    ar: { scanning: '✨ جاري الكشف...', found: '✨ اختيار تلقائي', spam: '⚠️ لم يتم رصد نفايات' }
  };
  const lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  const t = (k) => (L10N[lang()] || L10N.en)[k];

  const WASTE_MAP = {
    plastic_marine: ['bottle', 'water bottle', 'pop bottle', 'cup', 'plastic bag', 'packet', 'lighter', 'bucket'],
    illegal_dumping: ['garbage', 'ashcan', 'trash can', 'carton', 'barrel', 'shopping cart', 'crate', 'box', 'tire', 'rubber'],
    water: ['coast', 'seashore', 'sandbar']
  };
  const REJECT_TERMS = ['person', 'face', 'man', 'woman', 'dog', 'cat', 'monitor', 'television', 'screen', 'laptop', 'cellular telephone'];

  let model = null;
  let isModelLoading = false;
  let hintEl = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src; s.crossOrigin = 'anonymous';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function initAI() {
    if (model || isModelLoading) return;
    isModelLoading = true;
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js');
      model = await window.mobilenet.load({ version: 2, alpha: 0.5 });
      const warmupCanvas = document.createElement('canvas');
      warmupCanvas.width = 224; warmupCanvas.height = 224;
      await model.classify(warmupCanvas);
    } catch (e) {
      console.error('AI load failed:', e);
    } finally {
      isModelLoading = false;
    }
  }

  function injectUI() {
    const select = document.querySelector('#categorySelect');
    const photoInput = document.querySelector('#reportForm input[name="photo"]');
    if (!select || !photoInput || document.getElementById('eco-ai-hint')) return;

    const labelSpan = select.previousElementSibling;
    if (labelSpan) {
      hintEl = document.createElement('span');
      hintEl.id = 'eco-ai-hint';
      hintEl.style.cssText = 'float:right; font-size:0.75rem; color:var(--accent-2, #0d9488); font-weight:600; opacity:0; transition:opacity 0.3s;';
      labelSpan.appendChild(hintEl);
    }

    photoInput.addEventListener('click', initAI);
    photoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) analyzeFile(e.target.files[0]);
    });
  }

  function updateUI(state) {
    if (!hintEl) return;
    if (state === 'hidden') {
      hintEl.style.opacity = '0';
    } else {
      hintEl.textContent = t(state) || '';
      hintEl.style.opacity = '1';
      hintEl.style.color = state === 'spam' ? 'var(--red, #ef4444)' : 'var(--accent-2, #0d9488)';
    }
  }

  async function analyzeFile(file) {
    if (!model && !isModelLoading) initAI();
    updateUI('scanning');

    try {
      const imgUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgUrl; });
      
      const cvs = document.createElement('canvas');
      cvs.width = 224; cvs.height = 224;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(img, 0, 0, 224, 224);
      URL.revokeObjectURL(imgUrl);

      // Give it a max of 4 seconds to load/infer, otherwise give up silently
      let timeout;
      const timeoutPromise = new Promise((_, rej) => timeout = setTimeout(() => rej(new Error('timeout')), 4000));
      
      const inferPromise = (async () => {
        while (isModelLoading) await new Promise(r => setTimeout(r, 100));
        if (!model) throw new Error('no model');
        return await model.classify(cvs);
      })();

      const predictions = await Promise.race([inferPromise, timeoutPromise]);
      clearTimeout(timeout);
      processPredictions(predictions);

    } catch (e) {
      updateUI('hidden');
    }
  }

  function processPredictions(predictions) {
    const rawTerms = predictions.map(p => p.className.toLowerCase().split(', ')).flat();
    const isSpam = rawTerms.some(term => REJECT_TERMS.includes(term));
    if (isSpam) {
      updateUI('spam');
      setTimeout(() => updateUI('hidden'), 5000);
      return;
    }

    let foundCat = null;
    for (const term of rawTerms) {
      for (const [cat, keywords] of Object.entries(WASTE_MAP)) {
        if (keywords.includes(term)) { foundCat = cat; break; }
      }
      if (foundCat) break;
    }

    if (foundCat) {
      const select = document.querySelector('#categorySelect');
      if (select) {
        select.value = foundCat;
        select.dispatchEvent(new Event('change'));
      }
      updateUI('found');
      setTimeout(() => updateUI('hidden'), 4000);
    } else {
      updateUI('hidden');
    }
  }

  const ob = new MutationObserver(() => {
    const modal = document.getElementById('reportModal');
    if (modal && !modal.classList.contains('hidden')) {
      injectUI();
      initAI(); 
    } else {
      updateUI('hidden');
    }
  });
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ob.observe(document.body, { childList: true, subtree: true }));
  } else {
    ob.observe(document.body, { childList: true, subtree: true });
  }

})();
