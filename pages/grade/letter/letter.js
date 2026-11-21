const themeBind = require('../utils/theme-bind.js');
Page({
  data: {
    theme: themeBind.themeData().theme,
    themeStyle: themeBind.themeData().themeStyle,
    isDesktop: false,
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
  onLoad() {
    themeBind.sync(this);
    const app = getApp();
    this.setData({ isDesktop: app.globalData.isDesktop });
  },
});
