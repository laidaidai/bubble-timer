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
    activeColor: '#E36F8B',
    inactiveColor: '#8A7078',
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
      const swatch = (theme && theme.swatch) || ['#FFF7F8', '#E36F8B', '#8A7078']
      const pages = getCurrentPages()
      const current = pages.length ? pages[pages.length - 1].route : ''
      const selected = Math.max(0, TABS.findIndex(item => item.route === current))
      this.setData({
        selected,
        activeColor: swatch[1] || '#E36F8B',
        inactiveColor: swatch[2] || '#8A7078',
        tabStyle: `background:${swatch[0] || '#FFF7F8'};border-top-color:${swatch[1] || '#E36F8B'};`
      })
    },

    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      const item = TABS[index]
      if (!item) return
      this.setData({ selected: index })
      wx.switchTab({ url: item.path })
    }
  }
})
