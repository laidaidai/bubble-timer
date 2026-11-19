const app = getApp()

Page({
  data: {
    theme: 'sky', themeStyle: '',
    records: [],
    timerLaunching: false,
    historyReveal: false,
    burstingIndex: -1
  },

  syncTheme() {
    const theme = app.getTheme ? app.getTheme() : { key: 'rose' }
    if (theme.key !== this.data.theme || (theme.style || '') !== this.data.themeStyle) {
      this.setData({ theme: theme.key, themeStyle: theme.style || '' })
    }
    if (app.applyNavBar) app.applyNavBar()
  },

  onLoad() {
    this.syncTheme()
    this.loadRecords()
  },

  onShow() {
    if (this.data.timerLaunching) {
      clearTimeout(this.timerCoverTimer)
      this.timerCoverTimer = setTimeout(() => this.setData({ timerLaunching: false }), 160)
    }
    this.syncTheme()
    if (this.getTabBar && this.getTabBar()) this.getTabBar().sync()
    this.loadRecords()
    this.playHistoryReveal()
  },

  // 每次回到记录页都重新播放一次入场动效
  playHistoryReveal() {
    clearTimeout(this.historyRevealTimer)
    this.setData({ historyReveal: false }, () => {
      this.historyRevealTimer = setTimeout(() => this.setData({ historyReveal: true }), 40)
    })
  },

  launchTimer() {
    if (this.data.timerLaunching) return
    this.setData({ timerLaunching: true }, () => {
      clearTimeout(this.timerCoverTimer)
      this.timerCoverTimer = setTimeout(() => {
        wx.navigateTo({
          url: '/pages/blank/blank?mode=enter',
          fail: () => this.setData({ timerLaunching: false })
        })
      }, 60)
    })
  },

  loadRecords() {
    const records = (wx.getStorageSync(app.globalData.recordsKey) || []).map(record => {
      const names = (record.rows || []).map(item => item.name).filter(Boolean)
      return { ...record, title: names[0] || '训练记录' }
    })
    this.setData({ records })
  },

  openReport(event) {
    const record = this.data.records[Number(event.currentTarget.dataset.index)]
    if (!record) return
    wx.setStorageSync('exam-timer-pending-report', record)
    // 让首页知道报告是从记录页点开的，返回时回到记录列表
    wx.setStorageSync('exam-timer-report-origin', 'history')
    this.backToIndex()
  },

  // 重跑直接进计时页，不再回首页
  rerunRecord(event) {
    const record = this.data.records[Number(event.currentTarget.dataset.index)]
    if (!record || !record.rows || !record.rows.length) return
    const runtimeModules = record.rows.map(item => ({
      id: item.id,
      name: item.name,
      targetMinutes: item.targetMinutes,
      elapsedSeconds: 0,
      status: item.targetMinutes === 0 ? 'done' : 'pending'
    }))
    const firstIndex = runtimeModules.findIndex(item => item.status !== 'done')
    if (firstIndex === -1) {
      wx.showToast({ title: '这条记录没有有效模块', icon: 'none' })
      return
    }
    runtimeModules[firstIndex].status = 'current'
    const mode = record.mode || wx.getStorageSync(app.globalData.modeKey) || 'countup'
    const totalTargetSeconds = runtimeModules.reduce((sum, item) => sum + (item.targetMinutes || 0) * 60, 0)
    wx.setStorageSync(app.globalData.modeKey, mode)
    wx.setStorageSync(app.globalData.storageKey, {
      modules: runtimeModules,
      startedAt: Date.now(),
      currentIndex: firstIndex,
      globalSeconds: 0,
      moduleSeconds: 0,
      isPaused: false,
      mode,
      totalTargetSeconds
    })
    this.launchTimer()
  },

  removeRecord(event) {
    const index = Number(event.currentTarget.dataset.index)
    const record = this.data.records[index]
    if (!record) return
    wx.showModal({
      title: '删除这条记录？',
      content: `${record.startedAtText} · ${record.totalActualText}`,
      confirmText: '删除',
      confirmColor: '#E8442F',
      success: ({ confirm }) => {
        if (!confirm) return
        const next = this.data.records.filter((item, i) => i !== index)
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
        wx.setStorageSync(app.globalData.recordsKey, next)
        this.setData({ burstingIndex: index })
        clearTimeout(this.burstTimer)
        this.burstTimer = setTimeout(() => {
          this.setData({ records: next, burstingIndex: -1 })
          wx.showToast({ title: '已删除', icon: 'none' })
        }, 580)
      }
    })
  },

  onUnload() {
    clearTimeout(this.burstTimer)
  },

  backToIndex() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  handleBack() {
    this.backToIndex()
  },

  onPageScroll(event) {
    const next = (event.scrollTop || 0) > 48
    if (next !== this.data.dockDim) this.setData({ dockDim: next })
  }
})
