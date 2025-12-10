(function(){
  // Suppression des busy-waits synchrones et génération de "work" en tâches non bloquantes.

  // Génère une charge simulée en petits chunks pendant les périodes d'inactivité
  function generateWork(total = 200000, chunkSize = 5000) {
    let i = 0;
    // garder localement pour éviter fuite globale ; on libérera ensuite
    const buf = [];
    function doChunk(deadline) {
      const end = Math.min(i + chunkSize, total);
      for (; i < end; i++) {
        buf.push(Math.random() * i);
      }
      if (i < total) {
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(doChunk, { timeout: 500 });
        } else {
          setTimeout(doChunk, 0);
        }
      } else {
        // Travail terminé — libérer la mémoire rapidement pour ne pas garder un gros tableau
        setTimeout(() => { buf.length = 0; }, 1000);
      }
    }
    if (typeof requestIdleCallback === 'function') requestIdleCallback(doChunk, { timeout: 500 });
    else setTimeout(doChunk, 0);
  }

  // Non-bloquant : marquer images comme lazy et appliquer la classe 'loaded' quand prêtes
  function initImages() {
    const imgs = document.querySelectorAll('.card img');
    imgs.forEach(img => {
      try { img.setAttribute('loading', 'lazy'); } catch(e) {}
      if (img.complete) {
        img.classList.add('loaded');
      } else {
        img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
      }
    });
  }

  // Démarrage non bloquant : init images dès que DOM prêt, lancer la génération de charge en idle après load
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initImages();
  } else {
    document.addEventListener('DOMContentLoaded', initImages, { once: true });
  }

  window.addEventListener('load', () => {
    // Ne pas bloquer : générer la charge en arrière-plan par chunks
    generateWork(200000, 5000);
  });
})();
