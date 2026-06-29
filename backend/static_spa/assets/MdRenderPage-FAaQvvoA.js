import{r,j as t,c as b,u as D,_ as T}from"./index-BBLAuCEv.js";import{B as x}from"./Button-B93BNGmg.js";import{C as A}from"./Modal-CtvUvCWV.js";import{a as P,A as z}from"./api-CZQtBY56.js";import{M as K}from"./markdown-DxSvXxoU.js";import"./math-Bxp1qvag.js";const U=b("max-w-none text-[0.95rem] leading-relaxed text-fg-soft","[&_h1]:mt-0 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-fg","[&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-border-soft [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-fg","[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-fg","[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:font-semibold [&_h4]:text-fg","[&_p]:my-3","[&_a]:text-accent [&_a]:underline [&_a]:decoration-accent/40 [&_a:hover]:decoration-accent","[&_strong]:font-semibold [&_strong]:text-fg","[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1","[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-accent/50 [&_blockquote]:bg-surface-2 [&_blockquote]:py-2 [&_blockquote]:pl-4 [&_blockquote]:pr-3 [&_blockquote]:text-muted [&_blockquote]:rounded-r-lg","[&_hr]:my-6 [&_hr]:border-border-soft","[&_code]:rounded [&_code]:bg-surface-3 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:text-cyan","[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border-soft [&_pre]:bg-surface-2 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:leading-relaxed","[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-fg-soft","[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm","[&_th]:border [&_th]:border-border-soft [&_th]:bg-surface-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-fg","[&_td]:border [&_td]:border-border-soft [&_td]:px-3 [&_td]:py-2","[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg","[&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1"),X=r.forwardRef(function({source:a,className:d},_){return t.jsx("div",{ref:_,className:b(U,d),children:t.jsx(K,{source:a})})}),B=`# 欢迎使用 Markdown + LaTeX 渲染器

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

*试试修改左侧内容，右侧会实时更新！*`,F=`# 在此输入 Markdown

支持 **GFM** 语法与 LaTeX 公式，例如行内 $a^2+b^2=c^2$ 与块级：

$$
e^{i\\pi} + 1 = 0
$$

左侧编辑，右侧实时预览。`;function Q(){const n=D(),[a,d]=r.useState(""),[_,N]=r.useState(""),[l,u]=r.useState("就绪"),[L,g]=r.useState(!1),[y,w]=r.useState(!1),f=r.useRef(null),v=r.useRef(null),h=r.useRef(null);r.useEffect(()=>(u("渲染中"),h.current&&clearTimeout(h.current),h.current=setTimeout(()=>{N(a),u(a.trim()?"已渲染":"就绪")},120),()=>{h.current&&clearTimeout(h.current)}),[a]);const j=r.useMemo(()=>{const e=a.length,s=(a.match(/\$\$/g)||[]).length/2,o=a.match(new RegExp("(?<!\\$)\\$(?!\\$)[^$\\n]+?\\$(?!\\$)","g"))||[],c=Math.floor(s)+o.length;return{chars:e,formulas:c}},[a]),m=r.useCallback((e,s)=>{const o=f.current;if(!o)return;const c=o.selectionStart,p=o.selectionEnd;d(i=>{const $=i.slice(c,p),q=i.slice(0,c)+e+$+s+i.slice(p);return requestAnimationFrame(()=>{const C=$?c+e.length+$.length+s.length:c+e.length;o.focus(),o.setSelectionRange(C,C)}),q})},[]),R=r.useCallback(()=>{var e;d(B),(e=f.current)==null||e.focus(),n("📋 已填入示例文档")},[n]),M=r.useCallback(()=>{var e;a?g(!0):(e=f.current)==null||e.focus()},[a]),S=r.useCallback(()=>{var e;d(""),g(!1),(e=f.current)==null||e.focus(),n("🗑 已清空")},[n]),k=r.useCallback(async()=>{const e=a.trim();if(!e){n("⚠️ 内容为空，无法分享","danger");return}w(!0),u("渲染中");try{const s=await P("/api/mdrender/share",{content:e}),o=window.location.origin+s.url;try{await navigator.clipboard.writeText(o),n("🔗 分享链接已复制到剪贴板","success")}catch{n("🔗 "+o,"success")}u("已渲染")}catch(s){const o=s instanceof z?s.message:"未知错误";n("❌ 分享失败："+o,"danger"),u("已渲染")}finally{w(!1)}},[a,n]),E=r.useCallback(async()=>{const e=v.current;if(!e||!a.trim()){n("⚠️ 预览区域为空，无法导出","danger");return}n("⏳ 正在导出图片…");try{const{default:s}=await T(async()=>{const{default:c}=await import("./html2canvas.esm-CBrSDip1.js");return{default:c}},[]);(await s(e,{backgroundColor:getComputedStyle(document.body).backgroundColor||"#0b0d14",scale:2,useCORS:!0,logging:!1})).toBlob(c=>{if(!c){n("❌ 导出失败","danger");return}const p=URL.createObjectURL(c),i=document.createElement("a");i.href=p,i.download="markdown-export.png",i.click(),URL.revokeObjectURL(p),n("🖼 图片已下载","success")},"image/png")}catch(s){const o=s instanceof Error?s.message:String(s);n("❌ 导出失败："+o,"danger")}},[a,n]),O=r.useCallback(e=>{const s=e.ctrlKey||e.metaKey;s&&e.key.toLowerCase()==="s"?(e.preventDefault(),k()):e.key==="Tab"&&!e.shiftKey?(e.preventDefault(),m("  ","")):s&&e.key.toLowerCase()==="b"?(e.preventDefault(),m("**","**")):s&&e.key.toLowerCase()==="i"&&(e.preventDefault(),m("*","*"))},[k,m]);return t.jsxs("div",{className:"mx-auto flex h-[calc(100dvh-4rem)] max-w-[1400px] flex-col px-4 py-6 sm:px-6",children:[t.jsxs("header",{className:"mb-4 shrink-0",children:[t.jsx("p",{className:"mb-1 text-xs font-medium uppercase tracking-[0.25em] text-accent/80",children:"MARKDOWN · LATEX"}),t.jsx("h1",{className:"text-2xl font-bold sm:text-3xl",children:"实时渲染器"}),t.jsx("p",{className:"mt-1 text-sm text-muted",children:"左侧输入 Markdown 与 LaTeX 公式，右侧即时预览，可导出图片或生成分享链接。"})]}),t.jsxs("div",{className:"mb-3 flex shrink-0 flex-wrap items-center gap-2",children:[t.jsx(x,{size:"sm",variant:"secondary",onClick:R,children:"示例"}),t.jsx(x,{size:"sm",variant:"secondary",onClick:M,children:"清空"}),t.jsx("span",{className:"mx-1 hidden h-5 w-px bg-border-soft sm:block"}),t.jsx(x,{size:"sm",variant:"ghost",onClick:()=>m("$","$"),children:"行内公式"}),t.jsx(x,{size:"sm",variant:"ghost",onClick:()=>m(`$$
`,`
$$`),children:"块级公式"}),t.jsx("span",{className:"mx-1 hidden h-5 w-px bg-border-soft sm:block"}),t.jsx(x,{size:"sm",variant:"outline",onClick:E,children:"导出图片"}),t.jsx(x,{size:"sm",variant:"primary",onClick:k,disabled:y,children:y?"生成中…":"分享"})]}),t.jsxs("div",{className:"grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2",children:[t.jsxs("div",{className:"card flex min-h-[40vh] flex-col overflow-hidden p-0 md:min-h-0",children:[t.jsx("div",{className:"flex items-center justify-between border-b border-border-soft px-3 py-2 text-xs text-muted",children:t.jsx("span",{children:"编辑 · Markdown 源码"})}),t.jsx("textarea",{ref:f,value:a,onChange:e=>d(e.target.value),onKeyDown:O,spellCheck:!1,placeholder:F,className:b("min-h-0 flex-1 resize-none bg-transparent px-4 py-3 font-mono text-sm leading-relaxed text-fg","outline-none placeholder:text-faint")})]}),t.jsxs("div",{className:"card flex min-h-[40vh] flex-col overflow-hidden p-0 md:min-h-0",children:[t.jsx("div",{className:"flex items-center justify-between border-b border-border-soft px-3 py-2 text-xs text-muted",children:t.jsx("span",{children:"预览"})}),t.jsx("div",{className:"min-h-0 flex-1 overflow-auto px-4 py-3",children:_.trim()?t.jsx(X,{ref:v,source:_}):t.jsx("p",{className:"py-16 text-center text-sm text-faint",children:"预览区域 · 左侧输入 Markdown 即可实时看到效果"})})]})]}),t.jsxs("div",{className:"mt-3 flex shrink-0 items-center justify-end gap-3 text-xs text-muted",children:[t.jsxs("span",{children:[j.chars.toLocaleString()," 字 · ",j.formulas," 公式"]}),t.jsxs("span",{className:b("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5",l==="渲染中"&&"text-warning",l==="已渲染"&&"text-success",l==="就绪"&&"text-faint"),children:[t.jsx("span",{className:b("h-1.5 w-1.5 rounded-full",l==="渲染中"&&"bg-warning",l==="已渲染"&&"bg-success",l==="就绪"&&"bg-border")}),l]})]}),t.jsx(A,{open:L,title:"清空编辑器",message:"确定要清空编辑器内容吗？此操作无法撤销。",confirmLabel:"清空",cancelLabel:"取消",danger:!0,onConfirm:S,onCancel:()=>g(!1)})]})}export{Q as default};
