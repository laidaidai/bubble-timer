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

  goBack() {
    const view = this.selectComponent('#importantView')
    if (view && typeof view.goBack === 'function') {
      view.goBack()
      return
    }
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/tools/tools' }) })
  }
})
