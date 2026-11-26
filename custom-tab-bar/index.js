const app = getApp()
const { pinnedUrl, readPinnedFeature } = require('../utils/home-pin')

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
    tabStyle: '',
    desk: false
  },

  lifetimes: {
    attached() {
      this.syncDesk()
      this.sync()
      // reLaunch / switchTab 切换瞬间页面栈可能还没落定，延后再校准一次高亮
      this._syncTimer = setTimeout(() => {
        if (!this._destroyed) this.sync()
      }, 260)
    },
    detached() {
      clearTimeout(this._syncTimer)
    }
  },

  pageLifetimes: {
    show() {
      this.syncDesk()
      this.sync()
    },
    // 桌面拖动窗口 / 平板转屏不会触发 show，必须在这里重新判定档位
    resize() {
      this.syncDesk()
      this.sync()
    }
  },

  methods: {
    // 桌面 / 大屏：底栏尺寸锁在手机档，不跟着窗口一起放大
    syncDesk() {
      const app = getApp()
      // 不能只读 onLaunch 时写下的值：窗口拉宽后 globalData 还是旧档，底栏会突然变大
      const desk = !!(app && app.detectEnvironment
        ? app.detectEnvironment()
        : app && app.globalData && app.globalData.isDesktop)
      if (desk !== this.data.desk) this.setData({ desk })
    },

    sync() {
      const theme = app.getTheme ? app.getTheme() : null
      const swatch = (theme && theme.swatch) || ['#FBF3DF', '#FFC94D', '#4B3A2A']
      const css = (theme && theme.css) || {}
      const pages = getCurrentPages()
      const current = pages.length ? pages[pages.length - 1].route : ''
      // 批改页 / 快捷页 / 待办 / 重要日子 / 打卡都是从工具页进入的子页面；
      // 但如果它正是当前固定的首页，就仍高亮「首页」。
      const inGrade = current.indexOf('pages/grade/') === 0
      const toolSubs = ['pages/quick/quick', 'pages/todo/todo', 'pages/important/important', 'pages/stats/stats']
      const pinnedHome = pinnedUrl(readPinnedFeature()).split('?')[0].replace(/^\//, '')
      const onPinnedHome = current === pinnedHome
      const inTools = inGrade || toolSubs.indexOf(current) >= 0
      const selected = onPinnedHome ? 0 : (inTools ? 1 : Math.max(0, TABS.findIndex(item => item.route === current)))
      this.setData({
        selected,
        activeColor: css['text-warm'] || '#4B3A2A',
        inactiveColor: css['text-3'] || '#6E5A42',
        tabStyle: `background:${swatch[0]};border-top-color:${css['text-warm'] || swatch[1]};`
      })
    },

    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      const item = TABS[index]
      if (!item) return
      const pages = getCurrentPages()
      const current = pages.length ? pages[pages.length - 1].route : ''
      // 「首页」＝用户固定好的那一页；快捷计时三项由首页本体的 quick-panel 渲染，
      // 不再 reLaunch 到快捷页，保证原生 dock 一直在。
      if (index === 0) {
        const pinned = readPinnedFeature()
        if (pinned.indexOf('quick-') === 0) {
          if (current === item.route) {
            const page = pages[pages.length - 1]
            if (page && typeof page.resetToHome === 'function') page.resetToHome()
            this.setData({ selected: index })
            return
          }
          wx.switchTab({
            url: item.path,
            success: () => this.sync(),
            fail: () => this.sync()
          })
          return
        }
        if (pinned !== 'timer') {
          const url = pinnedUrl(pinned)
          const target = url.split('?')[0]
          if (current !== target) {
            wx.reLaunch({ url, fail: () => wx.switchTab({ url: item.path, fail: () => {} }) })
            return
          }
          return
        }
      }
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
