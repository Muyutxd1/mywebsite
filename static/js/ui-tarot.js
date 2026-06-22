// ═══ 塔罗牌 UI ═══
function initTarot() {}

async function doTarotDraw() {
  const spread = document.getElementById('tarot-spread').value;
  const data = await FT.callApi('tarot_draw', spread);
  renderTarotResult(data);
}

function renderTarotResult(data) {
  if (!data || data.error) {
    FT.renderResult('tarot-result', `<p style="color:#e74c3c">出错了：${(data||{}).error||'未知错误'}</p>`);
    return;
  }

  const { spread_name, cards, interpretation } = data;
  let html = '';

  html += `<div style="margin-bottom:16px;font-size:14px;color:var(--text-secondary)">牌阵：${FT.escapeHtml(spread_name)}</div>`;

  // Cards display
  for (const card of cards) {
    const borderColor = card.is_upright ? 'var(--accent)' : '#e74c3c';
    html += `<div style="border-left:3px solid ${borderColor};background:var(--bg-card);border-radius:var(--radius-sm);padding:16px 20px;margin-bottom:12px;box-shadow:var(--shadow-sm)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
        <div>
          <span style="font-size:12px;color:var(--text-muted);text-transform:uppercase">${FT.escapeHtml(card.position)}</span>
          <span style="font-size:18px;font-weight:700;margin-left:8px">${FT.escapeHtml(card.name_cn)}</span>
          <span style="font-size:12px;color:var(--text-muted);margin-left:6px">${FT.escapeHtml(card.name_en)}</span>
        </div>
        <span class="tag" style="background:${card.is_upright?'var(--accent-light)':'#fde8e8'};color:${card.is_upright?'var(--accent)':'#e74c3c'}">${card.orientation}</span>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${FT.escapeHtml(card.type)}</div>
      ${card.keywords && card.keywords.length ? `<div style="margin-bottom:8px">${card.keywords.map(k => `<span class="tag tag-default">${FT.escapeHtml(k)}</span>`).join(' ')}</div>` : ''}
      <p style="font-size:14px;line-height:1.7;color:var(--text)">${FT.escapeHtml(card.interpretation)}</p>
    </div>`;
  }

  // Spread interpretation
  if (interpretation) {
    html += `<div style="white-space:pre-line;font-size:14px;line-height:1.8;margin-top:8px;color:var(--text-secondary)">${FT.escapeHtml(interpretation)}</div>`;
  }

  FT.renderResult('tarot-result', html);
}
