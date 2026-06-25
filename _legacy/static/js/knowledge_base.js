/**
 * Knowledge Base — accordion-based reference for combinatorics / number theory.
 */
(function () {
  const container = document.getElementById('kbContainer');
  const searchInput = document.getElementById('kbSearch');
  const searchResults = document.getElementById('kbSearchResults');
  const configEl = document.getElementById('kbConfig');

  if (!container) return;

  const config = JSON.parse(configEl.textContent);
  const KB_NAME = config.kb;
  const DATA_URL = `/static/data/${KB_NAME}.json`;

  let allChapters = [];
  let allEntries = [];  // flat list for search

  /* ═══════════════════════════════════════════
   * Fetch data
   * ═══════════════════════════════════════════ */

  async function load() {
    try {
      const resp = await fetch(DATA_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      allChapters = data.chapters || [];
      allEntries = [];
      allChapters.forEach(ch => {
        ch.entries.forEach(e => {
          e._chapterTitle = ch.title;
          e._chapterNum = ch.num;
          allEntries.push(e);
        });
      });
      render(allChapters);
    } catch (e) {
      container.innerHTML = `<div class="kb-empty">❌ 加载失败: ${e.message}</div>`;
    }
  }

  /* ═══════════════════════════════════════════
   * Render
   * ═══════════════════════════════════════════ */

  function render(chapters) {
    if (!chapters.length) {
      container.innerHTML = '<div class="kb-empty">暂无内容</div>';
      searchResults.textContent = '';
      return;
    }

    let html = '';
    chapters.forEach((ch, ci) => {
      html += renderChapter(ch, ci);
    });
    container.innerHTML = html;

    // Click handlers
    container.querySelectorAll('.kb-chapter-header').forEach(header => {
      header.addEventListener('click', () => {
        const chapter = header.closest('.kb-chapter');
        chapter.classList.toggle('open');
      });
    });

    // Render KaTeX
    renderMath();
  }

  function renderChapter(ch, ci) {
    const count = ch.entries ? ch.entries.length : 0;
    return `
      <div class="kb-chapter" data-chapter="${ci}">
        <div class="kb-chapter-header">
          <span class="kb-chapter-num">${ch.num || ci + 1}</span>
          <span class="kb-chapter-title">${esc(ch.title)}</span>
          <span class="kb-chapter-count">${count} 条</span>
          <span class="kb-chapter-arrow">▼</span>
        </div>
        <div class="kb-chapter-body">
          ${(ch.entries || []).map((e, ei) => renderEntry(e, ci, ei)).join('')}
        </div>
      </div>`;
  }

  function renderEntry(e, ci, ei) {
    const tags = (e.tags || []).map(t => `<span class="kb-entry-tag">${esc(t)}</span>`).join('');
    let body = '';

    if (e.formula) {
      body += `<span class="formula-block">$$${e.formula}$$</span>`;
    }
    if (e.statement) {
      body += `<p class="detail-text">${esc(e.statement)}</p>`;
    }
    if (e.detail) {
      body += `<p class="detail-text">${esc(e.detail)}</p>`;
    }

    return `
      <div class="kb-entry" data-entry-id="${e.id || ei + 1}"
           data-search-text="${escAttr(e.title)} ${escAttr(e.statement || '')} ${escAttr(e.formula || '')} ${escAttr(e.detail || '')} ${escAttr(e.tags ? e.tags.join(' ') : '')}">
        <div class="kb-entry-header">
          <span class="kb-entry-id">#${e.id || ei + 1}</span>
          <span class="kb-entry-title">${esc(e.title)}</span>
          ${tags ? `<span class="kb-entry-tags">${tags}</span>` : ''}
        </div>
        ${body ? `<div class="kb-entry-body">${body}</div>` : ''}
      </div>`;
  }

  /* ═══════════════════════════════════════════
   * KaTeX rendering
   * ═══════════════════════════════════════════ */

  function renderMath() {
    // Render all $$...$$ formulas in the container
    const entries = container.querySelectorAll('.formula-block');
    entries.forEach(el => {
      const tex = el.textContent.replace(/^\$\$/, '').replace(/\$\$$/, '').trim();
      if (!tex) return;
      try {
        katex.render(tex, el, { displayMode: true, throwOnError: false });
      } catch (_) {
        // leave as-is on error
      }
    });

    // Also render any inline $...$ in detail text
    container.querySelectorAll('.detail-text').forEach(el => {
      const text = el.textContent;
      if (!text.includes('$')) return;
      try {
        // Use KaTeX auto-render-like approach but simpler
        const parts = [];
        let remaining = text;
        let idx = 0;
        const re = /\$([^$]+)\$/g;
        let m;
        let lastIdx = 0;
        while ((m = re.exec(text)) !== null) {
          if (m.index > lastIdx) {
            parts.push(document.createTextNode(text.slice(lastIdx, m.index)));
          }
          const span = document.createElement('span');
          try {
            katex.render(m[1], span, { displayMode: false, throwOnError: false });
          } catch(_) {
            span.textContent = m[1];
          }
          parts.push(span);
          lastIdx = m.index + m[0].length;
        }
        if (lastIdx < text.length) {
          parts.push(document.createTextNode(text.slice(lastIdx)));
        }
        if (parts.length > 1) {
          el.textContent = '';
          parts.forEach(p => el.appendChild(p));
        }
      } catch (_) {}
    });
  }

  /* ═══════════════════════════════════════════
   * Search
   * ═══════════════════════════════════════════ */

  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(doSearch, 150);
  });

  function doSearch() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      // Show all
      render(allChapters);
      searchResults.textContent = '';
      // Collapse all by default when resetting search
      return;
    }

    // Filter entries
    const matchedEntries = allEntries.filter(e => {
      const haystack = [
        e.title, e.statement, e.formula, e.detail,
        (e.tags || []).join(' '), e._chapterTitle
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });

    if (!matchedEntries.length) {
      container.innerHTML = '<div class="kb-empty">🔍 未找到匹配的知识点</div>';
      searchResults.textContent = '0 条匹配';
      return;
    }

    // Group matched entries by chapter
    const chapterMap = new Map();
    matchedEntries.forEach(e => {
      const key = e._chapterNum + '|' + e._chapterTitle;
      if (!chapterMap.has(key)) {
        chapterMap.set(key, { num: e._chapterNum, title: e._chapterTitle, entries: [] });
      }
      chapterMap.get(key).entries.push(e);
    });

    const chapters = Array.from(chapterMap.values());
    chapters.forEach((ch, i) => { ch.num = i + 1; });

    // Render with all chapters open
    render(chapters);
    container.querySelectorAll('.kb-chapter').forEach(ch => ch.classList.add('open'));

    searchResults.textContent = `${matchedEntries.length} 条匹配`;
  }

  /* ═══════════════════════════════════════════
   * Helpers
   * ═══════════════════════════════════════════ */

  function esc(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function escAttr(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ═══════════════════════════════════════════
   * Init
   * ═══════════════════════════════════════════ */

  load();
})();
