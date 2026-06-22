// ═══ MBTI 性格测试 UI ═══
let mbtiState = {
  questions: [],
  currentIndex: 0,
  answers: {},    // {questionId: score 0-4}
  typeData: null,
};

const OPTIONS = [
  { value: 0, label: '非常不同意' },
  { value: 1, label: '不同意' },
  { value: 2, label: '中立' },
  { value: 3, label: '同意' },
  { value: 4, label: '非常同意' },
];

async function initMbti() {
  // Load MBTI data
  try {
    const resp = await fetch('/static/../data/mbti.json');  // won't work — load inline
    // We'll load from a global preload or inline data
  } catch (e) {
    // Fallback
  }
}

async function startMbtiTest() {
  // Fetch questions from data
  try {
    const resp = await fetch('/static/data/mbti.json');
    const data = await resp.json();
    mbtiState.questions = shuffleArray([...data.questions]);
    mbtiState.answers = {};
    mbtiState.currentIndex = 0;
    mbtiState.typeData = data.types;
    renderQuestion();
    document.getElementById('mbti-test-area').style.display = 'block';
    document.getElementById('mbti-result-area').style.display = 'none';
  } catch (err) {
    console.error('Failed to load MBTI data:', err);
    document.getElementById('mbti-test-area').innerHTML =
      '<p style="color:#e74c3c">加载数据失败，请刷新页面重试。</p>';
  }
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderQuestion() {
  const { questions, currentIndex, answers } = mbtiState;
  const total = questions.length;
  if (total === 0) return;

  const q = questions[currentIndex];
  const progress = Math.round(((currentIndex + 1) / total) * 100);
  const selected = answers[q.id];

  let html = '';

  // Progress bar
  html += `<div style="margin-bottom:24px">
    <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-secondary);margin-bottom:6px">
      <span>进度</span><span>${currentIndex + 1} / ${total} (${progress}%)</span>
    </div>
    <div style="height:6px;background:var(--border-light);border-radius:3px;overflow:hidden">
      <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,var(--accent),#a29bfe);border-radius:3px;transition:width 0.3s"></div>
    </div>
  </div>`;

  // Question
  html += `<div style="background:var(--bg-card);border-radius:var(--radius);padding:24px;margin-bottom:20px">
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
      第 ${currentIndex + 1} 题 · ${dimLabel(q.dim)}
    </div>
    <div style="font-size:18px;font-weight:600;line-height:1.6;color:var(--text);margin-bottom:20px">
      ${escapeHtml(q.text)}
    </div>

    <!-- Option buttons -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
      ${OPTIONS.map(opt => `
        <button class="mbti-option${selected === opt.value ? ' mbti-option-selected' : ''}"
                onclick="selectOption(${q.id}, ${opt.value})"
                style="flex:1;min-width:100px;max-width:140px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${opt.label}</div>
          <div style="font-size:22px">${optionEmoji(opt.value)}</div>
        </button>
      `).join('')}
    </div>
  </div>`;

  // Navigation buttons
  html += `<div style="display:flex;justify-content:space-between;align-items:center">
    <button class="btn btn-secondary" ${currentIndex === 0 ? 'disabled' : ''}
            onclick="prevQuestion()" style="${currentIndex === 0 ? 'opacity:0.4;cursor:default' : ''}">
      ← 上一题
    </button>
    <span style="font-size:13px;color:var(--text-muted)">
      ${currentIndex + 1 === total ? '最后一题，点击提交查看结果' : `还剩 ${total - currentIndex - 1} 题`}
    </span>
    ${currentIndex + 1 === total ? `
      <button class="btn btn-primary" onclick="submitMbti()"
              ${selected === undefined ? 'disabled style="opacity:0.4;cursor:default"' : ''}>
        ✨ 查看结果
      </button>
    ` : `
      <button class="btn btn-primary" onclick="nextQuestion()"
              ${selected === undefined ? 'disabled style="opacity:0.4;cursor:default"' : ''}>
        下一题 →
      </button>
    `}
  </div>`;

  document.getElementById('mbti-question-area').innerHTML = html;
  window.scrollTo({ top: document.getElementById('mbti-test-area').offsetTop - 80, behavior: 'smooth' });
}

function selectOption(qId, value) {
  mbtiState.answers[qId] = value;
  renderQuestion();
}

function prevQuestion() {
  if (mbtiState.currentIndex > 0) {
    mbtiState.currentIndex--;
    renderQuestion();
  }
}

function nextQuestion() {
  const q = mbtiState.questions[mbtiState.currentIndex];
  if (mbtiState.answers[q.id] === undefined) return;
  if (mbtiState.currentIndex < mbtiState.questions.length - 1) {
    mbtiState.currentIndex++;
    renderQuestion();
  }
}

function submitMbti() {
  const { questions, answers } = mbtiState;
  const lastQ = questions[questions.length - 1];
  if (answers[lastQ.id] === undefined) return;

  // Calculate dimension scores
  const rawScores = { EI: 0, SN: 0, TF: 0, JP: 0 };
  for (const q of questions) {
    let score = answers[q.id] || 0;
    if (q.reverse) score = 4 - score;  // Invert for reversed questions
    rawScores[q.dim] += score;
  }

  // Determine type (max 48 per dimension)
  const typeLetters = [];
  const dimMax = 48;
  const dims = [
    { key: 'EI', left: 'E', right: 'I' },
    { key: 'SN', left: 'S', right: 'N' },
    { key: 'TF', left: 'T', right: 'F' },
    { key: 'JP', left: 'J', right: 'P' },
  ];
  const dimResults = [];

  for (const d of dims) {
    const score = rawScores[d.key];
    const pct = Math.round((score / dimMax) * 100);
    const letter = score >= dimMax / 2 ? d.left : d.right;
    typeLetters.push(letter);
    dimResults.push({ dim: d.key, letter, score, pct, max: dimMax });
  }

  const typeCode = typeLetters.join('');
  const typeInfo = mbtiState.typeData[typeCode] || null;

  renderResult(typeCode, dimResults, typeInfo);
}

function renderResult(typeCode, dimResults, typeInfo) {
  document.getElementById('mbti-test-area').style.display = 'none';
  document.getElementById('mbti-result-area').style.display = 'block';

  const typeNames = {
    INTJ: '建筑师', INTP: '逻辑学家', ENTJ: '指挥官', ENTP: '辩论家',
    INFJ: '提倡者', INFP: '调停者', ENFJ: '主人公', ENFP: '竞选者',
    ISTJ: '物流师', ISFJ: '守护者', ESTJ: '总经理', ESFJ: '执政官',
    ISTP: '鉴赏家', ISFP: '探险家', ESTP: '企业家', ESFP: '表演者',
  };

  const typeName = typeNames[typeCode] || typeCode;

  let html = '';

  // Type header
  html += `<div style="text-align:center;margin-bottom:24px">
    <div style="font-size:48px;margin-bottom:8px">${typeEmoji(typeCode)}</div>
    <div style="font-size:32px;font-weight:800;color:var(--accent);letter-spacing:4px">${typeCode}</div>
    <div style="font-size:18px;color:var(--text-secondary);margin-top:4px">${typeName}</div>
  </div>`;

  // Dimension chart
  html += `<div style="background:var(--bg-card);border-radius:var(--radius);padding:20px;margin-bottom:20px">
    <div style="font-size:15px;font-weight:600;margin-bottom:16px">📊 维度分析</div>
    ${dimResults.map(d => {
      const leftColor = d.letter === d.dim[0] ? 'var(--accent)' : 'var(--text-muted)';
      const rightColor = d.letter === d.dim[1] ? 'var(--accent)' : 'var(--text-muted)';
      const dimLabels = {
        EI: ['外向 E', '内向 I'],
        SN: ['实感 S', '直觉 N'],
        TF: ['理性 T', '感性 F'],
        JP: ['判断 J', '感知 P'],
      };
      const [leftL, rightL] = dimLabels[d.dim];
      const pctA = d.pct;
      const pctB = 100 - d.pct;

      return `<div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="color:${leftColor};font-weight:${d.letter === d.dim[0] ? '700' : '400'}">${leftL}</span>
          <span style="color:var(--text-muted);font-size:11px">${d.score}/${d.max}</span>
          <span style="color:${rightColor};font-weight:${d.letter === d.dim[1] ? '700' : '400'}">${rightL}</span>
        </div>
        <div style="display:flex;height:28px;border-radius:6px;overflow:hidden;background:var(--border-light)">
          <div style="width:${pctA}%;background:${d.letter === d.dim[0] ? 'var(--accent)' : '#b2bec3'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;transition:width 0.6s">
            ${pctA > 15 ? pctA + '%' : ''}
          </div>
          <div style="flex:1;background:${d.letter === d.dim[1] ? 'var(--accent)' : '#b2bec3'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;transition:width 0.6s">
            ${pctB > 15 ? pctB + '%' : ''}
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  // Type description
  if (typeInfo) {
    html += `<div style="background:var(--bg-card);border-radius:var(--radius);padding:20px;margin-bottom:20px">
      <div style="font-size:16px;font-weight:700;color:var(--accent);margin-bottom:12px">✨ 概述</div>
      <p style="line-height:1.8">${escapeHtml(typeInfo.summary)}</p>
    </div>`;

    html += `<div class="grid-2" style="margin-bottom:20px">
      <div style="background:var(--bg-card);border-radius:var(--radius);padding:20px">
        <div style="font-size:16px;font-weight:700;color:#27ae60;margin-bottom:12px">💪 优势</div>
        <ul style="margin:0;padding-left:20px;line-height:2">
          ${typeInfo.strengths.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ul>
      </div>
      <div style="background:var(--bg-card);border-radius:var(--radius);padding:20px">
        <div style="font-size:16px;font-weight:700;color:#e74c3c;margin-bottom:12px">⚠️ 需注意</div>
        <ul style="margin:0;padding-left:20px;line-height:2">
          ${typeInfo.weaknesses.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
        </ul>
      </div>
    </div>`;

    html += `<div class="grid-2" style="margin-bottom:20px">
      <div style="background:var(--bg-card);border-radius:var(--radius);padding:20px">
        <div style="font-size:16px;font-weight:700;color:var(--accent);margin-bottom:12px">💼 适合职业</div>
        <p style="line-height:1.8">${typeInfo.careers.join('、')}</p>
      </div>
      <div style="background:var(--bg-card);border-radius:var(--radius);padding:20px">
        <div style="font-size:16px;font-weight:700;color:var(--accent);margin-bottom:12px">❤️ 感情特征</div>
        <p style="line-height:1.8">${escapeHtml(typeInfo.relationships)}</p>
      </div>
    </div>`;

    html += `<div style="background:var(--bg-card);border-radius:var(--radius);padding:20px;margin-bottom:20px">
      <div style="font-size:16px;font-weight:700;color:var(--accent);margin-bottom:12px">🌟 知名人物</div>
      <p style="line-height:1.8">${typeInfo.famous.join('、')}</p>
    </div>`;
  }

  // Retry button
  html += `<div style="text-align:center;margin-top:24px">
    <button class="btn btn-primary" onclick="startMbtiTest()" style="font-size:16px;padding:14px 40px">
      🔄 重新测试
    </button>
  </div>`;

  document.getElementById('mbti-result-area').innerHTML = html;
  document.getElementById('mbti-result-area').scrollIntoView({ behavior: 'smooth' });
}

function dimLabel(dim) {
  const map = { EI: '外向↔内向', SN: '实感↔直觉', TF: '理性↔感性', JP: '判断↔感知' };
  return map[dim] || dim;
}

function optionEmoji(val) {
  const emojis = ['😤', '😐', '🤔', '😊', '😍'];
  return emojis[val] || '🤔';
}

function typeEmoji(code) {
  const map = {
    INTJ: '🏛️', INTP: '🔬', ENTJ: '👑', ENTP: '💡',
    INFJ: '🌿', INFP: '🦋', ENFJ: '🌟', ENFP: '🎨',
    ISTJ: '⚙️', ISFJ: '🛡️', ESTJ: '📋', ESFJ: '🤗',
    ISTP: '🔧', ISFP: '🌸', ESTP: '🔥', ESFP: '🎭',
  };
  return map[code] || '🧠';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// Auto-start on page load
document.addEventListener('DOMContentLoaded', () => {
  startMbtiTest();
});
