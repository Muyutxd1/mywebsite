// ═══ 八字排盘 UI ═══
function initBazi() {}

async function doBazi() {
  const year = parseInt(document.getElementById('bz-year').value);
  const month = parseInt(document.getElementById('bz-month').value);
  const day = parseInt(document.getElementById('bz-day').value);
  const hour = parseInt(document.getElementById('bz-hour').value);
  const minute = parseInt(document.getElementById('bz-minute').value) || 0;

  if (!year || !month || !day) {
    FT.renderResult('bazi-result', '<p style="color:#e74c3c">请输入完整的出生日期</p>');
    return;
  }

  const data = await FT.callApi('bazi_calculate', year, month, day, hour, minute);
  renderBaziResult(data);
}

function renderBaziResult(data) {
  if (!data || data.error) {
    FT.renderResult('bazi-result', `<p style="color:#e74c3c">出错了：${(data||{}).error||'未知错误'}</p>`);
    return;
  }

  const { pillars, day_master, day_master_wuxing, wuxing_count, interpretation } = data;
  let html = '';

  // Four pillars table
  html += '<table class="data-table"><thead><tr>';
  html += '<th></th><th>年柱</th><th>月柱</th><th>日柱</th><th>时柱</th>';
  html += '</tr></thead><tbody>';

  // Gan-Zhi row
  html += '<tr><td style="font-weight:600">天干地支</td>';
  for (const k of ['year','month','day','hour']) {
    const p = pillars[k];
    html += `<td><b>${p.full}</b><br><span style="font-size:11px;color:var(--text-secondary)">${p.gan}(${p.gan_wuxing}) ${p.zhi}(${p.zhi_wuxing})</span></td>`;
  }
  html += '</tr>';

  // Hidden stems
  html += '<tr><td style="font-weight:600">藏干</td>';
  for (const k of ['year','month','day','hour']) {
    html += `<td><span style="font-size:11px">${pillars[k].zhi_canggan.join(' ')}</span></td>`;
  }
  html += '</tr>';

  // Shi Shen
  html += '<tr><td style="font-weight:600">十神</td>';
  for (const k of ['year','month','day','hour']) {
    html += `<td><span class="tag tag-accent">${pillars[k].shishen}</span></td>`;
  }
  html += '</tr>';

  // Nayin
  html += '<tr><td style="font-weight:600">纳音</td>';
  for (const k of ['year','month','day','hour']) {
    html += `<td><span style="font-size:11px;color:var(--text-muted)">${pillars[k].nayin}</span></td>`;
  }
  html += '</tr>';

  html += '</tbody></table>';

  // Day master highlight
  html += `<div style="text-align:center;padding:16px;margin:16px 0;background:var(--accent-light);border-radius:var(--radius)">`;
  html += `<span style="font-size:13px;color:var(--text-secondary)">日主 · 你</span><br>`;
  html += `<span style="font-size:28px;font-weight:700;color:var(--accent)">${day_master}</span>`;
  html += `<span style="font-size:14px;color:var(--text-secondary)">（${day_master_wuxing}命）</span>`;
  html += `</div>`;

  // Wuxing bar chart (text-based)
  html += '<div style="margin-bottom:16px"><strong>五行分布</strong></div>';
  const wuxingNames = ['木','火','土','金','水'];
  const wuxingColors = {木:'#27ae60',火:'#e74c3c',土:'#f39c12',金:'#f1c40f',水:'#3498db'};
  const total = Object.values(wuxing_count).reduce((a,b)=>a+b,0);
  html += '<div class="grid-3" style="gap:8px">';
  for (const wx of wuxingNames) {
    const count = wuxing_count[wx] || 0;
    const pct = total > 0 ? (count/total*100) : 0;
    html += `<div style="text-align:center">
      <div style="font-size:12px;color:var(--text-secondary)">${wx}</div>
      <div style="background:var(--bg-input);border-radius:4px;height:6px;margin:4px 0">
        <div style="background:${wuxingColors[wx]};width:${pct}%;height:100%;border-radius:4px"></div>
      </div>
      <div style="font-size:13px;font-weight:600">${count}</div>
    </div>`;
  }
  html += '</div>';

  // Interpretation
  if (interpretation) {
    html += `<div style="margin-top:20px;white-space:pre-line;font-size:14px;line-height:1.8">${FT.escapeHtml(interpretation)}</div>`;
  }

  FT.renderResult('bazi-result', html);
}
