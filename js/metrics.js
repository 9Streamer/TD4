(function() {
  const state = {
    fcp: null,
    lcp: null,
    cls: 0,
    totalBlockingTime: 0,
    totalRequests: 0,
    totalBytes: 0
  };

  const fmtMs = v => (v == null ? '-' : v.toFixed(0) + ' ms');
  const fmtKB = v => (v == null ? '-' : (v / 1024).toFixed(1) + ' KB');

  // Observer FCP
  try {
    const poPaint = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.name === 'first-contentful-paint' && state.fcp == null) {
          state.fcp = e.startTime;
          update();
          poPaint.disconnect();
        }
      }
    });
    poPaint.observe({ type: 'paint', buffered: true });
  } catch (err) {}

  // Observer LCP
  try {
    const poLcp = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        state.lcp = e.renderTime || e.loadTime || e.startTime;
      }
      update();
    });
    poLcp.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (err) {}

  // Observer CLS
  try {
    const poCls = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) {
          state.cls += e.value;
        }
      }
      update();
    });
    poCls.observe({ type: 'layout-shift', buffered: true });
  } catch (err) {}

  // Observer Long Tasks
  try {
    const poLT = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        state.totalBlockingTime += Math.max(0, e.duration - 50);
      }
      update();
    });
    poLT.observe({ entryTypes: ['longtask'] });
  } catch (err) {}

  function collectResources() {
    const entries = performance.getEntriesByType('resource');
    state.totalRequests = entries.length + 1;
    let total = 0;
    for (const r of entries) {
      const bytes = (r.transferSize && r.transferSize > 0) ? r.transferSize : (r.encodedBodySize || 0);
      total += bytes;
    }
    state.totalBytes = total;
  }

  function update() {
    collectResources();
    document.getElementById('m-fcp').textContent = fmtMs(state.fcp);
    document.getElementById('m-lcp').textContent = fmtMs(state.lcp);
    document.getElementById('m-cls').textContent = state.cls ? state.cls.toFixed(3) : '-';
    document.getElementById('m-tbt').textContent = state.totalBlockingTime ? fmtMs(state.totalBlockingTime) : '-';
    document.getElementById('m-req').textContent = String(state.totalRequests || '-');
    document.getElementById('m-bytes').textContent = state.totalBytes ? fmtKB(state.totalBytes) : '-';
    
    window.__metrics = {
      fcp: state.fcp,
      lcp: state.lcp,
      cls: state.cls,
      tbtApprox: state.totalBlockingTime,
      totalRequests: state.totalRequests,
      totalBytes: state.totalBytes
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('perf-refresh').addEventListener('click', update);
    document.getElementById('perf-close').addEventListener('click', () => {
      document.getElementById('perf-panel').remove();
    });
  });

  window.addEventListener('load', () => setTimeout(update, 0));
})();