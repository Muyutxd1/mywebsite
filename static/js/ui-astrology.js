// ═══ 占星 UI ═══
function initAstrology() {}

async function doAstrology() {
  const year = parseInt(document.getElementById('as-year').value);
  const month = parseInt(document.getElementById('as-month').value);
  const day = parseInt(document.getElementById('as-day').value);
  const hour = parseInt(document.getElementById('as-hour').value);
  const minute = parseInt(document.getElementById('as-minute').value) || 0;
  const lat = parseFloat(document.getElementById('as-lat').value);
  const lng = parseFloat(document.getElementById('as-lng').value);
  const tz = parseInt(document.getElementById('as-tz').value);

  if (!year || !month || !day) {
    FT.renderResult('astrology-result', '<p style="color:#e74c3c">请输入完整的出生日期</p>');
    return;
  }

  const data = await FT.callApi('astrology_chart', year, month, day, hour, minute, lat, lng, tz);
  renderAstrologyResult(data);
}

function renderAstrologyResult(data) {
  if (!data || data.error) {
    FT.renderResult('astrology-result', `<p style="color:#e74c3c">出错了：${(data||{}).error||'未知错误'}</p>`);
    return;
  }

  const { planets, ascendant, mc, aspects, element_count, dominant_sign, interpretation } = data;
  let html = '';

  // Big Three
  const sun = planets.find(p => p.name === '太阳');
  const moon = planets.find(p => p.name === '月亮');
  html += `<div class="grid-3" style="margin-bottom:16px">`;
  html += bigThreeCard('☀ 太阳', sun, '#f39c12');
  html += bigThreeCard('☽ 月亮', moon, '#3498db');
  html += bigThreeCard('↑ 上升', {sign: ascendant.sign, house: 1}, '#9b59b6');
  html += `</div>`;

  // Planets table
  html += '<table class="data-table"><thead><tr><th>行星</th><th>星座</th><th>宫位</th><th>黄经</th></tr></thead><tbody>';
  for (const p of planets) {
    html += `<tr>
      <td style="font-weight:600">${FT.escapeHtml(p.name)}</td>
      <td>${FT.escapeHtml(p.sign)}座</td>
      <td>第${p.house}宫</td>
      <td style="font-size:11px;color:var(--text-muted)">${p.longitude}°</td>
    </tr>`;
  }
  html += '</tbody></table>';

  // Elements
  html += `<div style="display:flex;gap:16px;margin:16px 0;flex-wrap:wrap">`;
  const elColors = {火:'#e74c3c',土:'#27ae60',风:'#f39c12',水:'#3498db'};
  for (const [el, count] of Object.entries(element_count||{})) {
    html += `<span class="tag" style="background:${elColors[el]}22;color:${elColors[el]}">${el}象 ${count}颗</span>`;
  }
  html += `<span class="tag tag-accent">主导：${FT.escapeHtml(dominant_sign||'')}座</span>`;
  html += `</div>`;

  // Aspects
  if (aspects && aspects.length > 0) {
    html += '<div style="margin-bottom:16px"><strong>主要相位</strong></div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    for (const a of aspects) {
      html += `<span class="tag tag-default">${FT.escapeHtml(a.p1)} ${a.symbol} ${FT.escapeHtml(a.p2)} (${a.aspect})</span>`;
    }
    html += '</div>';
  }

  // Interpretation
  if (interpretation) {
    html += `<div style="margin-top:16px;white-space:pre-line;font-size:14px;line-height:1.8">${FT.escapeHtml(interpretation)}</div>`;
  }

  FT.renderResult('astrology-result', html);
}

function bigThreeCard(label, planet, color) {
  if (!planet) return '';
  return `<div style="text-align:center;padding:16px;background:var(--bg-card);border-radius:var(--radius);box-shadow:var(--shadow-sm)">
    <div style="font-size:20px">${label}</div>
    <div style="font-size:24px;font-weight:700;color:${color};margin-top:4px">${FT.escapeHtml(planet.sign)}座</div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:2px">第${planet.house}宫</div>
  </div>`;
}
