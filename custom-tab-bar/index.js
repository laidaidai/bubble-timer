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
      const swatch = (theme && theme.swatch) || ['#F5F5F7', '#FFD54F', '#1F1F1F']
      const css = (theme && theme.css) || {}
      const pearl = theme && theme.key === 'pearl'
      const pages = getCurrentPages()
      const current = pages.length ? pages[pages.length - 1].route : ''
      const selected = Math.max(0, TABS.findIndex(item => item.route === current))
      this.setData({
        selected,
        activeColor: pearl ? (css.ink || '#1F1F1F') : (swatch[1] || '#1F1F1F'),
        inactiveColor: pearl ? (css['text-3'] || '#A6A6AC') : (swatch[2] || '#A6A6AC'),
        tabStyle: pearl
          ? 'background:#FFFFFF;border-top-color:transparent;'
          : `background:${swatch[0]};border-top-color:${swatch[1]};`
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
