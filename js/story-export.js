/* ============================================================================
 * story-export.js — Instagram/WhatsApp "Story" Export (ADDITIVE)
 * ----------------------------------------------------------------------------
 * Growth mechanic: Adds a "Share to Story" button inside the verified popup.
 * Stitches Before & After photos vertically (1080x1920) on an HTML5 Canvas,
 * adds the EcoClean branding + "Cleaned!" stamp, and triggers a direct image
 * download. Pure frontend, zero backend.
 * ==========================================================================*/
(function () {
  'use strict';
  const W = 1080, H = 1920; // 9:16 Story format
  
  function loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        // Fallback without CORS
        const img2 = new Image();
        img2.onload = () => resolve(img2);
        img2.onerror = () => resolve(null);
        img2.src = url;
      };
      img.src = url;
    });
  }

  function drawStory(beforeImg, afterImg, category) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0a5c3f'; // Dark green
    ctx.fillRect(0, 0, W, H);

    // Draw images (half and half with padding)
    const padding = 60;
    const innerW = W - padding * 2;
    const innerH = Math.floor((H - 300) / 2); // Leave 300px at bottom for brand

    function coverImage(img, x, y, cw, ch) {
      if (!img) {
        ctx.fillStyle = '#143027'; ctx.fillRect(x, y, cw, ch);
        return;
      }
      const scale = Math.max(cw / img.width, ch / img.height);
      const sw = cw / scale, sh = ch / scale;
      const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, x, y, cw, ch);
    }

    // Top: Before
    ctx.save();
    ctx.beginPath(); ctx.roundRect(padding, padding, innerW, innerH, 40); ctx.clip();
    coverImage(beforeImg, padding, padding, innerW, innerH);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(padding, padding, innerW, 100);
    ctx.font = 'bold 50px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('BEFORE', padding + 40, padding + 70);
    ctx.restore();

    // Bottom: After
    const y2 = padding + innerH + 40;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(padding, y2, innerW, innerH, 40); ctx.clip();
    coverImage(afterImg, padding, y2, innerW, innerH);
    ctx.fillStyle = 'rgba(25, 135, 84, 0.8)'; ctx.fillRect(padding, y2, innerW, 100);
    ctx.font = 'bold 50px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('CLEANED ✅', padding + 40, y2 + 70);
    ctx.restore();

    // Footer Branding
    ctx.font = 'bold 65px sans-serif'; ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('EcoClean Connect', W / 2, H - 120);
    
    ctx.font = 'normal 40px sans-serif'; ctx.fillStyle = '#8ce8b9';
    ctx.fillText('Report pollution. Mobilize your community.', W / 2, H - 60);

    return canvas;
  }

  function download(canvas, name) {
    return new Promise((res) => {
      canvas.toBlob((blob) => {
        if (!blob) return res();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        res();
      }, 'image/jpeg', 0.85);
    });
  }

  window.addEventListener('ecoclean:mapready', (ev) => {
    const map = ev.detail;
    if (!map) return;
    map.on('popupopen', (e) => {
      const marker = e.popup && e.popup._source;
      const id = marker && marker._reportId;
      if (!id) return;
      const rep = (window.EcoClean.reports || []).find((r) => r.id === id);
      if (!rep || rep.status !== 'verified' || !rep.afterPhoto) return;

      const el = e.popup.getElement();
      if (!el || el.querySelector('.eco-story-btn')) return;

      const row = document.createElement('div');
      row.style.marginTop = '8px';
      const btn = document.createElement('button');
      btn.className = 'eco-story-btn';
      btn.style.cssText = 'width:100%; background:linear-gradient(135deg, #198754, #0d9488); color:#fff; border:none; border-radius:8px; padding:9px; font-size:.85rem; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(13,148,136,.3); transition:transform .15s;';
      const isAr = (typeof window.getLang === 'function' ? getLang() : 'en') === 'ar';
      const isFr = (typeof window.getLang === 'function' ? getLang() : 'en') === 'fr';
      btn.textContent = isAr ? '📱 تنزيل كقصة (Story)' : (isFr ? '📱 Télécharger pour Story' : '📱 Export to Story');
      
      btn.onactive = () => btn.style.transform = 'scale(0.97)';
      btn.onclick = async () => {
        const old = btn.textContent;
        btn.textContent = '⏳ ...';
        btn.disabled = true;
        const [imgB, imgA] = await Promise.all([loadImage(rep.beforePhoto), loadImage(rep.afterPhoto)]);
        try {
          const cvs = drawStory(imgB, imgA, rep.category);
          await download(cvs, 'ecoclean-story-' + id + '.jpg');
        } catch (err) {}
        btn.textContent = old;
        btn.disabled = false;
      };

      row.appendChild(btn);
      el.appendChild(row);
    });
  });
})();
