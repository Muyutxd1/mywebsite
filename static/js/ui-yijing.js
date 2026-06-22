// ═══ 易经 UI ═══
let yjManualCount = 0;
let yjManualLines = [];

function initYijing() {
  yjManualCount = 0;
  yjManualLines = [];
}

async function doYijingCast() {
  const data = await FT.callApi('yijing_cast');
  renderYijingResult(data);
}

function resetYijingManual() {
  yjManualCount = 0;
  yjManualLines = [];
  document.getElementById('yj-manual').style.display = 'block';
  document.getElementById('yj-step-label').textContent = '第 1/6 次：';
  document.getElementById('yj-manual-progress').textContent = '';
  FT.renderResult('yijing-result', '');
}

function yjManualToss(heads) {
  yjManualLines.push(heads);
  yjManualCount++;
  if (yjManualCount < 6) {
    document.getElementById('yj-step-label').textContent = `第 ${yjManualCount+1}/6 次：`;
    const prevHeads = yjManualLines[yjManualLines.length-1];
    const types = {3:'三正(老阳⚊○)', 2:'两正一反(少阴⚋)', 1:'两反一正(少阳⚊)', 0:'三反(老阴⚋×)'};
    document.getElementById('yj-manual-progress').textContent +=
      `第${yjManualCount}次：${types[prevHeads]} | `;
  } else {
    document.getElementById('yj-manual').style.display = 'none';
    FT.callApi('yijing_cast', yjManualLines).then(renderYijingResult);
  }
}

function renderYijingResult(data) {
  if (!data || data.error) {
    FT.renderResult('yijing-result', `<p style="color:#e74c3c">出错了：${(data||{}).error||'未知错误'}</p>`);
    return;
  }

  const { tosses, original_lines, changed_lines, changing_yang, changing_yin, has_changes, interpretation } = data;
  let html = '';

  // Six lines display
  html += '<div style="text-align:center;margin-bottom:16px">';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">六爻（从下往上）</div>';
  const positionNames = ['上', '五', '四', '三', '二', '初'];
  for (let i = 5; i >= 0; i--) {
    const t = tosses[i];
    const isChanging = t.value === 9 || t.value === 6;
    const isYang = t.value === 7 || t.value === 9;
    const lineWidth = 120;
    const gap = isYang ? 0 : 20;

    html += `<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin:4px 0">`;
    html += `<span style="font-size:12px;color:var(--text-muted);width:24px">${positionNames[i]}</span>`;
    if (isYang) {
      // Solid yang line
      html += `<div style="width:${lineWidth}px;height:8px;background:${isChanging?'var(--accent)':'var(--text)'};border-radius:4px;${isChanging?'box-shadow:0 0 8px var(--accent)':''}"></div>`;
    } else {
      // Broken yin line
      html += `<div style="display:flex;gap:${gap}px">`;
      html += `<div style="width:${(lineWidth-gap)/2}px;height:8px;background:${isChanging?'var(--accent)':'var(--text)'};border-radius:4px;${isChanging?'box-shadow:0 0 8px var(--accent)':''}"></div>`;
      html += `<div style="width:${(lineWidth-gap)/2}px;height:8px;background:${isChanging?'var(--accent)':'var(--text)'};border-radius:4px;${isChanging?'box-shadow:0 0 8px var(--accent)':''}"></div>`;
      html += `</div>`;
    }
    html += `<span style="font-size:11px;color:var(--text-muted);width:50px">${t.symbol} ${t.type}</span>`;
    if (isChanging) html += `<span class="tag tag-accent">动</span>`;
    html += `</div>`;
  }
  html += '</div>';

  // Changing lines summary
  if (has_changes) {
    html += `<div style="text-align:center;margin-bottom:12px">`;
    html += `<span style="font-size:13px;color:var(--text-secondary)">动爻：</span>`;
    if (changing_yang.length) html += `<span class="tag tag-accent">第${changing_yang.join('、')}爻 老阳→阴</span> `;
    if (changing_yin.length) html += `<span class="tag tag-accent">第${changing_yin.join('、')}爻 老阴→阳</span>`;
    html += `</div>`;
  } else {
    html += `<div style="text-align:center;margin-bottom:12px"><span class="tag tag-default">六爻安静</span></div>`;
  }

  // Interpretation text
  if (interpretation) {
    html += `<div style="white-space:pre-line;font-size:14px;line-height:1.8">${FT.escapeHtml(interpretation)}</div>`;
  }

  FT.renderResult('yijing-result', html);
}
