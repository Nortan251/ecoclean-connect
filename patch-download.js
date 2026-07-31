const fs = require('fs');

let appJs = fs.readFileSync('js/app.js', 'utf8');

// Insert a function to auto-download the captured image to the user's camera roll/gallery
const downloadFunc = `
function autoDownloadPhoto(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'EcoClean_Before_' + Date.now() + '.jpg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
`;

if (!appJs.includes('autoDownloadPhoto')) {
  appJs = appJs.replace(
    /window\.EcoReportMode = 'report';/,
    `${downloadFunc}\nwindow.EcoReportMode = 'report';`
  );
}

// Hook it into the photo input change event
appJs = appJs.replace(
  /\$\('#tabClean'\)\.addEventListener\('click',[\s\S]*?\{\}\);\n/,
  `$('#tabClean').addEventListener('click', () => { window.EcoReportMode = 'clean'; $('#tabClean').classList.add('active'); $('#tabReport').classList.remove('active'); $('#fieldAfterPhoto').classList.remove('hidden'); $('#fieldAfterPhoto input').required = true; $('#lblBeforePhoto').textContent = t('photo_before'); });
  
  // Auto-download the Before photo so they have it saved on their phone
  const photoInput = document.querySelector('#reportForm input[name="photo"]');
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0] && window.EcoReportMode === 'clean') {
        autoDownloadPhoto(e.target.files[0]);
        showToast(lang() === 'fr' ? 'Photo Avant sauvegardée dans votre galerie' : (lang() === 'ar' ? 'تم حفظ صورة "قبل" في معرض الصور' : 'Before photo saved to your gallery'));
      }
    });
  }

  $('#closeModal').addEventListener('click', closeModal);
  $('#reportForm').addEventListener('submit', handleReport);
  $('#useLoc').addEventListener('click', async () => {
    try {
      const [lat, lng] = await getLocation();
      $('#latInput').value = lat.toFixed(6);
      $('#lngInput').value = lng.toFixed(6);
      if (mapInited) map.setView([lat, lng], 15);
      showToast(t('location_set'));
    } catch {
      showToast(t('location_fail'));
    }
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
`
);

fs.writeFileSync('js/app.js', appJs);
