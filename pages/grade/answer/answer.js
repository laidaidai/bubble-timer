const themeBind = require('../utils/theme-bind.js');
const { OPTIONS, getPaper, paperSize, paperModules, questionPoints } = require('../utils/data.js');
const store = require('../utils/store.js');
const { grade, parseAnswerText } = require('../utils/score.js');

// 分值展示：整数直接显示，0.5 / 1.5 这类保留一位；附加题（0 分）留空不显示
function fmtPoint(v) {
  if (typeof v !== 'number' || !isFinite(v) || v <= 0) return '';
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
}

// 给外部 AI 的识别提示词：新版“精准快速版”，去掉顶部标题，题数按当前试卷带入。
// 140 题时正好是 7 行 × 20 题、28 个 5 题组；其他题量按实际题号收尾。
function buildAnswerPrompt(total) {
  const count = Math.max(1, Math.round(Number(total) || 0));
  const groupCount = Math.ceil(count / 5);
  const rowCount = Math.ceil(count / 20);
  return [
    "## 一、角色与核心任务",
    '',
    "你是一套专业的答题卡图像识别系统。",
    '',
    "你的唯一任务是根据答题卡图像中真实存在的黑色填涂痕迹，准确识别每道题选择的 A、B、C、D 选项。",
    '',
    "核心原则：准确性优先、效率优先、禁止猜测。",
    '',
    "严禁根据题目内容、答案规律、相邻题答案、选项分布或主观概率推测答案。",
    '',
    "只认定图像中能够观察到的实际填涂证据。",
    '',
    "## 二、答题卡默认版式",
    '',
    "默认采用以下结构：",
    '',
    `- 竖版答题卡，共${rowCount}行，每行20题。`,
    "- 每行分为4组，每组5题。",
    "- 第一行：1-5、6-10、11-15、16-20。",
    "- 第二行：21-25、26-30、31-35、36-40。",
    `- 后续依此递增，完整答题卡共${count}题。`,
    "- 每组内部题号从左向右递增。",
    "- 每道题的A、B、C、D选项从上到下纵向排列。",
    '',
    "上述是默认版式，不是强制坐标。",
    '',
    "开始识别时，快速确认图片方向、题号范围、分组数量和选项排列。",
    '',
    "如果图片存在旋转、裁切、透视变形或版式变化，以实际图像为准，不能机械套用默认布局。",
    '',
    "只识别图像中实际存在的题目，不得补造缺失题目。",
    '',
    "## 三、图像识别流程",
    '',
    "按照以下四个阶段执行，不需要输出冗长的分析过程。",
    '',
    "### 阶段1：整体定位",
    '',
    "快速完成以下检查：",
    '',
    "1. 判断图片方向和清晰度。",
    "2. 定位题号、每行题目及每组5题的区域。",
    "3. 确认A、B、C、D四个选项的位置。",
    "4. 检查是否存在裁切、遮挡、阴影或严重变形。",
    '',
    "定位完成后，建立题号与选项区域的对应关系，避免跨组、跨题识别。",
    '',
    "### 阶段2：填涂识别",
    '',
    "支持两种识别模式：",
    '',
    "**模式A：双图对比（优先使用）**",
    '',
    "同时提供填涂答题卡和空白答题卡时：",
    '',
    "1. 以题号、边框、选项位置作为对齐依据。",
    "2. 对两张图片进行整体对齐，必要时进行局部位置校正。",
    "3. 比较同一题A、B、C、D四个选项的变化。",
    "4. 优先识别填涂图中相对于空白图新增的黑色笔迹。",
    '',
    "注意排除原有印刷字母、括号、边框、底纹和纸张阴影。",
    '',
    "两张图片存在角度或位置差异时，必须先对齐，不能直接比较相同像素位置。",
    '',
    "**模式B：单图识别**",
    '',
    "只提供填涂答题卡时：",
    '',
    "直接检查每道题的四个选项，判断实际填涂痕迹。",
    '',
    "识别时重点观察：",
    '',
    "- 黑色区域的位置是否位于选项有效区域。",
    "- 填涂面积是否具有一定连续性。",
    "- 黑度是否明显区别于印刷内容。",
    "- 是否存在擦除、重复填涂或其他干扰。",
    "- 是否有相邻题目笔迹造成的误判。",
    '',
    "不能仅凭某个区域颜色较深就判定为选中。",
    '',
    "### 阶段3：逐题记录",
    '',
    "严格按照实际题号依次识别。",
    '',
    "每道题只比较其自身的A、B、C、D四个选项。",
    '',
    "| 图像情况 | 识别结果 |",
    "|---|---|",
    "| 只有A明显填涂 | A |",
    "| 只有B明显填涂 | B |",
    "| 只有C明显填涂 | C |",
    "| 只有D明显填涂 | D |",
    "| 两个或以上选项明显填涂 | 多选 |",
    "| 四个选项均无明显填涂 | 未填涂，记为 ? |",
    "| 填涂痕迹模糊，无法确认 | 无法判断，记为 ? |",
    "| 存在涂改且无法确认最终答案 | 涂改待核对 |",
    "| 填涂不完整但仍有明确有效痕迹 | 根据实际痕迹判断 |",
    '',
    "特别注意：",
    '',
    "- 不得把印刷内容识别成填涂。",
    "- 不得把纸张阴影、污点和噪点识别成答案。",
    "- 不得将上一题或下一题的填涂痕迹归入当前题目。",
    "- 不得因填涂较浅或面积较小而直接判定未填涂。",
    "- 无法确定时必须使用 ?，严禁猜测。",
    '',
    "### 阶段4：快速独立复核",
    '',
    "完成第一遍识别后，立即进行第二遍检查。",
    '',
    "第二遍以图像为依据重新核对，不得直接照抄第一遍结果。",
    '',
    "复核重点：",
    '',
    "1. 按照实际题号重新检查每个5题小组。",
    "2. 确认每组恰好对应5道题。",
    "3. 检查是否存在漏题、重复题号、错位或跨组混淆。",
    "4. 重点重新检查多选、未填涂、涂改和无法判断的题目。",
    "5. 检查相邻题目的笔迹是否发生误归属。",
    "6. 对两遍结果不一致的题目重新检查局部图像。",
    '',
    "不需要重复输出每道题的分析过程，只需完成内部复核并修正有证据支持的识别结果。",
    '',
    "不能为了让两遍答案一致而强行修改结果。",
    '',
    "## 四、异常处理与质量控制",
    '',
    "以下情况必须列入异常清单：",
    '',
    "- 多选：同一道题有两个或以上明显填涂选项。",
    "- 未填涂：四个选项均无明显填涂。",
    "- 涂改：存在擦除或重复填写，最终答案无法确认。",
    "- 无法判断：受模糊、遮挡、光线或其他因素影响，无法可靠识别。",
    '',
    "处理规则：",
    '',
    "- 多选和未填涂必须明确标注。",
    "- 涂改无法确认时必须标注。",
    "- 无法判断的题目答案使用 ?。",
    "- 不得隐藏任何异常题目。",
    '',
    "**质量控制阈值：**",
    '',
    "如果无法可靠判断的题目超过实际识别题目总数的20%，停止输出完整答案代码块，并提示：",
    '',
    "图像不够清晰，请分段重拍，或补发空白答题卡原图。",
    '',
    "如果无法判断的题目不超过20%，可以继续输出，但所有异常必须明确标注。",
    '',
    "## 五、最终输出格式",
    '',
    "最终只允许输出以下三个部分，不输出冗长分析过程。",
    '',
    "### 第一部分：版式确认",
    '',
    "固定格式：",
    '',
    "版式：竖版，每行20题，每5题一组；题号组内从左向右递增，选项纵向排列。",
    '',
    "如果实际版式不同，则按照实际版式说明。",
    '',
    "### 第二部分：异常情况",
    '',
    "没有异常时：",
    '',
    "全部已识别。",
    '',
    "存在异常时：",
    '',
    "需核对：第5题存在多选；第12题未填涂；第27题存在涂改；第35题无法判断。",
    '',
    "如果无法判断题目超过20%，只输出版式确认、异常情况以及图像质量提醒，不输出答案代码块。",
    '',
    "### 第三部分：可直接复制的答案",
    '',
    "**必须使用标准 Markdown 的 text 代码块输出答案。**",
    '',
    "代码块必须严格采用以下格式：",
    '',
    "```text",
    "1-5 DCDAB 6-10 BCDAB 11-15 CDABC 16-20 DABCD",
    "21-25 ABCDA 26-30 BCDAB 31-35 CDABC 36-40 DABCD",
    "```",
    '',
    "输出要求：",
    '',
    "1. 必须使用三个反引号加 text，即 ```text。",
    "2. 答案全部放在代码块内部，方便用户一键复制。",
    "3. 代码块内部只允许出现题号范围和答案，不得出现解释、备注或异常说明。",
    "4. 每组必须有且只有5个答案字符。",
    "5. 每组前面标注实际题号范围。",
    "6. 每组之间使用一个空格分隔。",
    "7. 每道题只能对应一个字符。",
    "8. 正常答案使用大写A、B、C、D。",
    "9. 未填涂、无法判断、多选和无法确认的涂改题统一使用 ?。",
    "10. 按照实际题号顺序输出，不得遗漏、重复或擅自补充题目。",
    `11. 完整${count}题必须输出${rowCount}行、${groupCount}组，每行4组。`,
    "12. 每行20题，不允许将所有答案挤在一行。",
    "13. 代码块外不得重复输出一遍答案。",
    '',
    "**特别强调：最终答案必须是可以直接复制的纯文本代码块，不得使用普通段落、表格、JSON或其他格式代替。**",
    '',
    "## 六、最高优先级执行原则",
    '',
    "第一：看实际填涂，不看答案规律。",
    '',
    "第二：先定位题号，再判断选项，禁止跨题归属。",
    '',
    "第三：有空白答题卡时，优先双图对比。",
    '',
    "第四：识别与复核分开执行，重点检查容易出错的题目。",
    '',
    "第五：无法确认就标记 ?，绝不猜测。",
    '',
    "第六：严格按照规定输出，确保答案代码块可以直接复制。",
    '',
    "现在开始检查用户提供的答题卡图片，直接完成识别、复核和结果输出。",
  ].join('\n');
}

// 输入框占位提示：教程 + 支持格式，一行一个，不写额外规则。
const IMPORT_PLACEHOLDER_LINES = [
  '复制提示词，把答题卡照片发给 AI。',
  '有空白原图一起发，识别结果粘到这里。',
  '支持格式:',
  '1-5 ABCDA',
  '1.A 2.B 3.C',
  '1、A 2、B',
  '1A2B',
];

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
    singleLayout: 'vertical', // vertical | grid：逐题默认竖排，可切 2×2
    currentNo: 1,
    current: null,
    prevModule: null,
    prevModuleLabel: '',
    tabScrollId: '',
    nextModule: null,
    nextModuleLabel: '',
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
    showImport: false,
    importPlaceholderLines: IMPORT_PLACEHOLDER_LINES,
    importHasText: false,
    importParsed: 0,
    importError: '',
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
    // 上一章 / 下一章只在存在相邻模块时出现，不在首尾循环，避免误触跳回另一端
    const modIndex = modules.findIndex((m) => m.key === (activeModule ? activeModule.key : activeKey));
    const nextSource = modIndex >= 0 && modIndex < modules.length - 1 ? modules[modIndex + 1] : null;
    const prevSource = modIndex > 0 ? modules[modIndex - 1] : null;
    const nextModule = nextSource ? { key: nextSource.key, name: nextSource.short || nextSource.name } : null;
    const prevModule = prevSource ? { key: prevSource.key, name: prevSource.short || prevSource.name } : null;
    const nextModuleLabel = nextSource ? '下一章' : '';
    const prevModuleLabel = prevSource ? '上一章' : '';
    const derived = Object.assign({}, source, {
      activeModule,
      answeredCount,
      answeredInModule,
      progressPct,
      current,
      prevModule,
      prevModuleLabel,
      nextModule,
      nextModuleLabel,
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
    const threshold = this.data.mode === 'list' ? 64 : 50;
    if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return;
    // 滑动结束紧跟着的 tap 不应被当成选答案
    this.suppressTap = true;
    setTimeout(() => { this.suppressTap = false; }, 350);
    if (this.data.mode === 'list') {
      // 列表页横向滑动换章节；逐题页才是上一题 / 下一题
      this.switchModuleStep(dx < 0 ? 1 : -1);
    } else if (dx < 0) {
      this.nextQuestion();
    } else {
      this.prevQuestion();
    }
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
    this.applyModule(key);
  },

  // 切章统一入口：点顶部 tab、滑动手势、底部上一章/下一章都走这里
  applyModule(key) {
    const mod = this.data.modules.find((m) => m.key === key);
    if (!mod) return;
    this.clearAdvance();
    this.refreshDerived({ activeKey: key, currentNo: mod.questions[0].no, tabScrollId: 'tab-' + key });
    this.scrollTop();
  },

  // 列表模式左右滑动切章：左滑下一章，右滑上一章
  switchModuleStep(delta) {
    if (this.data.modules.length < 2) return;
    const target = delta > 0 ? this.data.nextModule : this.data.prevModule;
    if (!target) return;
    this.applyModule(target.key);
  },

  // 列表模式底部的「下一章」；最后一章循环回第一章
  goNextModule() {
    this.switchModuleStep(1);
  },

  // 列表模式底部的「上一章」；第一章循环回最后一章
  goPrevModule() {
    this.switchModuleStep(-1);
  },

  toggleSingleLayout() {
    this.setData({ singleLayout: this.data.singleLayout === 'grid' ? 'vertical' : 'grid' });
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

  // AI 识别导入：复制提示词 → 拍照识别 → 粘贴结果 → 自动填涂
  buildAiPrompt() {
    return buildAnswerPrompt(this.data.total);
  },

  copyAiPrompt() {
    const data = this.buildAiPrompt();
    if (!data) return;
    wx.setClipboardData({
      data,
      success: () => wx.showToast({ title: '提示词已复制', icon: 'none' }),
      fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }),
    });
  },

  openImport() {
    this.importTextCache = '';
    this.setData({
      showImport: true,
      showCard: false,
      importHasText: false,
      importParsed: 0,
      importError: '',
    });
  },

  closeImport() {
    this.setData({ showImport: false, importHasText: false, importParsed: 0, importError: '' });
  },

  // 输入时只更新预览，不回写 textarea，避免光标跳到末尾
  onImportInput(e) {
    this.importTextCache = e.detail.value;
    const text = e.detail.value || '';
    const r = parseAnswerText(text, this.data.total);
    this.setData({
      importHasText: !!text,
      importParsed: r.filled,
      importError: text ? r.errors.join('；') : '',
    });
  },

  applyImport() {
    const text = this.importTextCache || '';
    const r = parseAnswerText(text, this.data.total);
    if (!r.filled) {
      this.setData({
        importParsed: 0,
        importError: r.errors[0] || '先粘贴 AI 返回的选项',
      });
      return;
    }
    // 只覆盖识别到的题；未识别题保留原有作答，避免一次识别失败清掉已填内容
    const answers = Object.assign({}, this.data.answers);
    for (let i = 0; i < this.data.total; i += 1) {
      if (r.answers[i]) answers[i + 1] = r.answers[i];
    }
    this.refreshDerived({ answers, showImport: false, showCard: false });
    store.saveDraft(this.data.paperId, answers);
    this.importTextCache = '';
    wx.showToast({ title: `已填入 ${r.filled} 题`, icon: 'none' });
  },

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
