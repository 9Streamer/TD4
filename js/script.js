(function(){
  // Suppression des boucles bloquantes et génération de "work" en tâches non bloquantes.

  // Si le code d'origine créait une "charge" pour test, on la remplace par un traitement par chunks
  function generateWork(total = 200000, chunkSize = 5000) {
    let i = 0;
    // buffer local, libéré quand terminé
    const buf = [];
    function doChunk(deadline) {
      const end = Math.min(i + chunkSize, total);
      for (; i < end; i++) {
        buf.push(Math.random() * i);
      }
      if (i < total) {
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(doChunk, { timeout: 200 });
        } else {
          setTimeout(doChunk, 0);
        }
      } else {
        // libération mémoire rapide
        setTimeout(() => { buf.length = 0; }, 500);
      }
    }
    if (typeof requestIdleCallback === 'function') requestIdleCallback(doChunk, { timeout: 200 });
    else setTimeout(doChunk, 0);
  }

  // Non-bloquant : marquer images comme lazy et appliquer la classe 'loaded' après décodage
  function initImages() {
    const imgs = document.querySelectorAll('.card img');
    imgs.forEach(img => {
      try { img.setAttribute('loading', 'lazy'); } catch(e) {}
      if (img.complete) {
        // attempt decode to ensure the image is actually painted before marking loaded
        if (img.decode) {
          img.decode().then(()=> img.classList.add('loaded')).catch(()=> img.classList.add('loaded'));
        } else {
          img.classList.add('loaded');
        }
      } else {
        img.addEventListener('load', () => {
          if (img.decode) {
            img.decode().then(()=> img.classList.add('loaded')).catch(()=> img.classList.add('loaded'));
          } else {
            img.classList.add('loaded');
          }
        }, { once: true });
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
    // Génération de charge en arrière-plan; si c'était juste du test, vous pouvez commenter cette ligne.
    generateWork(200000, 5000);
  });
})();
