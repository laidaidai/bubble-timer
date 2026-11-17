const app = getApp()
const { fold } = require('../../utils/format')

const SOUND_MODES = [
  { key: 'both', name: '震动 + 铃声', desc: '到时间同时响铃和震动' },
  { key: 'vibrate', name: '仅震动', desc: '安静环境只震一下' },
  { key: 'ring', name: '仅铃声', desc: '只播放提示音' },
  { key: 'silent', name: '静音', desc: '只弹提示，不震不响' }
]

Page({
  data: {
    theme: 'cream',
    themeName: '蜂蜜奶霜',
    themes: [],
    rings: [],
    soundModes: SOUND_MODES,
    soundMode: 'both',
    ringKey: 'chime',
    keepScreenOn: true,
    exitGuard: true,
    overtimeAlert: true,
    habitPresets: [],
    presetView: [],
    presetExpanded: false,
    presetLimit: 8,
    selectedKeys: [],
    selectedCount: 0,
    openSection: 'theme',
    remindHint: ''
  },

  onLoad() {
    this.refresh()
    this.loadHabit()
    if (app.applyNavBar) app.applyNavBar()
  },

  refresh() {
    const settings = app.getSettings()
    const current = app.getTheme()
    const themes = (app.themes || []).map(item => ({
      key: item.key,
      name: item.name,
      desc: item.desc,
      short: (item.desc || '').split('·').pop().trim(),
      swatch: item.swatch || ['#FBF3DF', '#FFC94D', '#4B3A2A'],
      active: item.key === current.key
    }))
    this.setData({
      theme: current.key,
      themeName: current.name,
      themes,
      rings: app.rings || [],
      soundMode: settings.soundMode,
      ringKey: settings.ring,
      keepScreenOn: !!settings.keepScreenOn,
      exitGuard: !!settings.exitGuard,
      overtimeAlert: !!settings.overtimeAlert,
      remindHint: this.buildRemindHint(settings)
    })
  },

  selectTheme(event) {
    const key = event.currentTarget.dataset.key
    if (!key || key === this.data.theme) return
    app.saveSettings({ theme: key })
    this.refresh()
    if (app.applyNavBar) app.applyNavBar()
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
    wx.showToast({ title: `已切换为${app.getTheme().name}`, icon: 'none', duration: 1500 })
  },

  buildRemindHint(settings) {
    const mode = (app.settings && SOUND_MODES.find(item => item.key === settings.soundMode)) || SOUND_MODES[0]
    if (settings.soundMode === 'silent' || settings.soundMode === 'vibrate') return mode.name
    const ring = (app.rings || []).find(item => item.key === settings.ring) || (app.rings || [])[0]
    return `${mode.name} · ${ring ? ring.name : '默认铃声'}`
  },

  setSoundMode(event) {
    const key = event.currentTarget.dataset.key
    if (!key || key === this.data.soundMode) return
    app.saveSettings({ soundMode: key })
    this.refresh()
    if (key === 'both' || key === 'ring') this.previewRing()
    else if (key === 'vibrate' && wx.vibrateShort) wx.vibrateShort({ type: 'medium', fail: () => {} })
  },

  selectRing(event) {
    const key = event.currentTarget.dataset.key
    if (!key) return
    app.saveSettings({ ring: key })
    this.refresh()
    this.previewRing()
  },

  previewRing() {
    try {
      if (!this.audio) this.audio = wx.createInnerAudioContext()
      const settings = app.getSettings()
      const ring = (app.rings || []).find(item => item.key === settings.ring) || (app.rings || [])[0]
      if (!ring) return
      this.audio.stop()
      this.audio.src = ring.src
      this.audio.play()
    } catch (error) { /* 试听失败忽略 */ }
  },

  toggleSwitch(event) {
    const key = event.currentTarget.dataset.key
    if (!key) return
    const next = !this.data[key]
    app.saveSettings({ [key]: next })
    this.refresh()
    if (key === 'keepScreenOn' && wx.setKeepScreenOn) {
      wx.setKeepScreenOn({ keepScreenOn: next, fail: () => {} })
    }
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
    wx.showToast({ title: next ? '已开启' : '已关闭', icon: 'none', duration: 1000 })
  },

  toggleSection(event) {
    const key = event.currentTarget.dataset.key
    this.setData({ openSection: this.data.openSection === key ? '' : key })
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
  },

  buildPresets(selected) {
    return (app.habitPresets || []).map(item => ({
      key: item.key,
      name: item.name,
      desc: item.desc,
      short: (item.desc || '').split('·').pop().trim(),
      checked: selected.indexOf(item.key) >= 0
    }))
  },

  toggleExpand() {
    const expanded = !this.data.presetExpanded
    this.setData({ presetExpanded: expanded, presetView: fold(this.data.habitPresets, expanded, 4) })
  },

  togglePreset(event) {
    const key = event.currentTarget.dataset.key
    const preset = (app.habitPresets || []).find(item => item.key === key)
    if (!preset) return
    const selected = (this.data.selectedKeys || []).slice()
    const at = selected.indexOf(key)
    if (at >= 0) {
      selected.splice(at, 1)
      wx.setStorageSync(app.globalData.habitApplyKey, { action: 'remove', key, at: Date.now() })
    } else {
      if (selected.length >= (app.globalData.presetLimit || 8)) {
        wx.showToast({ title: `最多同时启用 ${app.globalData.presetLimit || 8} 个预设`, icon: 'none' })
        return
      }
      selected.push(key)
      wx.setStorageSync(app.globalData.habitApplyKey, { action: 'add', key, name: preset.name, modules: preset.modules, at: Date.now() })
    }
    wx.setStorageSync(app.globalData.presetSelectKey, selected)
    const all = this.buildPresets(selected)
    this.setData({
      selectedKeys: selected,
      selectedCount: selected.length,
      habitPresets: all,
      presetView: fold(all, this.data.presetExpanded, 4)
    })
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
  },

  loadHabit() {
    const selected = wx.getStorageSync(app.globalData.presetSelectKey) || []
    const valid = (app.habitPresets || []).filter(item => selected.indexOf(item.key) >= 0).map(item => item.key)
    if (valid.length !== selected.length) wx.setStorageSync(app.globalData.presetSelectKey, valid)
    const allPresets = this.buildPresets(valid)
    this.setData({
      habitPresets: allPresets,
      presetView: fold(allPresets, this.data.presetExpanded, 4),
      selectedKeys: valid,
      selectedCount: valid.length
    })
  },

  handleBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else wx.reLaunch({ url: '/pages/index/index' })
  },

  onUnload() {
    if (this.audio) this.audio.stop()
  }
})
