/** Demo document inserted by the 示例 toolbar button (ported from legacy). */
export const DEMO_DOC = `# 欢迎使用 Markdown + LaTeX 渲染器

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

*试试修改左侧内容，右侧会实时更新！*`
