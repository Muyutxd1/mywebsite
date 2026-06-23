/**
 * Problem Set Browser — MathNet Olympiad problems
 */
(function () {
  // ── DOM ────────────────────────────
  const $list = document.getElementById('problemsList');
  const $pager = document.getElementById('problemsPager');
  const $count = document.getElementById('problemsCount');
  const $randomCard = document.getElementById('randomCard');
  const $randomMeta = document.getElementById('randomMeta');

  // Filters
  const $fComp = document.getElementById('fCompetition');
  const $fTopic = document.getElementById('fTopic');
  const $fYear = document.getElementById('fYear');
  const $fSearch = document.getElementById('fSearch');

  // ── State ──────────────────────────
  let allEntries = [];         // full index (metadata only)
  let filtered = [];
  let pageSize = 20;
  let currentPage = 1;
  let expandedId = null;
  let problemCache = {};      // id → full problem data

  /* ═══════════════════════════════════════
   * Load index
   * ═══════════════════════════════════════ */

  async function load() {
    $list.innerHTML = '<div class="problems-loading">加载题库中...</div>';

    try {
      const resp = await fetch('/problems/api/index');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      allEntries = data.entries || [];
      populateFilters(data);
      applyFilters();
    } catch (e) {
      $list.innerHTML = `<div class="problems-empty">❌ 加载失败: ${e.message}</div>`;
    }
  }

  function populateFilters(data) {
    // Competitions
    (data.competitions || []).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      // Shorten display name
      const short = c.replace(/_/g, ' ').replace('Asia Pacific Mathematics Olympiad', 'APMO')
                     .replace('Romanian Master of Mathematics', 'RMM');
      opt.textContent = short.length > 30 ? short.slice(0, 30) + '...' : short;
      $fComp.appendChild(opt);
    });

    // Topics
    (data.topics || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      $fTopic.appendChild(opt);
    });

    // Years
    (data.years || []).forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      $fYear.appendChild(opt);
    });
  }

  /* ═══════════════════════════════════════
   * Filtering
   * ═══════════════════════════════════════ */

  function applyFilters() {
    const comp = $fComp.value;
    const topic = $fTopic.value;
    const year = $fYear.value;
    const search = $fSearch.value.toLowerCase().trim();

    filtered = allEntries.filter(e => {
      if (comp && e.competition !== comp) return false;
      if (topic && !(e.topics || []).includes(topic)) return false;
      if (year && String(e.year) !== year) return false;
      if (search) {
        const hay = [e.title, e.competition, ...(e.topics || [])].join(' ').toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    currentPage = 1;
    expandedId = null;
    renderPage();
  }

  [$fComp, $fTopic, $fYear].forEach(el => el.addEventListener('change', applyFilters));
  $fSearch.addEventListener('input', debounce(applyFilters, 200));

  /* ═══════════════════════════════════════
   * Render page
   * ═══════════════════════════════════════ */

  function renderPage() {
    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (currentPage - 1) * pageSize;
    const page = filtered.slice(start, start + pageSize);

    $count.textContent = total ? `${total} 题 · 第 ${currentPage}/${totalPages} 页` : '0 题';

    if (!page.length) {
      $list.innerHTML = '<div class="problems-empty">🔍 没有匹配的题目</div>';
      $pager.innerHTML = '';
      return;
    }

    $list.innerHTML = page.map(e => renderCard(e, false)).join('');
    $pager.innerHTML = renderPager(currentPage, totalPages);

    // Card click handlers
    $list.querySelectorAll('.problem-card-header').forEach(h => {
      h.addEventListener('click', () => {
        const card = h.closest('.problem-card');
        const pid = card.dataset.pid;
        toggleCard(card, pid);
      });
    });

    // Solution toggle handlers
    $list.querySelectorAll('.solution-toggle').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const container = btn.nextElementSibling;
        const isHidden = container.style.display === 'none' || !container.style.display;
        if (isHidden) {
          container.style.display = 'block';
          btn.textContent = '▲ 隐藏解答';
        } else {
          container.style.display = 'none';
          btn.textContent = '▼ 查看解答';
        }
      });
    });

    // Pager buttons
    $pager.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page);
        if (p > 0 && p <= totalPages) {
          currentPage = p;
          renderPage();
          $list.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  function renderCard(entry, isRandom) {
    const topics = (entry.topics || []).filter(t => t !== '未分类');
    const tags = topics.map(t => `<span class="problem-tag">${esc(t)}</span>`).join('');
    const compName = entry.competition_zh || entry.competition.replace(/_/g, ' ');
    return `
      <div class="problem-card" data-pid="${esc(entry.id)}">
        <div class="problem-card-header">
          <span class="problem-id">${esc(compName)} · ${entry.year || '?'}</span>
          <span class="problem-title">${esc(entry.title)}</span>
          <span class="problem-tags">${tags}</span>
          <span class="problem-arrow">▼</span>
        </div>
        <div class="problem-card-body">
          <div class="problem-content" id="content-${esc(entry.id)}">
            <div class="problems-loading" style="padding:20px">加载题目中...</div>
          </div>
          <div class="solution-toggle" style="display:none">▼ 查看解答</div>
          <div class="solution-content" id="solution-${esc(entry.id)}" style="display:none"></div>
        </div>
      </div>`;
  }

  function renderPager(page, total) {
    if (total <= 1) return '';
    let html = '';
    html += `<button data-page="1" ${page === 1 ? 'disabled' : ''}>«</button>`;
    html += `<button data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>‹</button>`;

    const start = Math.max(1, page - 2);
    const end = Math.min(total, page + 2);
    for (let i = start; i <= end; i++) {
      const active = i === page ? 'style="background:var(--accent);color:#fff;border-color:var(--accent)"' : '';
      html += `<button data-page="${i}" ${active}>${i}</button>`;
    }

    html += `<button data-page="${page + 1}" ${page === total ? 'disabled' : ''}>›</button>`;
    html += `<button data-page="${total}" ${page === total ? 'disabled' : ''}>»</button>`;
    return html;
  }

  /* ═══════════════════════════════════════
   * Card expand & load
   * ═══════════════════════════════════════ */

  async function toggleCard(card, pid) {
    const isExpanded = card.classList.contains('expanded');

    if (isExpanded) {
      card.classList.remove('expanded');
      expandedId = null;
      return;
    }

    // Collapse any other expanded card
    if (expandedId && expandedId !== pid) {
      const prev = document.querySelector(`.problem-card[data-pid="${expandedId}"]`);
      if (prev) prev.classList.remove('expanded');
    }

    card.classList.add('expanded');
    expandedId = pid;

    // Load full problem data if not cached
    const contentEl = document.getElementById(`content-${pid}`);
    const solutionEl = document.getElementById(`solution-${pid}`);
    const toggleEl = card.querySelector('.solution-toggle');

    if (!problemCache[pid]) {
      try {
        const resp = await fetch(`/problems/api/problem/${encodeURIComponent(pid)}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        problemCache[pid] = await resp.json();
      } catch (e) {
        contentEl.innerHTML = `<p style="color:#e74c3c">加载失败: ${e.message}</p>`;
        return;
      }
    }

    const p = problemCache[pid];
    contentEl.innerHTML = renderMarkdown(p.problem_md || '*无题面*');

    if (p.solution_md) {
      solutionEl.innerHTML = renderMarkdown(p.solution_md);
      toggleEl.style.display = 'block';
    } else {
      toggleEl.style.display = 'none';
      solutionEl.style.display = 'none';
    }

    // Render KaTeX
    renderKaTeXIn(contentEl);
    renderKaTeXIn(solutionEl);
  }

  /* ═══════════════════════════════════════
   * Simple markdown rendering (for problem text)
   * ═══════════════════════════════════════ */

  function renderMarkdown(md) {
    if (!md) return '';

    // Protect LaTeX
    const blocks = [];
    let text = md.replace(/\$\$([\s\S]*?)\$\$/g, (_, f) => {
      blocks.push({ type: 'block', formula: f.trim() });
      return `%%B${blocks.length - 1}%%`;
    });
    const inlines = [];
    text = text.replace(/\$(.*?)\$/g, (_, f) => {
      inlines.push({ type: 'inline', formula: f.trim() });
      return `%%I${inlines.length - 1}%%`;
    });

    // Basic markdown → HTML
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    html = '<p>' + html + '</p>';

    // Restore LaTeX placeholders
    html = html.replace(/%%B(\d+)%%/g, (_, i) => {
      return `<span class="math-block">$$${blocks[+i].formula}$$</span>`;
    });
    html = html.replace(/%%I(\d+)%%/g, (_, i) => {
      return `<span class="math-inline">$${inlines[+i].formula}$</span>`;
    });

    return html;
  }

  function renderKaTeXIn(el) {
    if (!el) return;
    // Block formulas
    el.querySelectorAll('.math-block').forEach(span => {
      const tex = span.textContent.replace(/^\$\$/, '').replace(/\$\$$/, '').trim();
      try {
        katex.render(tex, span, { displayMode: true, throwOnError: false });
      } catch (_) { span.textContent = tex; }
    });
    // Inline formulas
    el.querySelectorAll('.math-inline').forEach(span => {
      const tex = span.textContent.replace(/^\$/, '').replace(/\$$/, '').trim();
      try {
        katex.render(tex, span, { displayMode: false, throwOnError: false });
      } catch (_) { span.textContent = tex; }
    });
  }

  /* ═══════════════════════════════════════
   * Random mode
   * ═══════════════════════════════════════ */

  async function randomPick() {
    if (!allEntries.length) {
      $randomCard.innerHTML = '<div class="problems-empty">题库尚未加载</div>';
      return;
    }

    $randomCard.innerHTML = '<div class="problems-loading">抽题中...</div>';
    $randomMeta.textContent = '';

    const idx = Math.floor(Math.random() * allEntries.length);
    const entry = allEntries[idx];
    $randomCard.innerHTML = renderCard(entry, true);

    // Expand and load
    const card = $randomCard.querySelector('.problem-card');
    card.classList.add('expanded');

    const contentEl = document.getElementById(`content-${entry.id}`);
    const solutionEl = document.getElementById(`solution-${entry.id}`);
    const toggleEl = card.querySelector('.solution-toggle');

    // Fetch full problem
    if (!problemCache[entry.id]) {
      try {
        const resp = await fetch(`/problems/api/problem/${encodeURIComponent(entry.id)}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        problemCache[entry.id] = await resp.json();
      } catch (e) {
        contentEl.innerHTML = `<p style="color:#e74c3c">加载失败: ${e.message}</p>`;
        return;
      }
    }

    const p = problemCache[entry.id];
    contentEl.innerHTML = renderMarkdown(p.problem_md || '*无题面*');

    if (p.solution_md) {
      solutionEl.innerHTML = renderMarkdown(p.solution_md);
      toggleEl.style.display = 'block';
    } else {
      toggleEl.style.display = 'none';
    }

    renderKaTeXIn(contentEl);
    renderKaTeXIn(solutionEl);

    // Solution toggle
    toggleEl.addEventListener('click', () => {
      const isHidden = solutionEl.style.display === 'none';
      solutionEl.style.display = isHidden ? 'block' : 'none';
      toggleEl.textContent = isHidden ? '▲ 隐藏解答' : '▼ 查看解答';
    });

    $randomMeta.textContent = `${entry.competition} · ${entry.year} · ${entry.difficulty_zh || '中'}`;
    $randomCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  document.getElementById('randomBtn').addEventListener('click', randomPick);

  /* ═══════════════════════════════════════
   * Tab switching
   * ═══════════════════════════════════════ */

  const tabs = document.querySelectorAll('.problems-tab');
  const tabBrowse = document.getElementById('tabBrowse');
  const tabRandom = document.getElementById('tabRandom');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const mode = tab.dataset.tab;
      tabBrowse.style.display = mode === 'browse' ? 'block' : 'none';
      tabRandom.style.display = mode === 'random' ? 'block' : 'none';
    });
  });

  /* ═══════════════════════════════════════
   * Helpers
   * ═══════════════════════════════════════ */

  function esc(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  /* ═══════════════════════════════════════
   * Init
   * ═══════════════════════════════════════ */

  load();
})();
