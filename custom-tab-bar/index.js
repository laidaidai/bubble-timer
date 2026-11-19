const app = getApp()

const TABS = [
  { path: '/pages/index/index', route: 'pages/index/index', text: '首页' },
  { path: '/pages/tools/tools', route: 'pages/tools/tools', text: '工具' },
  { path: '/pages/history/history', route: 'pages/history/history', text: '记录' }
]

Component({
  data: {
    selected: 0,
    list: TABS,
    activeColor: '#1F1F1F',
    inactiveColor: '#A6A6AC',
    tabStyle: ''
  },

  lifetimes: {
    attached() {
      this.sync()
    }
  },

  pageLifetimes: {
    show() {
      this.sync()
    }
  },

  methods: {
    sync() {
      const theme = app.getTheme ? app.getTheme() : null
      const swatch = (theme && theme.swatch) || ['#FBF3DF', '#FFC94D', '#4B3A2A']
      const pages = getCurrentPages()
      const current = pages.length ? pages[pages.length - 1].route : ''
      const selected = Math.max(0, TABS.findIndex(item => item.route === current))
      this.setData({
        selected,
        activeColor: swatch[1] || '#4B3A2A',
        inactiveColor: swatch[2] || '#A6906F',
        tabStyle: `background:${swatch[0]};border-top-color:${swatch[1]};`
      })
    },

    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      const item = TABS[index]
      if (!item) return
      const pages = getCurrentPages()
      const current = pages.length ? pages[pages.length - 1].route : ''
      // 已经在目标页时同步高亮；首页还要退出报告/临时计时视图
      if (current === item.route) {
        if (index === 0) {
          const page = pages[pages.length - 1]
          if (page && typeof page.resetToHome === 'function') page.resetToHome()
        }
        this.setData({ selected: index })
        return
      }
      wx.switchTab({
        url: item.path,
        success: () => this.sync(),
        fail: () => this.sync()
      })
    }
  }
})
