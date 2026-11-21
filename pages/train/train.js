const app = getApp()

function withIds(modules) {
  const stamp = Date.now()
  return (modules || []).map((item, index) => ({
    id: item.id || `m_${stamp}_${index}`,
    name: item.name || '训练模块',
    targetMinutes: Math.max(5, Number(item.targetMinutes) || 0)
  }))
}

Page({
  data: {
    isDesktop: !!(getApp() && getApp().globalData && getApp().globalData.isDesktop),
    theme: (getApp() && getApp().getTheme && getApp().getTheme().key) || 'sky',
    themeStyle: (getApp() && getApp().getThemeStyle && getApp().getThemeStyle()) || '',
    modules: [],
    totalMinutes: 0
  },

  onLoad() {
    const theme = app.getTheme ? app.getTheme() : { key: 'sky', style: '' }
    const modules = withIds(app.getTrainingModules ? app.getTrainingModules() : [])
    this.setData({
      isDesktop: !!(app.globalData && app.globalData.isDesktop),
      theme: theme.key,
      themeStyle: theme.style || '',
      modules
    }, this.refreshTotal)
    if (app.applyNavBar) app.applyNavBar()
  },

  onUnload() {
    this.persist()
  },

  refreshTotal() {
    const total = (this.data.modules || []).reduce((sum, item) => sum + (Number(item.targetMinutes) || 0), 0)
    this.setData({ totalMinutes: total })
  },

  // 训练页只是入口，改完就回写当前模板，首页 / 下次进训练页读到的都是这一份
  persist() {
    if (!app.saveTrainingModules) return
    if (!this.data.modules.length) return
    app.saveTrainingModules(this.data.modules)
    if (app.globalData) app.globalData.trainingModulesDirty = true
  },

  changeModuleName(event) {
    const index = Number(event.currentTarget.dataset.index)
    const modules = this.data.modules.slice()
    if (!modules[index]) return
    modules[index] = { ...modules[index], name: event.detail.value }
    this.setData({ modules }, this.persist)
  },

  normalizeModuleName(event) {
    const index = Number(event.currentTarget.dataset.index)
    const modules = this.data.modules.slice()
    if (!modules[index]) return
    const name = String(event.detail.value || '').trim() || '训练模块'
    modules[index] = { ...modules[index], name }
    this.setData({ modules })
  },

  changeMinutes(event) {
    const index = Number(event.currentTarget.dataset.index)
    const modules = this.data.modules.slice()
    if (!modules[index]) return
    modules[index] = { ...modules[index], targetMinutes: Math.min(180, Math.max(0, Number(event.detail.value) || 0)) }
    this.setData({ modules }, this.refreshTotal)
  },

  normalizeMinutes(event) {
    const index = Number(event.currentTarget.dataset.index)
    const modules = this.data.modules.slice()
    if (!modules[index]) return
    modules[index] = { ...modules[index], targetMinutes: Math.min(180, Math.max(5, Number(event.detail.value) || 5)) }
    this.setData({ modules }, () => {
      this.refreshTotal()
      this.persist()
    })
  },

  adjustMinutes(event) {
    const index = Number(event.currentTarget.dataset.index)
    const step = Number(event.currentTarget.dataset.step) || 5
    const modules = this.data.modules.slice()
    if (!modules[index]) return
    const next = Math.min(180, Math.max(5, (Number(modules[index].targetMinutes) || 0) + step))
    modules[index] = { ...modules[index], targetMinutes: next }
    this.setData({ modules }, () => {
      this.refreshTotal()
      this.persist()
    })
  },

  addModule() {
    if (this.data.modules.length >= 8) {
      wx.showToast({ title: '最多 8 个模块', icon: 'none' })
      return
    }
    const modules = this.data.modules.concat([{ id: `m_${Date.now()}`, name: '新模块', targetMinutes: 15 }])
    this.setData({ modules }, () => {
      this.refreshTotal()
      this.persist()
    })
  },

  removeModule(event) {
    const index = Number(event.currentTarget.dataset.index)
    const modules = this.data.modules.slice()
    if (!modules[index]) return
    modules.splice(index, 1)
    this.setData({ modules }, () => {
      this.refreshTotal()
      this.persist()
    })
  },

  startTraining() {
    if (!this.data.modules.length) {
      wx.showToast({ title: '先添加训练模块', icon: 'none' })
      return
    }
    this.persist()
    const started = app.startTrainingSession ? app.startTrainingSession(this.data.modules) : false
    if (!started) {
      wx.showToast({ title: '模块时长需大于 0', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/blank/blank?mode=enter',
      fail: () => wx.showToast({ title: '打不开计时页，请重试', icon: 'none' })
    })
  },

  handleBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/tools/tools' })
  }
})
