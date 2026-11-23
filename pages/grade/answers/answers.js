const themeBind = require('../utils/theme-bind.js');
const { getPaper, paperSize } = require('../utils/data.js');
const store = require('../utils/store.js');
const { parseAnswerText } = require('../utils/score.js');

const LETTERS = ['A', 'B', 'C', 'D'];

function blankAnswers(total) {
  const arr = [];
  for (let i = 0; i < total; i += 1) arr.push('');
  return arr;
}

function normalizeAnswers(list, total) {
  const src = list || [];
  const arr = [];
  for (let i = 0; i < total; i += 1) {
    const v = String(src[i] || '').toUpperCase();
    arr.push(LETTERS.indexOf(v) >= 0 ? v : '');
  }
  return arr;
}

function countFilled(list) {
  let n = 0;
  for (let i = 0; i < (list || []).length; i += 1) if (list[i]) n += 1;
  return n;
}

function missingTextOf(list) {
  const miss = [];
  for (let i = 0; i < (list || []).length; i += 1) {
    if (!list[i]) miss.push(i + 1);
  }
  return miss.length
    ? miss.slice(0, 20).join('、') + (miss.length > 20 ? ' 等' : '')
    : '';
}

Page({
  data: {
    theme: themeBind.themeData().theme,
    themeStyle: themeBind.themeData().themeStyle,
    isDesktop: false,
    paperId: '',
    paperName: '',
    total: 0,
    text: '',
    filled: 0,
    missingText: '',
    message: '',
    answers: [],
    letters: LETTERS,
    editorNo: 0,
    editorValue: '',
    // 占位提示：一行覆盖常见导入写法，不额外解释
    ph: '1.A 2.B 3.C / A B C D / ABCD / 1-5 ABCDA',
  },

  onLoad(query) {
    themeBind.sync(this);
    const app = getApp();
    const q = query || {};
    const paperId = q.paperId || '';
    // 从带卷答题页来导入标准答案时记住计时会话，回去仍填同一份答案。
    this.timerId = q.timerId || '';
    const found = getPaper(paperId);
    if (!found) {
      wx.showToast({ title: '试卷不存在', icon: 'none' });
      return;
    }
    const total = paperSize(found.paper);
    const saved = store.getStandardAnswers(paperId, total);
    const answers = saved ? normalizeAnswers(saved, total) : blankAnswers(total);
    this.setData({
      paperId,
      paperName: found.paper.name,
      total,
      answers,
      filled: countFilled(answers),
      missingText: missingTextOf(answers),
      isDesktop: app.globalData.isDesktop,
    });
  },

  onResize() {
    const app = getApp();
    if (app && app.detectEnvironment) app.detectEnvironment();
    this.setData({ isDesktop: app.globalData.isDesktop });
  },

  // 输入时不回写 text，避免光标跳到末尾
  onInput(e) {
    this.textCache = e.detail.value;
    this.parse(e.detail.value);
  },

  parse(input) {
    const { total } = this.data;
    const text = input === undefined
      ? (this.textCache !== undefined ? this.textCache : this.data.text)
      : input;
    const r = parseAnswerText(text, total);
    const answers = normalizeAnswers(r.answers, total);
    const filled = countFilled(answers);
    this.setData({
      answers,
      filled,
      missingText: missingTextOf(answers),
      // 只有解析出错时才占一行；解析成功交给下方题号和底栏显示
      message: r.errors.length ? r.errors.join('；') : '',
    });
    return filled > 0;
  },

  // 点题号改单选：直接改成单个答案，避免误改整段文本
  openEditor(e) {
    const no = Number(e.currentTarget.dataset.no);
    if (!no || no > this.data.total) return;
    this.setData({
      editorNo: no,
      editorValue: this.data.answers[no - 1] || '',
    });
  },

  closeEditor() {
    this.setData({ editorNo: 0, editorValue: '' });
  },

  noop() {},

  applyAnswers(answers) {
    this.setData({
      answers,
      filled: countFilled(answers),
      missingText: missingTextOf(answers),
      editorNo: 0,
      editorValue: '',
    });
  },

  pickOption(e) {
    const v = String(e.currentTarget.dataset.v || '').toUpperCase();
    if (LETTERS.indexOf(v) < 0) return;
    const no = this.data.editorNo;
    if (!no) return;
    const answers = this.data.answers.slice();
    answers[no - 1] = v;
    this.applyAnswers(answers);
  },

  clearOne() {
    const no = this.data.editorNo;
    if (!no) return;
    const answers = this.data.answers.slice();
    answers[no - 1] = '';
    this.applyAnswers(answers);
  },

  save() {
    const { total, filled, missingText } = this.data;
    if (filled === 0) {
      wx.showToast({ title: '先导入或选择答案', icon: 'none' });
      return;
    }
    if (filled < total) {
      const tail = missingText ? `（缺：${missingText}）` : '';
      wx.showModal({
        title: '答案不全',
        content: `缺 ${total - filled} 题${tail}，缺的题不参与批改，仍要保存？`,
        success: (r) => { if (r.confirm) this.persist(); },
      });
    } else {
      this.persist();
    }
  },

  persist() {
    const { paperId, answers } = this.data;
    // 只存用户确认过的 A–D，缺的留空；绝不拿系统编的字母凑数
    store.saveStandardAnswers(paperId, answers);
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  // 自定义顶栏返回：有上级就回上级，直接打开时回批改首页
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/grade/index/index' }) });
    } else {
      wx.reLaunch({ url: '/pages/grade/index/index' });
    }
  },

  goAnswer() {
    const paperId = this.data.paperId;
    if (!paperId) return;
    const timerId = this.timerId || '';
    wx.navigateTo({
      url: `/pages/grade/answer/answer?paperId=${paperId}&mode=single${timerId ? `&timerId=${encodeURIComponent(timerId)}` : ''}`,
      fail: () => wx.showToast({ title: '打开答题页失败，请重试', icon: 'none' }),
    });
  },

  clear() {
    wx.showModal({
      title: '清除参考答案',
      content: '清除后本卷无法批改，确认？',
      success: (r) => {
        if (!r.confirm) return;
        store.clearStandardAnswers(this.data.paperId);
        this.textCache = '';
        this.setData({
          text: '',
          answers: blankAnswers(this.data.total),
          filled: 0,
          missingText: '',
          message: '',
          editorNo: 0,
          editorValue: '',
        });
      },
    });
  },
});
