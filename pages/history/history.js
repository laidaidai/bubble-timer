const app = getApp()

Page({
  data: {
    theme: 'cream', themeStyle: '',
    records: []
  },

  onLoad() {
    const theme = app.getTheme ? app.getTheme() : { key: 'cream' }
    this.setData({ theme: theme.key, themeStyle: theme.style || '' })
    if (app.applyNavBar) app.applyNavBar()
    this.loadRecords()
  },

  onShow() {
    this.loadRecords()
  },

  loadRecords() {
    this.setData({ records: wx.getStorageSync(app.globalData.recordsKey) || [] })
  },

  openReport(event) {
    const record = this.data.records[Number(event.currentTarget.dataset.index)]
    if (!record) return
    wx.setStorageSync('exam-timer-pending-report', record)
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
    wx.navigateTo({ url: '/pages/timer/timer' })
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
        wx.setStorageSync(app.globalData.recordsKey, next)
        this.setData({ records: next })
        wx.showToast({ title: '已删除', icon: 'none' })
      }
    })
  },

  backToIndex() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else wx.reLaunch({ url: '/pages/index/index' })
  },

  handleBack() {
    this.backToIndex()
  }
})
