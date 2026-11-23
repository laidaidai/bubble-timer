// 本地存储层：作答草稿、导入的标准答案、历史成绩记录
// 本期为本地 + 预留云端接口位；换设备同步待后端接入。

const KEY_DRAFT = (paperId) => `xc_draft_${paperId}`;
const KEY_ANSWERS = (paperId) => `xc_answers_${paperId}`;
const KEY_RECORDS = 'xc_records';
const KEY_LASTSCORE = 'xc_last_score';
// 计时页是另一个页面域，这里只读它已有的记录键，不复制计时状态。
const KEY_TIMER_RECORDS = 'exam-timer-records';
const KEY_TIMER_SESSION = 'exam-timer-session';
// 每套卷自己的计时配时：{ [moduleKey]: minutes }。没改过就不写这份覆盖。
const KEY_TIMER_PLAN = (paperId) => `xc_timer_plan_${paperId}`;
// 模块顺序单独存，保持旧 minutesMap 的兼容；只存偏离默认顺序的 key 数组。
const KEY_TIMER_PLAN_ORDER = (paperId) => `xc_timer_plan_order_${paperId}`;
const TIMER_PLAN_MIN = 1;
const TIMER_PLAN_MAX = 600;

function safeGet(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    return v === '' || v === undefined || v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (e) {}
}

// ---------- 草稿 ----------
// answers: { [qNo: number]: 'A' | 'B' | 'C' | 'D' }
function getDraft(paperId) {
  return safeGet(KEY_DRAFT(paperId), {});
}

function saveDraft(paperId, answers) {
  safeSet(KEY_DRAFT(paperId), answers || {});
}

function clearDraft(paperId) {
  try {
    wx.removeStorageSync(KEY_DRAFT(paperId));
  } catch (e) {}
}

// ---------- 标准答案 ----------
// 返回数组，下标 0 = 第 1 题；未导入时返回 null（没答案就不批改）
function getStandardAnswers(paperId, total) {
  const saved = safeGet(KEY_ANSWERS(paperId), null);
  if (Array.isArray(saved) && saved.length === total) return saved;
  return null;
}

function saveStandardAnswers(paperId, answers) {
  safeSet(KEY_ANSWERS(paperId), answers);
}

function clearStandardAnswers(paperId) {
  try { wx.removeStorageSync(KEY_ANSWERS(paperId)); } catch (e) {}
}

// ---------- 历史记录 ----------
// record: { id, paperId, paperName, bankName, groupName, time, score, right, wrong, blank, detail, answers, standard }
function getRecords() {
  return safeGet(KEY_RECORDS, []);
}

function getRecordsByPaper(paperId) {
  return getRecords().filter((r) => r.paperId === paperId);
}

function addRecord(record) {
  const list = getRecords();
  list.unshift(record);
  safeSet(KEY_RECORDS, list);
  // 同步试卷上次得分
  const last = safeGet(KEY_LASTSCORE, {});
  last[record.paperId] = record.score;
  safeSet(KEY_LASTSCORE, last);
}

function getLastScore(paperId) {
  const last = safeGet(KEY_LASTSCORE, {});
  return last[paperId] === undefined ? null : last[paperId];
}

function getRecord(recordId) {
  return getRecords().find((r) => r.id === recordId) || null;
}

function removeRecord(recordId) {
  const list = getRecords();
  const target = list.find((r) => r.id === recordId);
  const next = list.filter((r) => r.id !== recordId);
  safeSet(KEY_RECORDS, next);
  // 删掉的若正好是该卷最近一次，首页「上次得分」要回退到剩下的最新一条，
  // 否则删了记录首页还挂着那个分数
  if (target) {
    const last = safeGet(KEY_LASTSCORE, {});
    const latest = next.find((r) => r.paperId === target.paperId);
    if (latest) last[target.paperId] = latest.score;
    else delete last[target.paperId];
    safeSet(KEY_LASTSCORE, last);
  }
}

// ---------- 计时会话 / 计时记录 ----------
// 计时记录：exam-timer-records 里的 report，带 context(paperId...) 才能和本卷关联。
function getTimerRecords() {
  const list = safeGet(KEY_TIMER_RECORDS, []);
  return Array.isArray(list) ? list : [];
}

function getTimerRecord(timerId) {
  if (!timerId) return null;
  return getTimerRecords().find((r) => r && r.id === timerId) || null;
}

// 已计时完成但还没交卷的会话。历史页靠它提供「去填答案」入口。
function getPendingTimerRecords(paperId) {
  return getTimerRecords().filter((r) => {
    const ctx = r && r.context;
    if (!ctx || ctx.source !== 'grade' || !ctx.paperId) return false;
    if (paperId && ctx.paperId !== paperId) return false;
    return !r.gradeRecordId;
  });
}

function getPendingTimerForPaper(paperId) {
  return getPendingTimerRecords(paperId)[0] || null;
}

// 正在进行、还没出报告的计时会话。只用于避免同一套卷重复起跑 / 误覆盖。
function getActiveTrainingSession() {
  const session = safeGet(KEY_TIMER_SESSION, null);
  if (!session || !Array.isArray(session.modules) || !session.modules.length) return null;
  return session;
}

function getActiveTrainingForPaper(paperId) {
  const session = getActiveTrainingSession();
  if (!session || !paperId) return null;
  return session.context && session.context.paperId === paperId ? session : null;
}

// ---------- 本卷专用配时 ----------
// 只存用户改过的模块分钟；默认方案永远以 data.js 的 paperTimePlan 为准。
function getPaperTimerPlan(paperId) {
  if (!paperId) return {};
  const raw = safeGet(KEY_TIMER_PLAN(paperId), {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  Object.keys(raw).forEach((key) => {
    const minutes = Math.round(Number(raw[key]));
    if (isFinite(minutes) && minutes > 0) {
      out[key] = Math.min(TIMER_PLAN_MAX, Math.max(TIMER_PLAN_MIN, minutes));
    }
  });
  return out;
}

function savePaperTimerPlan(paperId, minutes) {
  if (!paperId) return;
  const clean = {};
  Object.keys(minutes || {}).forEach((key) => {
    const value = Math.round(Number(minutes[key]));
    if (isFinite(value) && value > 0) {
      clean[key] = Math.min(TIMER_PLAN_MAX, Math.max(TIMER_PLAN_MIN, value));
    }
  });
  if (Object.keys(clean).length) safeSet(KEY_TIMER_PLAN(paperId), clean);
  else removePaperTimerMinutes(paperId);
}

function removePaperTimerMinutes(paperId) {
  if (!paperId) return;
  try { wx.removeStorageSync(KEY_TIMER_PLAN(paperId)); } catch (e) {}
}

function getPaperTimerOrder(paperId) {
  if (!paperId) return [];
  const raw = safeGet(KEY_TIMER_PLAN_ORDER(paperId), []);
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.forEach((key) => {
    if (typeof key === 'string' && key && out.indexOf(key) < 0) out.push(key);
  });
  return out;
}

function savePaperTimerOrder(paperId, order) {
  if (!paperId) return;
  const clean = [];
  (Array.isArray(order) ? order : []).forEach((key) => {
    if (typeof key === 'string' && key && clean.indexOf(key) < 0) clean.push(key);
  });
  if (clean.length) safeSet(KEY_TIMER_PLAN_ORDER(paperId), clean);
  else clearPaperTimerOrder(paperId);
}

function clearPaperTimerOrder(paperId) {
  if (!paperId) return;
  try { wx.removeStorageSync(KEY_TIMER_PLAN_ORDER(paperId)); } catch (e) {}
}

function clearPaperTimerPlan(paperId) {
  if (!paperId) return;
  removePaperTimerMinutes(paperId);
  clearPaperTimerOrder(paperId);
}

// 交卷后把计时记录标记为已关联，避免历史里继续出现「待填答案」。
function linkTimerRecord(timerId, gradeRecordId, summary) {
  if (!timerId || !gradeRecordId) return;
  const list = getTimerRecords();
  let changed = false;
  const next = list.map((r) => {
    if (!r || r.id !== timerId) return r;
    changed = true;
    return Object.assign({}, r, {
      gradeRecordId,
      gradedAt: Date.now(),
      gradeSummary: summary || null,
    });
  });
  if (changed) safeSet(KEY_TIMER_RECORDS, next);
}

// 用户删掉计时记录时同步移除；与过关记录互不牵连。
function removeTimerRecordsForPaper(paperId) {
  if (!paperId) return;
  const next = getTimerRecords().filter((r) => !(r.context && r.context.paperId === paperId));
  safeSet(KEY_TIMER_RECORDS, next);
}

// 删掉一套卷的全部本地数据：草稿、标准答案、上次得分、历史记录
function removePaperData(paperId) {
  clearDraft(paperId);
  clearStandardAnswers(paperId);
  const last = safeGet(KEY_LASTSCORE, {});
  delete last[paperId];
  safeSet(KEY_LASTSCORE, last);
  safeSet(KEY_RECORDS, getRecords().filter((r) => r.paperId !== paperId));
  removeTimerRecordsForPaper(paperId);
  clearPaperTimerPlan(paperId);
}

module.exports = {
  getDraft,
  saveDraft,
  clearDraft,
  getStandardAnswers,
  saveStandardAnswers,
  clearStandardAnswers,
  getRecords,
  getRecordsByPaper,
  getTimerRecords,
  getTimerRecord,
  getPendingTimerRecords,
  getPendingTimerForPaper,
  getActiveTrainingSession,
  getActiveTrainingForPaper,
  getPaperTimerPlan,
  savePaperTimerPlan,
  clearPaperTimerPlan,
  getPaperTimerOrder,
  savePaperTimerOrder,
  clearPaperTimerOrder,
  linkTimerRecord,
  removeTimerRecordsForPaper,
  addRecord,
  getLastScore,
  getRecord,
  removeRecord,
  removePaperData,
};
