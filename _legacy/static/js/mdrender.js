/**
 * Markdown + LaTeX 实时渲染器
 * Left panel: editor  |  Right panel: live preview
 */
(function () {
  const editor = document.getElementById('mdEditor');
  const preview = document.getElementById('mdPreview');
  const statusEl = document.getElementById('mdStatus');
  const countsEl = document.getElementById('mdCounts');
  const toast = document.getElementById('mdToast');

  if (!editor || !preview) return;

  let toastTimer = null;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  /* ═══════════════════════════════════════════
   * Rendering engine
   * ═══════════════════════════════════════════ */

  function render() {
    const raw = editor.value;
    if (!raw.trim()) {
      preview.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:60px 0;">预览区域 · 左侧输入 Markdown 即可实时看到效果</p>';
      updateCounts(raw);
      return;
    }

    let text = raw;

    // 1. Protect fenced code blocks
    const codes = [];
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      codes.push({ lang, code: code.trimEnd() });
      return `%%CODE_${codes.length - 1}%%`;
    });

    // 2. Protect inline code
    const icodes = [];
    text = text.replace(/`([^`\n]+)`/g, (_, code) => {
      icodes.push(code);
      return `%%ICODE_${icodes.length - 1}%%`;
    });

    // 3. Protect block formulas $$...$$
    const blocks = [];
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, f) => {
      blocks.push(f.trim());
      return `%%BLOCK_${blocks.length - 1}%%`;
    });

    // 4. Protect inline formulas $...$
    const inlines = [];
    text = text.replace(/\$([^$\n]+?)\$/g, (_, f) => {
      inlines.push(f.trim());
      return `%%INLINE_${inlines.length - 1}%%`;
    });

    // 5. Markdown → HTML
    let html = '';
    try {
      html = marked.parse(text);
    } catch (e) {
      html = `<p style="color:#e74c3c">Markdown 解析错误: ${e.message}</p>`;
    }

    // 6. Restore block formulas → KaTeX display
    html = html.replace(/%%BLOCK_(\d+)%%/g, (_, i) => {
      try {
        return katex.renderToString(blocks[+i], { displayMode: true, throwOnError: false });
      } catch (e) {
        return `<pre style="color:#e74c3c">KaTeX 错误: ${blocks[+i]}</pre>`;
      }
    });

    // 7. Restore inline formulas → KaTeX inline
    html = html.replace(/%%INLINE_(\d+)%%/g, (_, i) => {
      try {
        return katex.renderToString(inlines[+i], { displayMode: false, throwOnError: false });
      } catch (e) {
        return `<code style="color:#e74c3c">${inlines[+i]}</code>`;
      }
    });

    // 8. Restore code blocks
    html = html.replace(/%%CODE_(\d+)%%/g, (_, i) => {
      const c = codes[+i];
      const escaped = c.code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre><code class="language-${c.lang}">${escaped}</code></pre>`;
    });

    // 9. Restore inline code
    html = html.replace(/%%ICODE_(\d+)%%/g, (_, i) => {
      const escaped = icodes[+i].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<code>${escaped}</code>`;
    });

    preview.innerHTML = html;
    updateCounts(raw);
  }

  function updateCounts(raw) {
    const chars = raw.length;
    const blockCount = (raw.match(/\$\$/g) || []).length / 2;
    const inlineCount = (raw.match(/(?<!\$)\$(?!\$)[^$\n]+?\$(?!\$)/g) || []).length;
    const totalFormulas = blockCount + inlineCount;
    countsEl.textContent = `${chars.toLocaleString()} 字 · ${totalFormulas} 公式`;
    statusEl.textContent = '✅ 已渲染';
  }

  /* ═══════════════════════════════════════════
   * Debounced live preview
   * ═══════════════════════════════════════════ */

  let renderTimer = null;
  editor.addEventListener('input', () => {
    statusEl.textContent = '⏳ 渲染中...';
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 120);
  });

  // initial render
  render();

  /* ═══════════════════════════════════════════
   * Toolbar: demo content
   * ═══════════════════════════════════════════ */

  const DEMO = `# 欢迎使用 Markdown + LaTeX 渲染器

## 基本 Markdown

**粗体**、*斜体*、~~删除线~~、\`行内代码\`。

- 无序列表
- 项目二
  - 嵌套

1. 有序列表
2. 第二项

> 引用块：数学是上帝用来书写宇宙的语言。——伽利略

## 代码块

\`\`\`python
def fibonacci(n):
    """返回第 n 个 Fibonacci 数"""
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
\`\`\`

## 表格

| 方法 | 时间复杂度 | 空间复杂度 |
|------|-----------|-----------|
| 动态规划 | $O(n^2)$ | $O(n)$ |
| 贪心 | $O(n \\log n)$ | $O(1)$ |
| 暴力枚举 | $O(2^n)$ | $O(n)$ |

## LaTeX 公式

### 行内公式

勾股定理：$a^2 + b^2 = c^2$
欧拉恒等式：$e^{i\\pi} + 1 = 0$
二次公式：$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$

### 块级公式

$$
\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}
$$

$$
\\int_{0}^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}
$$

$$
\\begin{pmatrix}
a & b \\\\ c & d
\\end{pmatrix}
\\begin{pmatrix}
x \\\\ y
\\end{pmatrix}
=
\\begin{pmatrix}
ax + by \\\\ cx + dy
\\end{pmatrix}
$$

## 更多示例

组合恒等式：
$$
\\binom{n}{k} = \\binom{n}{n-k}, \\quad
\\sum_{k=0}^{n} \\binom{n}{k} = 2^n
$$

矩阵：
$$
\\det\\begin{pmatrix}
1 & 2 & 3 \\\\
4 & 5 & 6 \\\\
7 & 8 & 9
\\end{pmatrix} = 0
$$

---

*试试修改左侧内容，右侧会实时更新！*`;

  document.getElementById('mdBtnDemo').addEventListener('click', () => {
    editor.value = DEMO;
    render();
    editor.focus();
    showToast('📋 已填入示例文档');
  });

  /* ═══════════════════════════════════════════
   * Toolbar: clear
   * ═══════════════════════════════════════════ */

  document.getElementById('mdBtnClear').addEventListener('click', () => {
    if (editor.value && !confirm('确定要清空编辑器内容吗？')) return;
    editor.value = '';
    render();
    editor.focus();
    showToast('🗑 已清空');
  });

  /* ═══════════════════════════════════════════
   * Toolbar: insert formula
   * ═══════════════════════════════════════════ */

  function insertAtCursor(before, after) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = editor.value;
    const selected = text.substring(start, end);

    editor.value = text.substring(0, start) + before + selected + after + text.substring(end);

    const newPos = selected
      ? start + before.length + selected.length + after.length
      : start + before.length;
    editor.setSelectionRange(newPos, newPos);
    editor.focus();
    render();
  }

  document.getElementById('mdBtnInline').addEventListener('click', () => {
    insertAtCursor('$', '$');
    showToast('𝑓 插入行内公式');
  });

  document.getElementById('mdBtnBlock').addEventListener('click', () => {
    insertAtCursor('$$\n', '\n$$');
    showToast('ƒ 插入块级公式');
  });

  /* ═══════════════════════════════════════════
   * Toolbar: export as image
   * ═══════════════════════════════════════════ */

  document.getElementById('mdBtnExport').addEventListener('click', async () => {
    if (!preview.innerHTML.trim()) {
      showToast('⚠️ 预览区域为空，无法导出');
      return;
    }
    statusEl.textContent = '⏳ 导出中...';
    try {
      const canvas = await html2canvas(preview, {
        backgroundColor: '#fafbfc',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'markdown-export.png';
        a.click();
        URL.revokeObjectURL(url);
        statusEl.textContent = '✅ 已导出';
        showToast('🖼 图片已下载');
      }, 'image/png');
    } catch (e) {
      statusEl.textContent = '❌ 导出失败';
      showToast('❌ 导出失败: ' + e.message);
    }
  });

  /* ═══════════════════════════════════════════
   * Toolbar: share
   * ═══════════════════════════════════════════ */

  document.getElementById('mdBtnShare').addEventListener('click', async () => {
    const content = editor.value.trim();
    if (!content) {
      showToast('⚠️ 内容为空，无法分享');
      return;
    }
    statusEl.textContent = '⏳ 生成分享链接...';
    try {
      const resp = await fetch('/mdrender/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await resp.json();
      if (data.url) {
        const fullUrl = window.location.origin + data.url;
        try {
          await navigator.clipboard.writeText(fullUrl);
          showToast('🔗 分享链接已复制到剪贴板');
        } catch (_) {
          showToast('🔗 ' + fullUrl);
        }
        statusEl.textContent = '✅ 已生成分享链接';
      } else {
        throw new Error(data.error || '未知错误');
      }
    } catch (e) {
      statusEl.textContent = '❌ 分享失败';
      showToast('❌ 分享失败: ' + e.message);
    }
  });

  /* ═══════════════════════════════════════════
   * Keyboard shortcuts
   * ═══════════════════════════════════════════ */

  editor.addEventListener('keydown', (e) => {
    // Ctrl+S → share
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      document.getElementById('mdBtnShare').click();
    }
    // Tab → insert spaces
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      insertAtCursor('  ', '');
    }
    // Ctrl+B → bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      insertAtCursor('**', '**');
    }
    // Ctrl+I → italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      insertAtCursor('*', '*');
    }
  });

  /* ═══════════════════════════════════════════
   * Sync scroll
   * ═══════════════════════════════════════════ */

  // Auto-scroll preview to match editor position (rough sync)
  editor.addEventListener('scroll', () => {
    const previewWrap = preview.parentElement;
    if (!previewWrap) return;
    const ratio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
    previewWrap.scrollTop = ratio * (previewWrap.scrollHeight - previewWrap.clientHeight);
  });

})();
