// 本地存储层：作答草稿、导入的标准答案、历史成绩记录
// 本期为本地 + 预留云端接口位；换设备同步待后端接入。

const KEY_DRAFT = (paperId) => `xc_draft_${paperId}`;
const KEY_ANSWERS = (paperId) => `xc_answers_${paperId}`;
const KEY_RECORDS = 'xc_records';
const KEY_LASTSCORE = 'xc_last_score';

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

// 删掉一套卷的全部本地数据：草稿、标准答案、上次得分、历史记录
function removePaperData(paperId) {
  clearDraft(paperId);
  clearStandardAnswers(paperId);
  const last = safeGet(KEY_LASTSCORE, {});
  delete last[paperId];
  safeSet(KEY_LASTSCORE, last);
  safeSet(KEY_RECORDS, getRecords().filter((r) => r.paperId !== paperId));
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
  addRecord,
  getLastScore,
  getRecord,
  removeRecord,
  removePaperData,
};
