// ═══ Fortunetelling API Bridge ═══
// Replaces pywebview.api with fetch() calls to Flask backend
(function () {
  'use strict';

  // Map old pywebview method names to Flask endpoints
  const API_MAP = {
    meihua_divine:   { url: '/fortune/api/meihua',    map: (n1, n2, n3) => ({ n1, n2, n3 }) },
    bazi_calculate:  { url: '/fortune/api/bazi',       map: (y, m, d, h, min) => ({ year: y, month: m, day: d, hour: h, minute: min }) },
    ziwei_calculate: { url: '/fortune/api/ziwei',      map: (y, m, d, h, min, g) => ({ year: y, month: m, day: d, hour: h, minute: min, gender: g }) },
    yijing_cast:     { url: '/fortune/api/yijing',      map: (manual) => ({ manual_lines: manual }) },
    tarot_draw:      { url: '/fortune/api/tarot',       map: (spread) => ({ spread }) },
    astrology_chart: { url: '/fortune/api/astrology',   map: (y, m, d, h, min, lat, lng, tz) => ({ year: y, month: m, day: d, hour: h, minute: min, lat, lng, tz }) },
  };

  async function callApi(method, ...args) {
    const cfg = API_MAP[method];
    if (!cfg) {
      console.error('Unknown API method:', method);
      return { error: 'Unknown method: ' + method };
    }
    try {
      const body = cfg.map(...args);
      const resp = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return await resp.json();
    } catch (err) {
      console.error('API error:', err);
      return { error: err.message };
    }
  }

  // Global helpers (matching Fortunetelling's FT namespace)
  window.FT = {
    callApi,
    renderResult(id, html) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    },
    escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = String(str);
      return div.innerHTML;
    },
  };
})();
