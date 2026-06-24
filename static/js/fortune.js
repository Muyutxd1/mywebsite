// ═══ 灵占 · Fortunetelling (unified UI) ═══
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; };

  // ── 解读文本 → 结构化分段 ────────────────────
  // 把后端的「【标题】正文…」文本解析为干净的段落块。
  function parseSections(text) {
    const blocks = [];
    let cur = null;
    String(text || '').split('\n').forEach((raw) => {
      const line = raw.replace(/\s+$/, '');
      const m = line.match(/^【(.+?)】(.*)$/);
      if (m) {
        cur = { title: m[1], lines: [] };
        blocks.push(cur);
        if (m[2].trim()) cur.lines.push(m[2].trim());
      } else if (line.trim()) {
        if (!cur) { cur = { title: '', lines: [] }; blocks.push(cur); }
        cur.lines.push(line.trim());
      }
    });
    return blocks;
  }

  function renderReading(text) {
    const blocks = parseSections(text);
    if (!blocks.length) return '';
    let html = '<div class="fx-reading">';
    for (const b of blocks) {
      if (b.title) html += `<h4 class="fx-sec">${esc(b.title)}</h4>`;
      for (const ln of b.lines) {
        const note = /^[✨💫🔮]/.test(ln);
        html += `<p class="fx-p${note ? ' note' : ''}">${esc(ln)}</p>`;
      }
    }
    return html + '</div>';
  }

  const card = (inner) => `<div class="fx-card">${inner}</div>`;
  const chips = (arr) => `<div class="fx-chips">${arr.join('')}</div>`;
  const chip = (t, cls = '') => `<span class="fx-chip ${cls}">${esc(t)}</span>`;

  // 五行配色
  const WX = { 木: '#3f9a6d', 火: '#d1604f', 土: '#c79a4b', 金: '#b7913f', 水: '#3f78a8' };
  const fortuneClass = (f) => ({ '吉': 'good', '小吉': 'good', '平': 'flat', '小凶': 'warn', '凶': 'bad' }[f] || 'flat');

  function setResult(id, html) { const el = $('#' + id); if (el) el.innerHTML = html; }
  function loading(id) { setResult(id, '<div class="fx-loading">正在推演…</div>'); }
  function fail(id, msg) { setResult(id, `<div class="fx-error">出错了：${esc(msg || '未知错误')}</div>`); }

  // ── 卦象可视化（六爻，自下而上）────────────────
  function hexLines(lines, movingPositions) {
    const mv = new Set(movingPositions || []);
    let html = '<div class="fx-hex">';
    for (let i = 5; i >= 0; i--) {
      const yang = lines[i] === 1;
      const moving = mv.has(i + 1);
      html += `<div class="fx-yao${moving ? ' moving' : ''}">` +
        (yang ? '<i class="bar"></i>' : '<i class="bar half"></i><i class="bar half"></i>') +
        '</div>';
    }
    return html + '</div>';
  }

  function guaTag(g, label) {
    if (!g) return '';
    return `<div class="fx-gua"><span class="fx-gua-label">${label}</span>` +
      `<span class="fx-gua-name">${esc(g.name)}</span>` +
      `<span class="fx-gua-sym">${esc((g.upper_symbol || '') + (g.lower_symbol || ''))}</span></div>`;
  }

  // ═══ 渲染器 ═══════════════════════════════════
  const RENDER = {
    meihua(d) {
      const [n1, n2, n3] = d.numbers;
      let head = card(
        `<div class="fx-row">
           ${chip(`上卦 ${n1} → ${d.upper_symbol}${d.upper_gua}`)}
           ${chip(`下卦 ${n2} → ${d.lower_symbol}${d.lower_gua}`)}
           ${chip(`动爻 第 ${d.changing_line} 爻`)}
         </div>
         ${hexLines(d.ben_gua.lines, [d.changing_line])}
         <div class="fx-guas">
           ${guaTag(d.ben_gua, '本卦')}${guaTag(d.hu_gua, '互卦')}${guaTag(d.bian_gua, '变卦')}
         </div>
         <div class="fx-verdict ${fortuneClass(d.ti_yong_fortune)}">
           <b>${esc(d.ti_yong_relation)}</b> · ${esc(d.ti_yong_fortune)}
           <span>体 ${d.ti_gua}(${d.ti_wuxing}) — 用 ${d.yong_gua}(${d.yong_wuxing})</span>
         </div>`
      );
      setResult('r-meihua', head + renderReading(d.interpretation));
    },

    bazi(d) {
      const cols = ['year', 'month', 'day', 'hour'];
      const labels = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
      let t = '<table class="fx-table"><thead><tr><th></th>' +
        cols.map((k) => `<th>${labels[k]}</th>`).join('') + '</tr></thead><tbody>';
      const row = (name, fn) => '<tr><td class="k">' + name + '</td>' +
        cols.map((k) => `<td>${fn(d.pillars[k])}</td>`).join('') + '</tr>';
      t += row('干支', (p) => `<b>${esc(p.full)}</b>`);
      t += row('五行', (p) => `<small>${esc(p.gan_wuxing)} ${esc(p.zhi_wuxing)}</small>`);
      t += row('藏干', (p) => `<small>${esc((p.zhi_canggan || []).join(' '))}</small>`);
      t += row('十神', (p) => esc(p.shishen));
      t += row('纳音', (p) => `<small>${esc(p.nayin)}</small>`);
      t += '</tbody></table>';

      const total = Object.values(d.wuxing_count).reduce((a, b) => a + b, 0) || 1;
      let bars = '<div class="fx-bars">';
      for (const wx of ['木', '火', '土', '金', '水']) {
        const c = d.wuxing_count[wx] || 0;
        bars += `<div class="fx-bar"><span class="lab">${wx}</span>` +
          `<span class="track"><i style="width:${(c / total * 100).toFixed(0)}%;background:${WX[wx]}"></i></span>` +
          `<span class="num">${c}</span></div>`;
      }
      bars += '</div>';

      const dm = `<div class="fx-focus"><span>日主 · 你</span>` +
        `<b style="color:${WX[d.day_master_wuxing] || 'var(--accent)'}">${esc(d.day_master)}</b>` +
        `<em>${esc(d.day_master_wuxing)}命</em></div>`;

      setResult('r-bazi', card(t + dm + bars) + renderReading(d.interpretation));
    },

    ziwei(d) {
      const b = d.birth_info;
      const top = chips([
        chip(`${b.year_gan}${b.year_zhi}年`), chip(`${b.month_zhi}月`),
        chip(`${b.day_gan}${b.day_zhi}日`), chip(`${b.hour_zhi}时`),
        chip(`命宫 ${d.ming_palace}`, 'accent'), chip(`身宫 ${d.shen_palace}`),
      ]);
      let grid = '<div class="fx-palaces">';
      for (const p of d.palaces) {
        const tag = p.is_ming ? ' ming' : p.is_shen ? ' shen' : '';
        grid += `<div class="fx-palace${tag}"><span class="pn">${esc(p.name)}${p.is_ming ? ' ·命' : p.is_shen ? ' ·身' : ''}</span>` +
          `<span class="ps">${p.stars.length ? esc(p.stars.join(' ')) : '—'}</span></div>`;
      }
      grid += '</div>';
      let hua = '';
      if (d.sihua && Object.keys(d.sihua).length) {
        hua = chips(Object.entries(d.sihua).map(([s, h]) => chip(`${s} 化${h}`, 'accent')));
      }
      setResult('r-ziwei', card(top + grid + hua) + renderReading(d.interpretation));
    },

    yijing(d) {
      const head = card(
        hexLines(d.ben_gua.lines, d.moving_positions) +
        `<div class="fx-guas">${guaTag(d.ben_gua, '本卦')}${d.bian_gua ? guaTag(d.bian_gua, '变卦') : ''}</div>` +
        `<div class="fx-row">${d.has_changes
          ? chip(`动爻 第 ${d.moving_positions.join('、')} 爻`, 'accent')
          : chip('六爻安静', 'flat')}</div>`
      );
      setResult('r-yijing', head + renderReading(d.interpretation));
    },

    tarot(d) {
      let html = `<p class="fx-lead small">${esc(d.spread_name)}</p>`;
      for (const c of d.cards) {
        const up = c.is_upright;
        html += `<div class="fx-tarot ${up ? 'up' : 'rev'}">
          <div class="fx-tarot-h">
            <span class="pos">${esc(c.position)}</span>
            <span class="nm">${esc(c.name_cn)}</span>
            <span class="ori">${esc(c.orientation)}</span>
          </div>
          <div class="fx-tarot-t">${esc(c.type)}</div>
          <p class="fx-p">${esc(c.interpretation)}</p>
        </div>`;
      }
      // 仅取牌阵总结句（避免与每张牌重复）
      const summary = parseSections(d.interpretation).filter((b) => !b.title)
        .flatMap((b) => b.lines).filter((l) => /^[✨💫]/.test(l));
      if (summary.length) html += '<div class="fx-reading">' +
        summary.map((l) => `<p class="fx-p note">${esc(l)}</p>`).join('') + '</div>';
      setResult('r-tarot', html);
    },

    astrology(d) {
      const sun = d.planets.find((p) => p.name === '太阳');
      const moon = d.planets.find((p) => p.name === '月亮');
      const big = (lab, sign, sub) => `<div class="fx-big"><span class="bl">${lab}</span>` +
        `<b>${esc(sign)}座</b><em>${esc(sub)}</em></div>`;
      const three = `<div class="fx-bigs">
        ${big('☀ 太阳', sun.sign, '核心自我')}
        ${big('☽ 月亮', moon.sign, '情感内心')}
        ${big('↑ 上升', d.ascendant.sign, '外在形象')}
      </div>`;
      let t = '<table class="fx-table"><thead><tr><th>行星</th><th>星座</th><th>宫位</th><th>黄经</th></tr></thead><tbody>';
      for (const p of d.planets) t += `<tr><td class="k">${esc(p.name)}</td><td>${esc(p.sign)}座</td><td>第${p.house}宫</td><td><small>${p.longitude}°</small></td></tr>`;
      t += '</tbody></table>';
      const elc = { 火: '#d1604f', 土: '#3f9a6d', 风: '#c79a4b', 水: '#3f78a8' };
      const els = chips(Object.entries(d.element_count || {}).map(([e, c]) =>
        `<span class="fx-chip" style="color:${elc[e]};border-color:${elc[e]}55">${e}象 ${c}</span>`)
        .concat([chip(`主导 ${d.dominant_sign}座`, 'accent')]));
      let asp = '';
      if (d.aspects && d.aspects.length) {
        asp = '<div class="fx-aspects">' + d.aspects.slice(0, 12).map((a) =>
          chip(`${a.p1} ${a.symbol} ${a.p2}`)).join('') + '</div>';
      }
      setResult('r-astrology', card(three + t + els + asp) + renderReading(d.interpretation));
    },
  };

  // ── API 调度 ──────────────────────────────────
  const CALL = {
    meihua: (f) => FT.callApi('meihua_divine', +f.n1.value, +f.n2.value, +f.n3.value),
    bazi: (f) => FT.callApi('bazi_calculate', +f.year.value, +f.month.value, +f.day.value, +f.hour.value, 0),
    ziwei: (f) => FT.callApi('ziwei_calculate', +f.year.value, +f.month.value, +f.day.value, +f.hour.value, 0, f.gender.value),
    tarot: (f) => FT.callApi('tarot_draw', f.spread.value),
    astrology: (f) => FT.callApi('astrology_chart', +f.year.value, +f.month.value, +f.day.value, +f.hour.value, +f.minute.value, +f.lat.value, +f.lng.value, +f.tz.value),
  };

  async function run(kind, form) {
    const rid = 'r-' + kind;
    if (kind === 'meihua' && (!form.n1.value || !form.n2.value || !form.n3.value)) {
      return fail(rid, '请输入三个数字');
    }
    loading(rid);
    try {
      const data = await CALL[kind](form);
      if (!data || data.error) return fail(rid, (data || {}).error);
      RENDER[kind](data);
      $('#' + rid).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) { fail(rid, e.message); }
  }

  // ── 易经手动掷卦 ──────────────────────────────
  let yjTosses = [];
  function yjReset() {
    yjTosses = [];
    $('#yj-manual').hidden = false;
    $('#yj-step').textContent = '第 1 / 6 掷';
    $('#yj-log').innerHTML = '';
    setResult('r-yijing', '');
  }
  async function yjToss(heads) {
    const names = { 3: '老阳', 2: '少阴', 1: '少阳', 0: '老阴' };
    yjTosses.push(heads);
    $('#yj-log').innerHTML += `<span>${yjTosses.length}·${names[heads]}</span>`;
    if (yjTosses.length < 6) {
      $('#yj-step').textContent = `第 ${yjTosses.length + 1} / 6 掷`;
    } else {
      $('#yj-manual').hidden = true;
      loading('r-yijing');
      const data = await FT.callApi('yijing_cast', yjTosses);
      if (!data || data.error) return fail('r-yijing', (data || {}).error);
      RENDER.yijing(data);
    }
  }

  // ── 绑定 ──────────────────────────────────────
  function init() {
    // tabs
    $$('.fx-tab').forEach((btn) => btn.addEventListener('click', () => {
      $$('.fx-tab').forEach((b) => b.classList.remove('is-active'));
      $$('.fx-panel').forEach((p) => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      $('#p-' + btn.dataset.tab).classList.add('is-active');
    }));

    // forms
    $$('.fx-form').forEach((form) => form.addEventListener('submit', (e) => {
      e.preventDefault();
      const kind = form.dataset.fortune;
      if (kind === 'yijing') {
        FT.callApi('yijing_cast', null).then((d) => {
          if (!d || d.error) return fail('r-yijing', (d || {}).error);
          RENDER.yijing(d);
        });
      } else { run(kind, form); }
    }));

    // 随机（梅花）
    $$('[data-random]').forEach((b) => b.addEventListener('click', () => {
      const f = b.closest('.fx-form');
      f.n1.value = Math.floor(Math.random() * 99) + 1;
      f.n2.value = Math.floor(Math.random() * 99) + 1;
      f.n3.value = Math.floor(Math.random() * 99) + 1;
      run('meihua', f);
    }));

    // 易经手动
    $('[data-manual="yijing"]').addEventListener('click', yjReset);
    $$('.fx-coin').forEach((c) => c.addEventListener('click', () => yjToss(+c.dataset.toss)));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
