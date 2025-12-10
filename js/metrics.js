/* metrics.js — widget d'évaluation des performances (client-side)
   Affiche FCP, LCP, CLS, TBT (~approx), #requêtes et poids total.
   N'emploie aucune dépendance externe. */
(function(){
  const state = {
    fcp: null,
    lcp: null,
    cls: 0,
    clsEntries: [],
    longTasks: 0,
    longTasksTime: 0,
    totalBlockingTime: 0,
    resources: [],
    totalRequests: 0,
    totalBytes: 0,
    nav: null
  };

  // Helper: formatters
  const fmtMs = v => (v==null?'-':v.toFixed(0)+' ms');
  const fmtKB = v => (v==null?'-':(v/1024).toFixed(1)+' KB');

  // Remplacer update() par une version throttlée/coalescée
  let panel, elems = null;
  let scheduled = false;
  let lastImmediate = 0;

  function collectResources(force) {
    // collecte coûteuse : ne faire que si appelé explicitement (bouton Mesurer) ou au load
    if (!force && state.resources && state.resources.length) return;
    const entries = performance.getEntriesByType('resource') || [];
    state.resources = entries;
    state.totalRequests = entries.length + 1;
    let total = 0;
    for (const r of entries) {
      const bytes = (r.transferSize && r.transferSize > 0) ? r.transferSize : (r.encodedBodySize || 0);
      total += bytes;
    }
    state.totalBytes = total;
  }

  function collectNavigation() {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) state.nav = nav;
  }

  function formatValues() {
    return {
      fcp: (state.fcp==null?'-':state.fcp.toFixed(0)+' ms'),
      lcp: (state.lcp==null?'-':state.lcp.toFixed(0)+' ms'),
      cls: state.cls ? state.cls.toFixed(3) : '-',
      tbt: state.totalBlockingTime ? (state.totalBlockingTime.toFixed(0)+' ms') : '-',
      req: String(state.totalRequests || '-'),
      bytes: state.totalBytes ? ((state.totalBytes/1024).toFixed(1)+' KB') : '-'
    };
  }

  // update léger qui ne recalcule pas les ressources sauf si force=true
  function doUpdate(forceResources) {
    collectNavigation();
    if (forceResources) collectResources(true);

    if (!panel) return;
    if (!elems) {
      elems = {
        fcp: panel.querySelector('#m-fcp'),
        lcp: panel.querySelector('#m-lcp'),
        cls: panel.querySelector('#m-cls'),
        tbt: panel.querySelector('#m-tbt'),
        req: panel.querySelector('#m-req'),
        bytes: panel.querySelector('#m-bytes')
      };
    }
    const v = formatValues();
    elems.fcp.textContent = v.fcp;
    elems.lcp.textContent = v.lcp;
    elems.cls.textContent = v.cls;
    elems.tbt.textContent = v.tbt;
    elems.req.textContent = v.req;
    elems.bytes.textContent = v.bytes;

    // exposer métriques
    window.__metrics = {
      fcp: state.fcp, lcp: state.lcp, cls: state.cls,
      tbtApprox: state.totalBlockingTime,
      totalRequests: state.totalRequests,
      totalBytes: state.totalBytes,
      navigation: state.nav
    };
  }

  // Coalescer les multiples appels à update via rAF + timeout de secours
  function scheduleUpdate(forceResources) {
    // forcer update immédiat si appelé très récemment (ex: bouton)
    const now = performance.now();
    if (forceResources || now - lastImmediate < 100) {
      lastImmediate = now;
      doUpdate(!!forceResources);
      return;
    }
    if (scheduled) return;
    scheduled = true;
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(()=>{
        scheduled = false;
        doUpdate(!!forceResources);
      });
    } else {
      setTimeout(()=>{
        scheduled = false;
        doUpdate(!!forceResources);
      }, 100);
    }
  }

  // Observers -> n'appellent plus update() directement mais scheduleUpdate()
  try{
    const poPaint = new PerformanceObserver((list)=>{
      for(const e of list.getEntries()){
        if(e.name === 'first-contentful-paint' && state.fcp == null){
          state.fcp = e.startTime;
          scheduleUpdate(false);
          poPaint.disconnect();
        }
      }
    });
    poPaint.observe({ type:'paint', buffered:true });
  }catch(err){}

  try{
    const poLcp = new PerformanceObserver((list)=>{
      for(const e of list.getEntries()){
        state.lcp = e.renderTime || e.loadTime || e.startTime;
      }
      scheduleUpdate(false);
    });
    poLcp.observe({ type:'largest-contentful-paint', buffered:true });
    addEventListener('visibilitychange', ()=>{
      if(document.visibilityState === 'hidden') poLcp.takeRecords();
    });
  }catch(err){}

  try{
    const poCls = new PerformanceObserver((list)=>{
      for(const e of list.getEntries()){
        if(!e.hadRecentInput){
          state.cls += e.value;
          state.clsEntries.push(e);
        }
      }
      scheduleUpdate(false);
    });
    poCls.observe({ type:'layout-shift', buffered:true });
  }catch(err){}

  try{
    const poLT = new PerformanceObserver((list)=>{
      for(const e of list.getEntries()){
        state.longTasks++;
        state.longTasksTime += e.duration;
        state.totalBlockingTime += Math.max(0, e.duration - 50);
      }
      scheduleUpdate(false);
    });
    poLT.observe({ entryTypes:['longtask'] });
  }catch(err){}

  // UI panel
  (function createPanel(){
    const p = document.createElement('div');
    p.setAttribute('id', 'perf-panel');
    Object.assign(p.style, {
      position:'fixed', right:'16px', bottom:'16px', zIndex:9999,
      width:'320px', maxWidth:'90vw', fontFamily:'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial',
      background:'rgba(10,12,28,.9)', color:'#E8ECF1', border:'1px solid rgba(255,255,255,.12)',
      borderRadius:'12px', boxShadow:'0 10px 40px rgba(0,0,0,.5)',
      backdropFilter:'blur(6px) saturate(120%)', padding:'12px 14px'
    });
    p.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
        <strong style="letter-spacing:.2px">Évaluation perfs</strong>
        <div>
          <button id="perf-refresh" style="background:#7C5CFF;color:white;border:0;border-radius:8px;padding:6px 10px;cursor:pointer">Mesurer</button>
          <button id="perf-close" style="background:transparent;color:#c9d1d9;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:6px 8px;margin-left:6px;cursor:pointer">×</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
        <div><div style="opacity:.8">FCP</div><div id="m-fcp" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">LCP</div><div id="m-lcp" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">CLS</div><div id="m-cls" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">TBT (≈)</div><div id="m-tbt" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">Requêtes</div><div id="m-req" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">Poids total</div><div id="m-bytes" style="font-weight:600">-</div></div>
      </div>
      <div style="margin-top:8px;font-size:12px;opacity:.8">
        <div id="m-note">Cliquez sur <em>Mesurer</em> après vos modifications.</div>
      </div>
    `;
    document.addEventListener('DOMContentLoaded', ()=>{
      document.body.appendChild(p);
      panel = p;
      // initial render légère
      scheduleUpdate(true);
    }, { once: true });
  })();

  // Actions : bouton Mesurer doit forcer recollecte des ressources
  document.addEventListener('click', (e)=>{
    if(e.target && e.target.id==='perf-refresh'){
      // collecte complète et update immédiat
      collectResources(true);
      scheduleUpdate(true);
    }
    if(e.target && e.target.id==='perf-close'){
      if (panel) panel.remove();
      panel = null;
      elems = null;
    }
  });

  // Mise à jour initiale après load (collecte ressources une fois)
  addEventListener('load', ()=>{
    collectResources(true);
    scheduleUpdate(true);
  });
})();
