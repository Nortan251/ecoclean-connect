/* ============================================================================
 * ai-detection.js — Edge AI Waste Auto-Detection (CAPSTONE FEATURE)
 * ----------------------------------------------------------------------------
 * Runs a Computer Vision model (MobileNetV2 via TensorFlow.js) directly inside
 * the user's mobile browser. Zero server cost, total privacy, instant feedback.
 * 
 * ENGINEERING HIGHLIGHTS:
 * 1. Lazy-loading: TF.js scripts only fetch when the user opens the report modal,
 *    keeping the app's initial load time blazing fast.
 * 2. Memory Safety: Downsamples 12MP camera photos to 224x224 via an offscreen
 *    canvas BEFORE passing to WebGL/WASM. This prevents iOS Safari from crashing.
 * 3. Graceful Degradation: If offline or slow, the AI fails silently and allows
 *    the user to report normally. It enhances, but never blocks, the critical path.
 * 4. Categorization Engine: Maps ImageNet's 1000 classes to EcoClean's 5 categories.
 * ==========================================================================*/
(function () {
  'use strict';

  // --- 1. Dictionaries & Config ---
  const L10N = {
    en: { ai_title: 'EcoClean AI', ai_loading: 'Waking up AI...', ai_scanning: 'Scanning photo...', ai_found: 'Detected:', ai_spam: 'No pollution detected. Please ensure waste is visible.', ai_err: 'AI scan skipped.', btn_wait: 'Scanning...' },
    fr: { ai_title: 'IA EcoClean', ai_loading: 'Démarrage de l\'IA...', ai_scanning: 'Analyse de la photo...', ai_found: 'Détecté :', ai_spam: 'Aucune pollution détectée. Assurez-vous que les déchets sont visibles.', ai_err: 'Analyse IA ignorée.', btn_wait: 'Analyse...' },
    ar: { ai_title: 'الذكاء الاصطناعي', ai_loading: 'جاري تشغيل الذكاء الاصطناعي...', ai_scanning: 'جاري فحص الصورة...', ai_found: 'تم اكتشاف:', ai_spam: 'لم يتم رصد تلوث. يرجى التأكد من وضوح النفايات.', ai_err: 'تم تخطي الفحص.', btn_wait: 'جاري الفحص...' }
  };
  const lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  const t = (k) => (L10N[lang()] || L10N.en)[k];

  // Map MobileNet classes to EcoClean categories
  const WASTE_MAP = {
    plastic_marine: ['bottle', 'water bottle', 'pop bottle', 'cup', 'plastic bag', 'packet', 'lighter', 'bucket'],
    illegal_dumping: ['garbage', 'ashcan', 'trash can', 'carton', 'barrel', 'shopping cart', 'crate', 'box', 'tire', 'rubber'],
    water: ['coast', 'seashore', 'sandbar']
  };
  // Prevent selfies / screenshots from being submitted as pollution
  const REJECT_TERMS = ['person', 'face', 'man', 'woman', 'dog', 'cat', 'monitor', 'television', 'screen', 'laptop', 'cellular telephone'];

  let model = null;
  let isModelLoading = false;

  // --- 2. Dynamic Script Loader ---
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
      updateUI('loading');
      // Load TF.js core + backend, then MobileNet
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js');
      
      // Load lightweight MobileNet (alpha 0.5 is faster, perfectly fine for basic object detection)
      model = await window.mobilenet.load({ version: 2, alpha: 0.5 });
      
      // Warm up the WebGL shaders so the first real scan doesn't freeze the UI
      const warmupCanvas = document.createElement('canvas');
      warmupCanvas.width = 224; warmupCanvas.height = 224;
      await model.classify(warmupCanvas);
      
      updateUI('idle');
    } catch (e) {
      console.error('EcoClean AI failed to load:', e);
      updateUI('error');
    } finally {
      isModelLoading = false;
    }
  }

  // --- 3. UI Injection ---
  let aiBox, aiStatus, aiBar, submitBtn, ogSubmitText;

  function injectUI() {
    const photoInput = document.querySelector('#reportForm input[name="photo"]');
    submitBtn = document.querySelector('#reportForm button[type="submit"]');
    if (!photoInput || !submitBtn || document.getElementById('eco-ai-box')) return;

    aiBox = document.createElement('div');
    aiBox.id = 'eco-ai-box';
    aiBox.className = 'eco-ai-box hidden';
    aiBox.innerHTML = `
      <div class="eco-ai-icon">🤖</div>
      <div class="eco-ai-content">
        <div class="eco-ai-title">${t('ai_title')}</div>
        <div class="eco-ai-status" id="ecoAiStatus"></div>
        <div class="eco-ai-bar"><div class="eco-ai-fill" id="ecoAiFill"></div></div>
      </div>
    `;
    photoInput.parentNode.insertBefore(aiBox, photoInput.nextSibling);

    const st = document.createElement('style');
    st.textContent = `
      .eco-ai-box { display: flex; align-items: center; gap: 12px; background: var(--surface-2, #eef7f2); border: 1px solid var(--border-strong, #cfe2d8); border-radius: 12px; padding: 10px 14px; margin-top: 8px; transition: all 0.3s; }
      .eco-ai-box.hidden { display: none !important; }
      .eco-ai-icon { font-size: 1.8rem; animation: eco-ai-float 3s ease-in-out infinite; }
      .eco-ai-content { flex: 1; min-width: 0; }
      .eco-ai-title { font-size: .75rem; font-weight: 800; color: var(--accent-dark, #0a5c3f); text-transform: uppercase; letter-spacing: .05em; }
      .eco-ai-status { font-size: .85rem; font-weight: 600; color: var(--text, #14241d); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .eco-ai-bar { height: 4px; background: rgba(0,0,0,0.06); border-radius: 99px; margin-top: 6px; overflow: hidden; }
      .eco-ai-fill { height: 100%; width: 0%; background: var(--accent-grad, linear-gradient(135deg, #198754, #0d9488)); border-radius: 99px; transition: width 0.3s; }
      .eco-ai-box.scanning .eco-ai-fill { animation: eco-ai-scan 1.5s infinite ease-in-out; }
      .eco-ai-box.success { background: rgba(25, 135, 84, 0.1); border-color: #198754; }
      .eco-ai-box.success .eco-ai-fill { width: 100%; background: #198754; animation: none; }
      .eco-ai-box.warning { background: var(--warn-bg, #fff8e1); border-color: var(--warn-border, #f0a500); }
      .eco-ai-box.warning .eco-ai-fill { width: 100%; background: var(--amber, #d97706); animation: none; }
      @keyframes eco-ai-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      @keyframes eco-ai-scan { 0% { width: 0%; margin-left: 0; } 50% { width: 100%; margin-left: 0; } 100% { width: 0%; margin-left: 100%; } }
    `;
    document.head.appendChild(st);

    aiStatus = document.getElementById('ecoAiStatus');
    aiBar = document.getElementById('ecoAiFill');

    // Trigger AI wake-up only when they click the photo input
    photoInput.addEventListener('click', initAI);
    photoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) analyzeFile(e.target.files[0]);
    });
  }

  function updateUI(state, text = '') {
    if (!aiBox) return;
    aiBox.classList.remove('hidden', 'scanning', 'success', 'warning');
    if (state === 'hidden') { aiBox.classList.add('hidden'); return; }
    
    aiStatus.textContent = text || t('ai_' + state) || '';
    if (state === 'loading' || state === 'scanning') aiBox.classList.add('scanning');
    if (state === 'success') aiBox.classList.add('success');
    if (state === 'warning') aiBox.classList.add('warning');
  }

  // --- 4. The Core Inference Engine ---
  async function analyzeFile(file) {
    if (!model && !isModelLoading) initAI(); // Fallback start
    
    // Safety timeout: Never block the user for more than 5 seconds
    let isTimeout = false;
    const timeout = setTimeout(() => {
      isTimeout = true;
      updateUI('warning', 'AI took too long. Proceed manually.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = ogSubmitText; }
    }, 5000);

    try {
      updateUI('scanning');
      if (submitBtn) { 
        ogSubmitText = submitBtn.textContent; 
        submitBtn.disabled = true; 
        submitBtn.textContent = t('btn_wait'); 
      }

      // Memory constraint: Downsample the image via offscreen canvas.
      // A raw 12MP image from an iPhone will crash TF.js WebGL backend instantly.
      const imgUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgUrl; });
      
      const cvs = document.createElement('canvas');
      cvs.width = 224; cvs.height = 224; // MobileNet native size
      const ctx = cvs.getContext('2d');
      ctx.drawImage(img, 0, 0, 224, 224);
      URL.revokeObjectURL(imgUrl);

      // Wait for model to finish loading if it's still booting
      while(isModelLoading && !isTimeout) await new Promise(r => setTimeout(r, 200));
      if (!model || isTimeout) return;

      // Execute Neural Net
      const predictions = await model.classify(cvs);
      clearTimeout(timeout);
      
      processPredictions(predictions);

    } catch (e) {
      console.error('AI Inference Error:', e);
      updateUI('hidden');
    } finally {
      if (submitBtn && !isTimeout) { 
        submitBtn.disabled = false; 
        submitBtn.textContent = ogSubmitText; 
      }
    }
  }

  function processPredictions(predictions) {
    // Flatten class names (e.g., "water bottle, jug" -> ["water bottle", "jug"])
    const rawTerms = predictions.map(p => p.className.toLowerCase().split(', ')).flat();
    
    // 1. Check for Spam / Selfies
    const isSpam = rawTerms.some(term => REJECT_TERMS.includes(term));
    if (isSpam) {
      updateUI('warning', t('ai_spam'));
      return;
    }

    // 2. Check for Waste Categories
    let foundCat = null;
    let foundTerm = '';
    
    for (const term of rawTerms) {
      for (const [cat, keywords] of Object.entries(WASTE_MAP)) {
        if (keywords.includes(term)) {
          foundCat = cat;
          foundTerm = term;
          break;
        }
      }
      if (foundCat) break;
    }

    if (foundCat) {
      // Magic trick: Auto-select the dropdown category!
      const select = document.querySelector('#categorySelect');
      if (select) {
        select.value = foundCat;
        // Dispatch change event in case other modules listen to it
        select.dispatchEvent(new Event('change')); 
      }
      // Capitalize first letter of detected term
      const displayTerm = foundTerm.charAt(0).toUpperCase() + foundTerm.slice(1);
      updateUI('success', `${t('ai_found')} ${displayTerm} ✅`);
    } else {
      // Neutral result
      updateUI('success', 'Image processed. Please select category manually.');
    }
  }

  // Hook into the report modal opening
  const ob = new MutationObserver(() => {
    const modal = document.getElementById('reportModal');
    if (modal && !modal.classList.contains('hidden')) {
      injectUI();
      // Pre-warm AI if they open the modal, making it instantly ready when they snap a photo
      initAI(); 
    } else {
      if (aiBox) updateUI('hidden');
    }
  });
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ob.observe(document.body, { childList: true, subtree: true }));
  } else {
    ob.observe(document.body, { childList: true, subtree: true });
  }

})();
