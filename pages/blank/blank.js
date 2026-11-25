const app = getApp()

Page({
  data: {
    // 首帧就按当前设备与主题渲染，避免桌面上先闪一下手机版顶栏 / 默认配色
    isDesktop: !!(getApp() && getApp().globalData && getApp().globalData.isDesktop),
    theme: (getApp() && getApp().getTheme && getApp().getTheme().key) || 'sky',
    themeStyle: (getApp() && getApp().getThemeStyle && getApp().getThemeStyle()) || '',
    mode: 'exit',
    leaving: false
  },

  onLoad(options) {
    this.setData({ isDesktop: !!(getApp().globalData && getApp().globalData.isDesktop) })
    const theme = app.getTheme ? app.getTheme() : { key: 'sky', style: '' }
    const mode = (options && options.mode) || 'exit'
    this.setData({ theme: theme.key, themeStyle: theme.style || '', mode })

    if (mode === 'enter') {
      // 入口中转：先落在竖屏空白页，再 redirect 到横屏计时页，避免竖屏直接切横屏的旧页快照
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/timer/timer',
          fail: () => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
        })
      }, 420)
      return
    }

    if (mode === 'grade') {
      // 带卷计时结束：横屏计时页 → 竖屏空白页 → 竖屏答题页。
      // 中间这一跳把屏幕方向切回来，同时也让交卷后能原路退回过关首页。
      const paperId = options && options.paperId
      if (!paperId) {
        wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
        return
      }
      setTimeout(() => this.setData({ leaving: true }), 260)
      setTimeout(() => {
        const timerId = (options && options.timerId) || ''
        const query = `paperId=${encodeURIComponent(paperId)}${timerId ? `&timerId=${encodeURIComponent(timerId)}` : ''}`
        wx.redirectTo({
          url: `/pages/grade/answer/answer?${query}`,
          fail: () => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
        })
      }, 560)
      return
    }

    // 出口中转：先让 logo 过渡完整出现，再淡出回来源页
    setTimeout(() => this.setData({ leaving: true }), 520)
    setTimeout(() => {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack({
          delta: 1,
          fail: () => wx.switchTab({ url: '/pages/index/index' })
        })
      } else {
        wx.switchTab({ url: '/pages/index/index' })
      }
    }, 740)
  },

  onResize() {
    const desktop = app && app.detectEnvironment
      ? app.detectEnvironment()
      : !!(app && app.globalData && app.globalData.isDesktop)
    if (desktop !== this.data.isDesktop) this.setData({ isDesktop: desktop })
  }
})
