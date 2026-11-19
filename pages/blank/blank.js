const app = getApp()

Page({
  data: {
    theme: 'sky',
    themeStyle: '',
    mode: 'exit',
    leaving: false
  },

  onLoad(options) {
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
  }
})
