// ═══ 梅花易数 UI ═══
function initMeihua() {
  // no-op, all interaction via global functions
}

async function doMeihua() {
  const n1 = parseInt(document.getElementById('mh-n1').value) || 0;
  const n2 = parseInt(document.getElementById('mh-n2').value) || 0;
  const n3 = parseInt(document.getElementById('mh-n3').value) || 0;

  if (!n1 || !n2 || !n3) {
    FT.renderResult('meihua-result', '<p style="color:#e74c3c">请输入三个数字</p>');
    return;
  }

  const data = await FT.callApi('meihua_divine', n1, n2, n3);
  renderMeihuaResult(data);
}

function randomMeihua() {
  document.getElementById('mh-n1').value = Math.floor(Math.random() * 99) + 1;
  document.getElementById('mh-n2').value = Math.floor(Math.random() * 99) + 1;
  document.getElementById('mh-n3').value = Math.floor(Math.random() * 99) + 1;
  doMeihua();
}

function renderMeihuaResult(data) {
  if (!data || data.error) {
    FT.renderResult('meihua-result', `<p style="color:#e74c3c">出错了：${(data||{}).error||'未知错误'}</p>`);
    return;
  }

  const { numbers, upper_gua, lower_gua, changing_line, ti_gua, yong_gua,
          ti_wuxing, yong_wuxing, ti_yong_relation, ti_yong_msg,
          ben_gua, hu_gua, bian_gua, interpretation } = data;

  let html = '';

  // Numbers display
  html += `<div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap">`;
  html += `<div class="tag tag-accent">上卦数：${numbers[0]} → ${upper_gua}</div>`;
  html += `<div class="tag tag-accent">下卦数：${numbers[1]} → ${lower_gua}</div>`;
  html += `<div class="tag tag-accent">动爻数：${numbers[2]} → 第${changing_line}爻</div>`;
  html += `</div>`;

  // Gua symbols — big display
  const bagua_symbols = {'乾':'☰','兑':'☱','离':'☲','震':'☳','巽':'☴','坎':'☵','艮':'☶','坤':'☷'};
  const up_sym = bagua_symbols[upper_gua] || '';
  const lo_sym = bagua_symbols[lower_gua] || '';

  html += `<div style="text-align:center;font-size:80px;line-height:1.2;margin:16px 0;color:var(--accent)">`;
  html += `<div>${up_sym}</div>`;
  html += `<div style="font-size:14px;color:var(--text-secondary)">${upper_gua}上${lower_gua}下</div>`;
  html += `<div>${lo_sym}</div>`;
  html += `</div>`;

  // Hexagram names
  html += `<div class="grid-3" style="margin-bottom:16px">`;
  html += hexCard('本卦', ben_gua, '当前状态');
  html += hexCard('互卦', hu_gua, '中间过程');
  html += hexCard('变卦', bian_gua, '发展趋势');
  html += `</div>`;

  // Ti-Yong
  const relColor = ti_yong_relation === '生' ? '#27ae60' :
                   ti_yong_relation === '克' ? '#e74c3c' :
                   ti_yong_relation === '被克' ? '#f39c12' : '#7f8c8d';
  html += `<div style="background:var(--accent-light);border-radius:var(--radius);padding:16px 20px;margin-bottom:16px">`;
  html += `<strong>体用生克：</strong>`;
  html += `<span>体卦${ti_gua}(${ti_wuxing}) — 用卦${yong_gua}(${yong_wuxing})</span>`;
  html += `<span style="color:${relColor};font-weight:600;margin-left:8px">${ti_yong_relation}</span>`;
  html += `<p style="margin-top:8px;font-size:13px">${ti_yong_msg}</p>`;
  html += `</div>`;

  // Interpretation text
  if (interpretation) {
    html += `<div style="white-space:pre-line;font-size:14px;line-height:1.8;color:var(--text)">${FT.escapeHtml(interpretation)}</div>`;
  }

  FT.renderResult('meihua-result', html);
}

function hexCard(label, gua, subtitle) {
  if (!gua) return `<div class="card"><div class="card-title">${label}</div><p style="color:var(--text-muted)">——</p></div>`;
  return `<div class="card" style="text-align:center">
    <div class="card-title">${label}</div>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px">${subtitle}</div>
    <div style="font-size:24px;font-weight:700;color:var(--accent)">${FT.escapeHtml(gua.name)}</div>
    <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${FT.escapeHtml(gua.short||'')}</div>
  </div>`;
}
