/* ============================================================================
 * confetti.js — Zero-dependency Dopamine Hit (Enhancement)
 * ----------------------------------------------------------------------------
 * A highly optimized, lightweight canvas confetti cannon. Used to reward users
 * visually when they self-clean a site, claim a quest, or when an admin verifies.
 * Automatically cleans up its own DOM node to prevent memory leaks.
 * ==========================================================================*/
(function () {
  'use strict';
  window.EcoConfetti = {
    fire: function() {
      const colors = ['#22c07e', '#10b981', '#f59e0b', '#0ea5e9', '#ef4444', '#ffffff'];
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;';
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth; 
      canvas.height = window.innerHeight;
      
      const pieces = Array.from({length: 120}).map(() => ({
        x: canvas.width / 2, 
        y: canvas.height / 2 + 100, // Explode from middle-bottom
        vx: (Math.random() - 0.5) * 35, 
        vy: (Math.random() - 1) * 25 - 5,
        size: Math.random() * 12 + 6, 
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * 360, 
        rotSpeed: (Math.random() - 0.5) * 20
      }));
      
      let start = Date.now();
      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;
        pieces.forEach(p => {
          p.x += p.vx; 
          p.y += p.vy; 
          p.vy += 0.8; // Gravity
          p.vx *= 0.96; // Air resistance/friction
          p.rot += p.rotSpeed;
          if (p.y < canvas.height + 50) active = true;
          
          ctx.save(); 
          ctx.translate(p.x, p.y); 
          ctx.rotate(p.rot * Math.PI/180);
          ctx.fillStyle = p.color; 
          ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
          ctx.restore();
        });
        
        if (active && Date.now() - start < 5000) {
          requestAnimationFrame(draw);
        } else {
          canvas.remove();
        }
      }
      requestAnimationFrame(draw);
    }
  };
})();
