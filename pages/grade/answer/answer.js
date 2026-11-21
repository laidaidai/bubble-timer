const themeBind = require('../utils/theme-bind.js');
const { OPTIONS, getPaper, paperSize, paperModules, questionPoints } = require('../utils/data.js');
const store = require('../utils/store.js');
const { grade } = require('../utils/score.js');

// 分值展示：整数直接显示，0.5 / 1.5 这类保留一位；附加题（0 分）留空不显示
function fmtPoint(v) {
  if (typeof v !== 'number' || !isFinite(v) || v <= 0) return '';
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
}

Page({
  data: {
    theme: themeBind.themeData().theme,
    themeStyle: themeBind.themeData().themeStyle,
    isDesktop: false,
    paperId: '',
    paperName: '',
    bankName: '',
    groupName: '',
    total: 0,
    OPTIONS,
    modules: [],
    activeKey: '',
    activeModule: null,
    mode: 'list', // list | single
    currentNo: 1,
    current: null,
    qFlip: false, // 逐题模式换题时切一下，让题目卡片重新播入场动画
    flipDir: 'next', // next | prev：新卡片从哪一侧推入
    ghostNo: 0, // 离场卡：上一题题号（换题时短暂渲染，滑出后清 0）
    ghostPointText: '',
    answers: {},
    answeredCount: 0,
    showCard: false,
    sheetGroups: [],
    canPrev: false,
    canNext: true,
    submitting: false,
  },

  onLoad(query) {
    themeBind.sync(this);
    const app = getApp();
    this.setData({ isDesktop: app.globalData.isDesktop });
    const paperId = query.paperId || '';
    const mode = query.mode === 'single' ? 'single' : 'list';
    const found = getPaper(paperId);
    if (!found) {
      wx.showToast({ title: '试卷不存在', icon: 'none' });
      return;
    }
    const { bank, group, paper } = found;
    const paperName = paper.name;
    const size = paperSize(paper);
    const answers = store.getDraft(paperId) || {};
    // 归一化键为数字
    const normalized = {};
    Object.keys(answers).forEach((k) => { normalized[Number(k)] = answers[k]; });

    // 每题真实分值（政治 0.5 / 资料 1.0 …），批改时按它累加
    const points = questionPoints(paper);

    const modules = paperModules(paper).map((m) => {
      return Object.assign({}, m, {
        questions: this.rangeQuestions(m.start, m.end, normalized, size, points),
        pointsText: fmtPoint(m.points),
      });
    }).filter((m) => m.questions.length > 0);

    const activeKey = modules[0].key;
    const currentNo = modules[0].questions[0].no;

    this.setData({
      paperId,
      paperName,
      bankName: bank.name,
      groupName: group.name,
      total: size,
      modules,
      activeKey,
      mode,
      answers: normalized,
      currentNo,
    });

    this.refreshDerived();
  },

  rangeQuestions(start, end, answers, total, points) {
    const list = [];
    const last = Math.min(end, total);
    for (let i = start; i <= last; i++) {
      list.push({
        no: i,
        answered: !!answers[i],
        point: points && points[i - 1] ? points[i - 1] : 0,
        pointText: fmtPoint(points && points[i - 1] ? points[i - 1] : 0),
      });
    }
    return list;
  },

  // 某题的分值：从模块里取（同一模块的细分题型分值可能不同）
  pointOf(qNo) {
    const mod = (this.data.modules || []).find((m) => qNo >= m.start && qNo <= m.end);
    if (!mod) return 0;
    const q = mod.questions.find((x) => x.no === qNo);
    return q ? q.point : 0;
  },

  refreshDerived(patch, forceSheet) {
    const source = patch || {};
    const modules = this.data.modules;
    const activeKey = source.activeKey === undefined ? this.data.activeKey : source.activeKey;
    const answers = source.answers || this.data.answers;
    const currentNo = source.currentNo === undefined ? this.data.currentNo : source.currentNo;
    const activeModule = modules.find((m) => m.key === activeKey) || modules[0];
    // 章节列表直接读 answers 渲染，这里只算一个计数给标题用
    let answeredInModule = 0;
    if (activeModule) {
      for (let i = 0; i < activeModule.questions.length; i++) {
        if (answers[activeModule.questions[i].no]) answeredInModule++;
      }
    }
    const answeredCount = Math.min(
      this.data.total,
      Object.keys(answers).filter((k) => answers[k]).length
    );
    const progressPct = this.data.total ? Math.round((answeredCount / this.data.total) * 100) : 0;

    const current = {
      no: currentNo,
      moduleKey: activeModule ? activeModule.key : activeKey,
      pointText: fmtPoint(this.pointOf(currentNo)),
    };
    const derived = Object.assign({}, source, {
      activeModule,
      answeredCount,
      answeredInModule,
      progressPct,
      current,
      canPrev: currentNo > 1,
      canNext: currentNo < this.data.total,
    });
    // 答题卡没打开时不重建 100 多个题号，否则每次点选项都要白传一大包 setData
    if (forceSheet || derived.showCard) {
      derived.sheetGroups = modules.map((m) => ({
        key: m.key,
        name: m.short || m.name,
        questions: m.questions.map((q) => ({
          no: q.no,
          answered: !!answers[q.no],
        })),
      }));
    }
    this.setData(derived);
  },

  selectOption(e) {
    if (this.suppressTap) return;
    const no = Number(e.currentTarget.dataset.no);
    const opt = e.currentTarget.dataset.opt;
    if (!no || !opt) return;
    const answers = Object.assign({}, this.data.answers);
    answers[no] = answers[no] === opt ? '' : opt;
    if (!answers[no]) delete answers[no];
    // 列表模式没有「当前题」概念，但答题卡要看它：点到哪题就把它设为当前题
    const patch = { answers };
    if (this.data.mode === 'list') {
      const mod = this.data.modules.find((m) => no >= m.start && no <= m.end);
      patch.currentNo = no;
      if (mod) patch.activeKey = mod.key;
    }
    // 选中态、进度、题号派生一次 setData 提交，避免连点两帧各刷一遍
    this.refreshDerived(patch);
    store.saveDraft(this.data.paperId, answers);

    // 逐题模式：选完自动进下一题
    if (this.data.mode === 'single' && answers[no] && no < this.data.total) {
      this.clearAdvance();
      this.advanceTimer = setTimeout(() => {
        this.advanceTimer = null;
        this.goToQuestion(no + 1);
      }, 320);
    }
  },

  clearAdvance() {
    if (this.advanceTimer) { clearTimeout(this.advanceTimer); this.advanceTimer = null; }
  },

  // 跳题后回到页面顶部：题目卡片在上方，停在旧滚动位置会看不到新题
  // 自动切题用 duration:0 瞬时归位，避免和推拉动画抢同一帧
  scrollTop(instant) {
    if (wx.pageScrollTo) wx.pageScrollTo({ scrollTop: 0, duration: instant ? 0 : 120 });
  },

  // 跳到指定题号，跨模块时同步切换 Tab
  goToQuestion(no) {
    this.clearAdvance();
    if (no < 1 || no > this.data.total) return;
    const mod = this.data.modules.find((m) => no >= m.start && no <= m.end);
    const prevNo = this.data.currentNo;
    const dir = no >= prevNo ? 'next' : 'prev';
    // 先瞬时归位，再一帧内提交题号 + 动画方向 + 派生进度，减少换题期间的连续 setData
    this.scrollTop(true);
    this.refreshDerived({
      currentNo: no,
      activeKey: mod ? mod.key : this.data.activeKey,
      showCard: false,
      // 换题方向：下一题从右侧推入、上一题从左侧推入；qFlip 交替切换动画名让同名动画重播
      flipDir: dir,
      qFlip: !this.data.qFlip,
      // 离场卡用上一题的定格画面，和新卡同一帧开始滑，推拉才看得见内容
      ghostNo: prevNo !== no ? prevNo : 0,
      ghostPointText: fmtPoint(this.pointOf(prevNo)),
    });
    // 两张卡一起滑完就把离场卡撤掉
    if (this.flipTimer) clearTimeout(this.flipTimer);
    if (prevNo !== no) {
      this.flipTimer = setTimeout(() => {
        this.flipTimer = null;
        this.setData({ ghostNo: 0, ghostPointText: '' });
      }, 280);
    }
  },

  // 左右滑动翻题：左滑下一题、右滑上一题（纵向位移大于横向时交给页面滚动）
  onTouchStart(e) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!t) return;
    this.swipe = { x: t.clientX, y: t.clientY };
  },

  onTouchEnd(e) {
    const s = this.swipe;
    this.swipe = null;
    if (!s) return;
    const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
    // 滑动结束紧跟着的 tap 不应被当成选答案
    this.suppressTap = true;
    setTimeout(() => { this.suppressTap = false; }, 350);
    if (dx < 0) this.nextQuestion();
    else this.prevQuestion();
  },

  onTouchMove(e) {
    const s = this.swipe;
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!s || !t) return;
    if (Math.abs(t.clientX - s.x) > 40 && Math.abs(t.clientX - s.x) > Math.abs(t.clientY - s.y)) {
      this.suppressTap = true;
    }
  },

  prevQuestion() {
    if (!this.data.canPrev) return;
    this.goToQuestion(this.data.currentNo - 1);
  },

  nextQuestion() {
    if (!this.data.canNext) return;
    this.goToQuestion(this.data.currentNo + 1);
  },

  switchModule(e) {
    const { key } = e.currentTarget.dataset;
    const mod = this.data.modules.find((m) => m.key === key);
    if (!mod) return;
    this.clearAdvance();
    const patch = { activeKey: key, currentNo: mod.questions[0].no };
    this.refreshDerived(patch);
    this.scrollTop();
  },

  toggleMode() {
    const mode = this.data.mode === 'list' ? 'single' : 'list';
    if (this.flipTimer) { clearTimeout(this.flipTimer); this.flipTimer = null; }
    this.setData({ mode, ghostNo: 0, ghostPointText: '' });
    this.scrollTop();
  },



  // 答题卡只在打开时重建题号状态，平时不占 setData 预算
  openCard() { this.refreshDerived({ showCard: true }, true); },
  closeCard() { this.setData({ showCard: false }); },
  // 只在蒙层内层 / 离场卡片 catchtap 用：挡住冒泡，避免误关答题卡或误触发翻题
  noop() {},

  jumpTo(e) {
    const no = Number(e.currentTarget.dataset.no);
    if (!no) return;
    this.goToQuestion(no);
  },

  submit() {
    if (this.data.submitting) return;
    const { paperId, answers, total, paperName, bankName, groupName } = this.data;
    const blank = total - this.data.answeredCount;
    // 没有参考答案就没法批改：直接引导去导入，不拿系统编的答案凑分数
    const standard = store.getStandardAnswers(paperId, total);
    if (!standard) {
      if (this.confirming) return;
      this.confirming = true;
      wx.showModal({
        title: '还没有参考答案',
        content: '批改需要本卷的参考答案，先导入再交卷。',
        confirmText: '去导入',
        success: (r) => {
          this.confirming = false;
          if (r.confirm) wx.navigateTo({ url: `/pages/grade/answers/answers?paperId=${paperId}` });
        },
        fail: () => { this.confirming = false; },
      });
      return;
    }

    const doGrade = () => {
      // 连点两次会写两条记录并跳两次，这里加锁
      if (this.submitting) return;
      this.submitting = true;
      this.setData({ submitting: true });
      const found = getPaper(paperId);
      if (!found) {
        this.submitting = false;
        this.setData({ submitting: false });
        wx.showToast({ title: '试卷数据缺失，请回首页重新进入', icon: 'none' });
        return;
      }
      const result = grade(found.paper, answers, standard);
      const record = {
        id: 'r' + Date.now(),
        paperId,
        paperName,
        bankName,
        groupName,
        time: Date.now(),
        score: result.score,
        right: result.right,
        wrong: result.wrong,
        blank: result.blank,
        customStandard: true,
        detail: result,
      };
      store.addRecord(record);
      store.clearDraft(paperId);
      wx.redirectTo({
        url: `/pages/grade/result/result?recordId=${record.id}`,
        fail: () => {
          this.submitting = false;
          this.setData({ submitting: false });
          wx.showToast({ title: '打开成绩页失败，请重试', icon: 'none' });
        },
      });
    };

    const notes = [];
    if (blank > 0) notes.push(`还有 ${blank} 题未作答。`);

    if (notes.length) {
      // 连点会弹出第二个确认框，用 confirming 挡住
      if (this.confirming) return;
      this.confirming = true;
      wx.showModal({
        title: '确认交卷',
        content: notes.join(''),
        confirmText: '交卷',
        success: (r) => {
          this.confirming = false;
          if (r.confirm) doGrade();
        },
        fail: () => { this.confirming = false; },
      });
    } else {
      doGrade();
    }
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

  // 桌面端拖动窗口 / 手机横竖屏切换时，重算一次宽屏判定，避免布局还按旧档走
  onResize() {
    const app = getApp();
    if (app && app.detectEnvironment) app.detectEnvironment();
    this.setData({ isDesktop: app.globalData.isDesktop });
  },
  onUnload() {
    // 草稿已在选择时实时缓存，退出不清除；只清掉待执行的自动跳题与离场卡定时器
    this.clearAdvance();
    if (this.flipTimer) { clearTimeout(this.flipTimer); this.flipTimer = null; }
  },
});
