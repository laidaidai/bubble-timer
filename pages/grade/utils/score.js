// 批改、统计、答案文本解析（只用真实作答与标准答案，不掺任何模拟数据）
const { OPTIONS, moduleOfQuestion, paperModules, questionPoints } = require('./data.js');

// 批改：answers = { qNo: 'A'... }, standard = 数组（下标0=第1题），没导入时传 null
// 没有标准答案的题不计入任何统计，绝不编造答案凑数
// 计分：按每题真实分值累加（政治 0.5 / 资料 1.0 等），满分固定 100；
// 缺标准答案的题连同其分值一起从分母剔除，再折算回 100，避免缺答案把分数压低
function grade(paper, answers, standard) {
  const total = paper.total;
  const mods = paperModules(paper);
  const pts = questionPoints(paper);
  const std = standard || [];
  const hasStd = (v) => !!v && OPTIONS.indexOf(v) >= 0;
  const questions = [];
  let right = 0, wrong = 0, blank = 0, noStd = 0;
  let earned = 0, available = 0;

  for (let i = 1; i <= total; i++) {
    const user = answers[i] || '';
    const correct = std[i - 1] || '';
    const mod = moduleOfQuestion(i, paper);
    const scored = mod ? mod.scored : true;
    const point = scored ? (pts[i - 1] || 0) : 0;
    let status = 'blank'; // right | wrong | blank | nostd
    if (!hasStd(correct)) {
      status = 'nostd';
      noStd++;
    } else if (user && OPTIONS.includes(user)) {
      status = user === correct ? 'right' : 'wrong';
    }
    const counted = scored && status !== 'nostd';
    if (counted) {
      available += point;
      if (status === 'right') { right++; earned += point; }
      else if (status === 'wrong') wrong++;
      else blank++;
    }
    questions.push({
      no: i,
      moduleKey: mod ? mod.key : '',
      scored,
      point: Math.round(point * 100) / 100,
      user,
      correct,
      status,
      got: status === 'right' && scored ? Math.round(point * 100) / 100 : 0,
    });
  }

  // 分数用「分值百分」整数换算，避免 24.85 这类浮点误差把 0.1 分算丢
  const earned100 = Math.round(earned * 100);
  const avail100 = Math.round(available * 100);
  const score = avail100 === 0
    ? 0
    : Math.round((earned100 * 1000) / avail100) / 10;

  // 模块统计（按本卷排布）：分母只算有标准答案的题，分值同样只算有答案的题
  const moduleStats = mods.map((m) => {
    const qs = questions.filter((q) => q.moduleKey === m.key);
    const graded = qs.filter((q) => q.status !== 'nostd');
    const r = graded.filter((q) => q.status === 'right').length;
    const t = graded.length;
    let modEarned = 0;
    let modPoints = 0;
    for (let i = 0; i < graded.length; i++) {
      const q = graded[i];
      if (q.scored) { modPoints += q.point; if (q.status === 'right') modEarned += q.point; }
    }
    // 缺标准答案时分母缩水，模块得分按同一比例折算回模块满分，保证各模块得分相加与分数卡一致
    const modGot = m.scored && modPoints > 0
      ? Math.round((modEarned / modPoints) * m.points * 100) / 100
      : 0;
    return {
      key: m.key,
      name: m.name,
      short: m.short,
      scored: m.scored,
      right: r,
      total: t,
      pct: t === 0 ? 0 : Math.round((r / t) * 1000) / 10,
      points: Math.round(m.points * 100) / 100,
      pointTotal: Math.round(modPoints * 100) / 100,
      got: modGot,
      questions: qs,
    };
  });

  return {
    score,
    right,
    wrong,
    blank,
    scoredTotal: questions.filter((q) => q.scored && q.status !== 'nostd').length,
    noStd,
    earnedPoints: Math.round(earned * 100) / 100,
    totalPoints: Math.round(available * 100) / 100,
    questions,
    moduleStats,
    standard: std,
  };
}


// 解析粘贴的答案文本，兼容常见试卷答案与 AI 返回形式：
// 1. 题号+选项：1.A / 1、A / 1 A / 1:A / 1)A / 1-A / 1A /
//    （1）A / 第1题：A / 1题A / 1、选A
// 2. 区间分块：1-5 ABCDA / 1—5题：A B C D A / 1至5题：A,B,C,D,A
// 3. 表格行：1 | A / | 1 | A |
// 4. 纯选项序列：A B C D、A、B、C、D、逗号/换行/空格分隔，或 ABCD 连写
// 5. 未识别：1.? / 1？ / 1.未识别 / 1.看不清
// 有题号时按题号填；只有完全没有题号时才按出现顺序填纯选项。
// 返回 { answers, filled, missing, errors }，answers 下标0=第1题
function parseAnswerText(text, total) {
  const errors = [];
  const answers = new Array(total).fill('');
  const skipped = {};
  let working = String(text || '');

  // 全角字母 / 数字 / 常见标点转半角：不同 AI 客户端复制出来经常混用
  working = working.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) => {
    const c = ch.charCodeAt(0);
    if (c >= 0xFF10 && c <= 0xFF19) return String.fromCharCode(c - 0xFF10 + 48);
    if (c >= 0xFF21 && c <= 0xFF3A) return String.fromCharCode(c - 0xFF21 + 65);
    return String.fromCharCode(c - 0xFF41 + 97);
  });
  working = working
    .replace(/[．。]/g, '.')
    .replace(/[，]/g, ',')
    .replace(/[：]/g, ':')
    .replace(/[；]/g, ';')
    .replace(/[？]/g, '?')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[－—–]/g, '-')
    .replace(/[～]/g, '~');

  // AI 常把答案包在 Markdown 代码块或英文标签里；先去噪，
  // 避免 "text" / "answer" 里的字母被误当成选项。
  working = working.replace(/```[A-Za-z0-9_-]*/g, ' ').replace(/`/g, ' ');
  working = working.replace(/\b(?:answer|answers|option|options|correct|text)\b/gi, ' ');

  let hasNumbered = false;

  // 先摘掉未识别占位，保留空位，避免后续选项错位
  const skipRe = /(\d+)\s*(?:题)?\s*[.,:、)）\-]?\s*(?:[?]|未识别|看不清|无法判断|未填涂|未作答)/g;
  working = working.replace(skipRe, (whole, no) => {
    const n = parseInt(no, 10);
    if (n >= 1 && n <= total) skipped[n - 1] = true;
    else errors.push(`题号 ${no} 超出范围（1-${total}）`);
    return ' ';
  });

  // 区间分块，如 "1-5 ABCDA" "1—5题：A B C D A"
  const rangeRe = /(?:第\s*)?(\d+)\s*[-~至到]\s*(?:第\s*)?(\d+)\s*题?\s*[.,:、]?\s*((?:[A-Da-d?][\s,;、]*){2,})/g;
  working = working.replace(rangeRe, (whole, s, e, letters) => {
    hasNumbered = true;
    const start = parseInt(s, 10);
    const end = parseInt(e, 10);
    const ls = String(letters).replace(/[^A-Da-d?]/g, '').toUpperCase().split('');
    if (start >= 1 && end >= start && end <= total) {
      for (let i = 0; i < ls.length; i++) {
        const no = start + i;
        if (no <= end && no <= total) {
          if (ls[i] === '?') skipped[no - 1] = true;
          else answers[no - 1] = ls[i];
        }
      }
    } else {
      errors.push(`题号区间 ${s}-${e} 超出范围（1-${total}）`);
    }
    return ' ';
  });

  // 表格行，如 "1 | A" / "| 1 | A |"；AI 返回表格时也能直接粘
  const tableRe = /(\d+)\s*[|｜]\s*([A-Da-d])\b/g;
  working = working.replace(tableRe, (whole, no, letter) => {
    hasNumbered = true;
    const n = parseInt(no, 10);
    if (n >= 1 && n <= total) answers[n - 1] = String(letter).toUpperCase();
    else errors.push(`题号 ${no} 超出范围（1-${total}）`);
    return ' ';
  });

  // 题号 + 选项，兼容 "1.A" "1、A" "1 A" "1:A" "1)A" "1-A" "1A"
  // "（1）A" "第1题 A" "1题A" "1、选A"
  const numRe = /(?:第\s*)?[（(【\[]?\s*(\d+)\s*[）)】\]]?\s*题?\s*[.,:、\-]?\s*(?:选|答案|选项)?\s*([A-Da-d])/g;
  working = working.replace(numRe, (whole, no, letter) => {
    hasNumbered = true;
    const n = parseInt(no, 10);
    if (n >= 1 && n <= total) answers[n - 1] = String(letter).toUpperCase();
    else errors.push(`题号 ${no} 超出范围（1-${total}）`);
    return ' ';
  });

  // 只有完全没有题号时才按顺序填纯选项；有题号时不再用残留字母兜底，
  // 避免解释文字里的 A/B/C 被误填到空题。
  const letters = working.match(/[A-Da-d]/g) || [];
  let cursor = 0;
  if (!hasNumbered) {
    for (let i = 0; i < total; i++) {
      if (!answers[i] && !skipped[i] && cursor < letters.length) {
        answers[i] = letters[cursor].toUpperCase();
        cursor++;
      }
    }
  }

  const filled = answers.filter(Boolean).length;
  const missing = [];
  for (let i = 0; i < total; i++) {
    if (!answers[i]) missing.push(i + 1);
  }
  const extra = hasNumbered ? 0 : letters.length - cursor;
  const badLetters = filled < total ? (working.match(/[E-Ze-z]/g) || []) : [];
  if (filled === 0) errors.push('未解析到有效答案，请粘贴 A/B/C/D 选项');
  if (extra > 0) errors.push(`有 ${extra} 个多余选项未对应到题目，请核对题号`);
  if (badLetters.length) errors.push(`存在非 A/B/C/D 的选项字母：${badLetters[0].toUpperCase()} 等`);

  return { answers, filled, missing, errors };
}

module.exports = {
  grade,
  parseAnswerText,
};
