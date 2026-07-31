const fs = require('fs');
let code = fs.readFileSync('js/bundle-map.js', 'utf8');

// The original map.addControl was actually `new HeatCtl().addTo(map);`
code = code.replace(/new HeatCtl\(\)\.addTo\(map\);/g, 
`
    // Move Density button out of Leaflet native controls and into eco-special-tools stack
    const container = document.getElementById('map');
    if (container) {
      let wrap = document.getElementById('eco-special-tools');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'eco-special-tools';
        wrap.style.cssText = 'position: absolute; top: 16px; right: 16px; z-index: 1000; display:flex; flex-direction:column; gap:8px; pointer-events:none; align-items: flex-end;';
        container.appendChild(wrap);
      }
      
      const btn = document.createElement('button');
      btn.className = 'eco-filter-toggle eco-heat-pill'; 
      btn.type = 'button';
      btn.innerHTML = '<span aria-hidden="true">🔥</span> <span class="eco-heat-label"></span>';
      pillLabel = btn.querySelector('.eco-heat-label'); 
      if (pillLabel) pillLabel.textContent = t('btn');
      btn.style.pointerEvents = 'auto';
      btn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
      btn.style.background = 'var(--surface)';
      btn.style.color = '#198754';
      btn.style.borderColor = '#198754';
      
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggle();
        if (on) {
          btn.style.background = '#198754';
          btn.style.color = '#fff';
        } else {
          btn.style.background = 'var(--surface)';
          btn.style.color = '#198754';
        }
      });
      
      // Ensure it's the very first button in the stack
      wrap.insertBefore(btn, wrap.firstChild);
    }
`);

fs.writeFileSync('js/bundle-map.js', code);
