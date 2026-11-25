const app = getApp()

Page({
  data: {
    isDesktop: !!(getApp() && getApp().globalData && getApp().globalData.isDesktop),
    theme: 'sky',
    themeStyle: '',
    dockDim: false
  },

  onLoad() {
    const theme = (app.getTheme && app.getTheme()) || { key: 'sky' }
    this.setData({
      isDesktop: !!(app.globalData && app.globalData.isDesktop),
      theme: theme.key,
      themeStyle: theme.style || ''
    })
    if (app.applyNavBar) app.applyNavBar()
  },

  onShow() {
    this.syncTheme()
  },

  // 桌面窗口拖动 / 平板横竖屏切换后重判，根节点 desk 类随之切换
  onResize() {
    const desktop = app && app.detectEnvironment
      ? app.detectEnvironment()
      : !!(app && app.globalData && app.globalData.isDesktop)
    if (desktop !== this.data.isDesktop) this.setData({ isDesktop: desktop })
  },

  syncTheme() {
    const theme = (app.getTheme && app.getTheme()) || { key: 'sky' }
    if (theme.key !== this.data.theme || (theme.style || '') !== this.data.themeStyle) {
      this.setData({ theme: theme.key, themeStyle: theme.style || '' })
    }
    if (app.applyNavBar) app.applyNavBar()
  },

  onDockDim(event) {
    const dim = !!(event.detail && event.detail.dim)
    if (dim !== this.data.dockDim) this.setData({ dockDim: dim })
  },

  handleBack() {
    const view = this.selectComponent('#todoView')
    if (view && typeof view.handleBack === 'function') {
      view.handleBack()
      return
    }
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/tools/tools' }) })
  }
})
