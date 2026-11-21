const themeBind = require('../utils/theme-bind.js');
const store = require('../utils/store.js');
const { getPaper } = require('../utils/data.js');
const theme = require('../utils/theme.js');

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

Page({
  data: {
    theme: themeBind.themeData().theme,
    themeStyle: themeBind.themeData().themeStyle,
    isDesktop: false,
    list: [],
    paperName: '',
    paperId: '',
  },

  onLoad(query) {
    themeBind.sync(this);
    this.paperId = query.paperId || '';
    this.load();
  },

  // 从成绩页 / 再练一次回来后要看到新记录，所以 onShow 也刷一次
  onShow() {
    // 首次进入紧跟 onLoad，跳过重复读取
    if (this._shown) this.load();
    this._shown = true;
  },

  load() {
    const app = getApp();
    const paperId = this.paperId || this.data.paperId || '';
    const found = paperId ? getPaper(paperId) : null;
    const raw = paperId ? store.getRecordsByPaper(paperId) : store.getRecords();
    const list = raw.map((r) => {
      const done = (r.right || 0) + (r.wrong || 0) + (r.blank || 0);
      const acc = done ? ((r.right || 0) / done) * 100 : 0;
      return Object.assign({}, r, {
        timeText: formatTime(r.time),
        accText: acc.toFixed(1),
      });
    });
    this.setData({ list, paperId, paperName: found ? found.paper.name : '', isDesktop: app.globalData.isDesktop });
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
  goDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/grade/result/result?recordId=${id}` });
  },

  // 从历史直接重新作答这套卷（清掉旧草稿，避免上次没选完的答案串进来）
  retry() {
    const paperId = this.data.paperId;
    if (!paperId) return;
    store.clearDraft(paperId);
    // redirectTo：交卷后是替代当前页，返回时不会再堆一层旧页
    wx.redirectTo({
      url: `/pages/grade/answer/answer?paperId=${paperId}&mode=single`,
      fail: () => wx.showToast({ title: '打开答题页失败，请重试', icon: 'none' }),
    });
  },

  remove(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除记录',
      content: '删除后这份成绩无法恢复，确认删除？',
      confirmText: '删除',
      confirmColor: theme.getTheme().css.danger,
      success: (r) => {
        if (r.confirm) {
          store.removeRecord(id);
          this.load();
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      },
    });
  },

});
