const app = getApp()

Page({
  data: {
    theme: 'cream',
    records: []
  },

  onLoad() {
    const theme = app.getTheme ? app.getTheme() : { key: 'cream' }
    this.setData({ theme: theme.key })
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

  rerunRecord(event) {
    const record = this.data.records[Number(event.currentTarget.dataset.index)]
    if (!record || !record.rows) return
    wx.setStorageSync('exam-timer-pending-modules', record.rows.map(item => ({
      id: item.id,
      name: item.name,
      targetMinutes: item.targetMinutes
    })))
    this.backToIndex()
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
