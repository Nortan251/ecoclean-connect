const fs = require('fs');

let code = fs.readFileSync('js/bundle-map.js', 'utf8');

// We need to patch installProxy
// Replace `cluster.addLayer(m);` with:
/*
        if (!cluster._pendingMarkers) {
          cluster._pendingMarkers = [];
          queueMicrotask(() => {
            if (cluster._pendingMarkers.length) {
              cluster.addLayers(cluster._pendingMarkers);
              cluster._pendingMarkers = [];
            }
          });
        }
        cluster._pendingMarkers.push(m);
*/

code = code.replace(
  /cluster\.addLayer\(m\);/,
  `if (!cluster._pendingMarkers) { cluster._pendingMarkers = []; setTimeout(() => { if (cluster._pendingMarkers.length) { cluster.addLayers(cluster._pendingMarkers); cluster._pendingMarkers = []; } }, 10); } cluster._pendingMarkers.push(m);`
);

fs.writeFileSync('js/bundle-map.js', code);
