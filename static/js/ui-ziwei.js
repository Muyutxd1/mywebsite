// ═══ 紫微斗数 UI ═══
function initZiwei() {}

async function doZiwei() {
  const year = parseInt(document.getElementById('zw-year').value);
  const month = parseInt(document.getElementById('zw-month').value);
  const day = parseInt(document.getElementById('zw-day').value);
  const hour = parseInt(document.getElementById('zw-hour').value);
  const minute = parseInt(document.getElementById('zw-minute').value) || 0;
  const gender = document.getElementById('zw-gender').value;

  if (!year || !month || !day) {
    FT.renderResult('ziwei-result', '<p style="color:#e74c3c">请输入完整的出生日期</p>');
    return;
  }

  const data = await FT.callApi('ziwei_calculate', year, month, day, hour, minute, gender);
  renderZiweiResult(data);
}

function renderZiweiResult(data) {
  if (!data || data.error) {
    FT.renderResult('ziwei-result', `<p style="color:#e74c3c">出错了：${(data||{}).error||'未知错误'}</p>`);
    return;
  }

  const { birth_info, palaces, ming_palace, shen_palace, sihua, interpretation } = data;
  let html = '';

  // Birth info
  html += `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">`;
  html += `<span class="tag tag-default">${birth_info.year_gan}${birth_info.year_zhi}年</span>`;
  html += `<span class="tag tag-default">${birth_info.month_zhi}月</span>`;
  html += `<span class="tag tag-default">${birth_info.day_gan}${birth_info.day_zhi}日</span>`;
  html += `<span class="tag tag-default">${birth_info.hour_zhi}时</span>`;
  html += `</div>`;

  // Twelve Palaces Grid (3x4)
  html += '<div class="grid-3" style="gap:8px;margin-bottom:16px">';
  for (const p of palaces) {
    const isMing = p.is_ming;
    const isShen = p.is_shen;
    const borderColor = isMing ? 'var(--accent)' : 'var(--border-light)';
    const bgColor = isMing ? 'var(--accent-light)' : 'var(--bg-card)';
    html += `<div style="border:2px solid ${borderColor};background:${bgColor};border-radius:var(--radius-sm);padding:10px;text-align:center">
      <div style="font-size:11px;font-weight:600;color:var(--text-secondary)">${p.name}${isMing?' 📍':''}${isShen?' 🏠':''}</div>
      <div style="font-size:12px;font-weight:700;color:var(--accent);margin-top:4px;min-height:18px">
        ${p.stars.length ? p.stars.join(' ') : '<span style="color:var(--text-muted);font-weight:400">—</span>'}
      </div>
    </div>`;
  }
  html += '</div>';

  // Sihua
  if (sihua && Object.keys(sihua).length > 0) {
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">';
    const huaIcons = {禄:'✨',权:'👑',科:'📚',忌:'⚠️'};
    for (const [star, hua] of Object.entries(sihua)) {
      html += `<span class="tag tag-accent">${star}化${hua} ${huaIcons[hua]||''}</span>`;
    }
    html += '</div>';
  }

  // Interpretation
  if (interpretation) {
    html += `<div style="white-space:pre-line;font-size:14px;line-height:1.8">${FT.escapeHtml(interpretation)}</div>`;
  }

  FT.renderResult('ziwei-result', html);
}
