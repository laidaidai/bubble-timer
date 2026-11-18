const app = getApp()
const { fold } = require('../../utils/format')

const SOUND_MODES = [
  { key: 'both', name: '震动 + 铃声', desc: '到时间同时响铃和震动' },
  { key: 'vibrate', name: '仅震动', desc: '安静环境只震一下' },
  { key: 'ring', name: '仅铃声', desc: '只播放提示音' },
  { key: 'silent', name: '静音', desc: '只弹提示，不震不响' }
]

const PRIMARY_COLORS = ['#FFC94D', '#FF9FB6', '#7FC7D9', '#8FD2B0', '#B79CE4', '#FF9A62', '#5FA8E8', '#D9D2C0']
const BG_COLORS = ['#FBF3DF', '#FFF1F3', '#EAF4F7', '#EAF5EF', '#F3F0FA', '#FFFFFF', '#F6F3EA', '#2A2017']
const INK_COLORS = ['#4B3A2A', '#3A3550', '#243B36', '#5A3A22', '#1F1B16', '#555555']

const buildGroups = (conf) => {
  const theme = conf || {}
  return [
    { role: 'primary', label: '主色', colors: PRIMARY_COLORS, current: theme.primary || PRIMARY_COLORS[0] },
    { role: 'bg', label: '底色', colors: BG_COLORS, current: theme.bg || BG_COLORS[0] },
    { role: 'ink', label: '文字', colors: INK_COLORS, current: theme.ink || INK_COLORS[0] }
  ]
}

Page({
  data: {
    theme: 'rose',
    themeName: '蜜桃雪酪',
    themeStyle: '',
    themes: [],
    rings: [],
    soundModes: SOUND_MODES,
    soundMode: 'both',
    ringKey: 'chime',
    keepScreenOn: true,
    exitGuard: true,
    overtimeAlert: true,
    tickSound: false,
    homePrimary: 'timer',
    homePrimaryOptions: [
      { key: 'timer', name: '计时' },
      { key: 'todo', name: '待办' },
      { key: 'important', name: '重要日子' },
      { key: 'stats', name: '打卡' }
    ],
    incentiveType: 'tomato',
    incentiveOptions: [
      { key: 'tomato', name: '番茄' },
      { key: 'star', name: '星星' },
      { key: 'bubble', name: '泡泡' },
      { key: 'fish', name: '小鱼' }
    ],
    habitPresets: [],
    presetView: [],
    presetExpanded: false,
    presetLimit: 8,
    selectedKeys: [],
    selectedCount: 0,
    section: 'theme',
    sections: [
      { key: 'home', name: '首页' },
      { key: 'theme', name: '主题' },
      { key: 'remind', name: '提醒' },
      { key: 'guard', name: '专注' },
      { key: 'habit', name: '模板' }
    ],
    // 自定义主题编辑器
    showEditor: false,
    editorKey: '',
    customName: '',
    customPrimary: PRIMARY_COLORS[0],
    customBg: BG_COLORS[0],
    customInk: INK_COLORS[0],
    colorGroups: buildGroups(),
    hasCustomRing: false
  },

  onLoad() {
    this.refresh()
    this.loadHabit()
    if (app.applyNavBar) app.applyNavBar()
  },

  refresh() {
    const settings = app.getSettings()
    const current = app.getTheme()
    const customThemes = app.getCustomThemes ? app.getCustomThemes() : []
    const draft = { primary: this.data.customPrimary, bg: this.data.customBg, ink: this.data.customInk }

    const themes = (app.themes || []).map(item => ({
      key: item.key,
      name: item.name,
      desc: item.desc,
      short: (item.desc || '').split('·').pop().trim(),
      swatch: item.swatch || ['#FBF3DF', '#FFC94D', '#4B3A2A'],
      active: item.key === current.key
    }))
    customThemes.forEach(item => {
      themes.push({
        key: item.key,
        name: item.name,
        desc: `${item.primary} · 自定义`,
        short: '自定义',
        swatch: [item.bg, item.primary, item.ink],
        active: item.key === current.key,
        custom: true
      })
    })
    themes.push({
      key: 'custom',
      name: '新建自定义',
      desc: '自选主色 / 底色，命名保存',
      short: '自定义',
      swatch: [draft.bg, draft.primary, draft.ink],
      active: false,
      editor: true
    })

    const payload = {
      theme: current.key,
      themeName: current.name,
      themeStyle: current.style || '',
      themes,
      rings: app.getRings ? app.getRings() : (app.rings || []),
      soundMode: settings.soundMode,
      ringKey: settings.ring,
      keepScreenOn: !!settings.keepScreenOn,
      exitGuard: !!settings.exitGuard,
      overtimeAlert: !!settings.overtimeAlert,
      tickSound: settings.tickSound === true,
      homePrimary: settings.homePrimary || 'timer',
      incentiveType: settings.incentiveType || 'tomato',
      hasCustomRing: (app.getRings ? app.getRings() : []).some(item => String(item.key).indexOf('cr-') === 0 || item.key === 'custom')
    }

    // 当前主题是已保存的自定义主题时，编辑器同步显示它的名字和颜色
    if (String(current.key).indexOf('ct-') === 0) {
      const entry = customThemes.find(item => item.key === current.key)
      if (entry) {
        payload.showEditor = true
        payload.editorKey = entry.key
        payload.customName = entry.name
        payload.customPrimary = entry.primary
        payload.customBg = entry.bg
        payload.customInk = entry.ink
        payload.colorGroups = buildGroups(entry)
      }
    }
    this.setData(payload)
  },

  selectTheme(event) {
    const key = event.currentTarget.dataset.key
    if (!key) return
    if (key === 'custom') {
      const first = (app.getCustomThemes ? app.getCustomThemes() : [])[0]
      const conf = first
        ? { primary: first.primary, bg: first.bg, ink: first.ink }
        : { primary: this.data.customPrimary, bg: this.data.customBg, ink: this.data.customInk }
      this.setData({
        showEditor: true,
        editorKey: '',
        customName: '',
        customPrimary: conf.primary,
        customBg: conf.bg,
        customInk: conf.ink,
        colorGroups: buildGroups(conf)
      })
      return
    }
    this.setData({ showEditor: false, editorKey: '' })
    if (key === this.data.theme) return
    app.saveSettings({ theme: key })
    this.refresh()
    if (app.applyNavBar) app.applyNavBar()
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
    wx.showToast({ title: `已切换为${app.getTheme().name}`, icon: 'none', duration: 1200 })
  },

  selectCustomColor(event) {
    const role = event.currentTarget.dataset.role
    const value = event.currentTarget.dataset.value
    if (!role || !value) return
    const patch = { [role]: value }
    const conf = {
      primary: patch.primary || this.data.customPrimary,
      bg: patch.bg || this.data.customBg,
      ink: patch.ink || this.data.customInk
    }
    const editorKey = this.data.editorKey
    const payload = {
      customPrimary: conf.primary,
      customBg: conf.bg,
      customInk: conf.ink,
      colorGroups: buildGroups(conf)
    }
    this.setData(payload)
    // 正在编辑已保存的主题时实时生效（名字空则沿用原名字）
    if (editorKey && String(editorKey).indexOf('ct-') === 0) {
      const name = (this.data.customName || '').trim() || '我的主题'
      this.saveThemeEntry(editorKey, name, conf)
      this.refresh()
      if (app.applyNavBar) app.applyNavBar()
    }
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
  },

  saveThemeEntry(key, name, conf) {
    const settings = app.getSettings()
    const list = (settings.customThemes || []).slice()
    const at = list.findIndex(item => item.key === key)
    const entry = { key, name, primary: conf.primary, bg: conf.bg, ink: conf.ink }
    if (at >= 0) list[at] = entry
    else list.push(entry)
    app.saveSettings({ customThemes: list, customTheme: { primary: conf.primary, bg: conf.bg, ink: conf.ink }, theme: key })
    return entry
  },

  saveCustomTheme() {
    const name = (this.data.customName || '').trim()
    if (!name) {
      wx.showToast({ title: '先给主题起个名字', icon: 'none' })
      return
    }
    const conf = { primary: this.data.customPrimary, bg: this.data.customBg, ink: this.data.customInk }
    const key = this.data.editorKey || `ct-${Date.now()}`
    const entry = this.saveThemeEntry(key, name, conf)
    this.setData({ showEditor: true, editorKey: entry.key })
    this.refresh()
    if (app.applyNavBar) app.applyNavBar()
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
    wx.showToast({ title: '主题已保存', icon: 'success' })
  },

  cancelEditor() {
    this.setData({ showEditor: false, editorKey: '' })
    this.refresh()
  },

  onThemeNameInput(event) {
    this.setData({ customName: event.detail.value })
  },

  manageTheme(event) {
    const key = event.currentTarget.dataset.key
    if (!key || String(key).indexOf('ct-') !== 0) return
    const settings = app.getSettings()
    let entry = (settings.customThemes || []).find(item => item.key === key)
    if (!entry && key === 'ct-legacy' && settings.customTheme) {
      entry = { key: 'ct-legacy', name: '我的主题', ...settings.customTheme }
    }
    if (!entry) return
    wx.showModal({
      title: `管理「${entry.name}」`,
      content: '删除后这个自定义主题就不再保留。',
      confirmText: '删除',
      confirmColor: '#E8442F',
      success: ({ confirm }) => {
        if (!confirm) return
        const list = (settings.customThemes || []).filter(item => item.key !== key)
        const patch = { customThemes: list, customTheme: null }
        if (settings.theme === key) patch.theme = 'rose'
        app.saveSettings(patch)
        this.setData({ showEditor: false, editorKey: '', customName: '' })
        this.refresh()
        if (app.applyNavBar) app.applyNavBar()
        wx.showToast({ title: '已删除', icon: 'none' })
      }
    })
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
      const src = app.ringSrc ? app.ringSrc(settings.ring) : ''
      if (!src) return
      this.audio.stop()
      this.audio.src = src
      this.audio.play()
    } catch (error) { /* 试听失败忽略 */ }
  },

  chooseRingFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['mp3', 'm4a', 'wav', 'aac'],
      success: (res) => {
        const file = (res.tempFiles || [])[0]
        if (!file) return
        const ext = (file.name.split('.').pop() || 'mp3').toLowerCase()
        const defaultName = file.name.replace(/\.[^.]+$/, '').slice(0, 10) || '我的铃声'
        wx.showModal({
          title: '给铃声起个名字',
          editable: true,
          placeholderText: defaultName,
          content: '',
          success: ({ confirm, content }) => {
            if (!confirm) return
            const name = (content || '').trim() || defaultName
            const target = `${wx.env.USER_DATA_PATH}/ring-${Date.now()}.${ext}`
            const fs = wx.getFileSystemManager()
            try {
              fs.saveFileSync(file.path, target)
            } catch (error) {
              wx.showToast({ title: '读取文件失败', icon: 'none' })
              return
            }
            const settings = app.getSettings()
            const list = (settings.customRings || []).slice()
            if (!list.length && settings.customRing && settings.customRing.path) {
              list.push({ key: 'cr-legacy', name: settings.customRing.name || '我的铃声', path: settings.customRing.path })
            }
            const key = `cr-${Date.now()}`
            list.push({ key, name, path: target })
            app.saveSettings({ customRings: list, ring: key, customRing: null })
            this.refresh()
            this.previewRing()
            wx.showToast({ title: '铃声已保存', icon: 'success' })
          }
        })
      },
      fail: () => {}
    })
  },

  manageRing(event) {
    const key = event.currentTarget.dataset.key
    if (!key || String(key).indexOf('cr-') !== 0) return
    const settings = app.getSettings()
    const list = (settings.customRings || []).slice()
    let entry = list.find(item => item.key === key)
    if (!entry && key === 'cr-legacy' && settings.customRing && settings.customRing.path) {
      entry = { key: 'cr-legacy', name: settings.customRing.name || '我的铃声', path: settings.customRing.path }
      list.push(entry)
    }
    if (!entry) return
    wx.showActionSheet({
      itemList: ['重命名', '删除'],
      success: ({ tapIndex }) => {
        if (tapIndex === 0) {
          wx.showModal({
            title: '重命名铃声',
            editable: true,
            placeholderText: entry.name,
            success: ({ confirm, content }) => {
              if (!confirm) return
              const name = (content || '').trim() || entry.name
              entry.name = name
              app.saveSettings({ customRings: list })
              this.refresh()
              wx.showToast({ title: '已重命名', icon: 'none' })
            }
          })
          return
        }
        wx.showModal({
          title: `删除「${entry.name}」？`,
          content: '删除后这首歌就不再保存在小程序里。',
          confirmText: '删除',
          confirmColor: '#E8442F',
          success: ({ confirm }) => {
            if (!confirm) return
            try { wx.getFileSystemManager().unlinkSync(entry.path) } catch (error) { /* 文件可能已不存在 */ }
            const next = list.filter(item => item.key !== key)
            const patch = { customRings: next, customRing: null }
            if (settings.ring === key) patch.ring = 'chime'
            app.saveSettings(patch)
            this.refresh()
            wx.showToast({ title: '已删除', icon: 'none' })
          }
        })
      },
      fail: () => {}
    })
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

  selectHomePrimary(event) {
    const key = event.currentTarget.dataset.key
    if (!key) return
    app.saveSettings({ homePrimary: key })
    this.refresh()
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
    wx.showToast({ title: '已设为首页', icon: 'none', duration: 1000 })
  },

  setIncentive(event) {
    const key = event.currentTarget.dataset.key
    if (!key) return
    app.saveSettings({ incentiveType: key })
    this.refresh()
    wx.showToast({ title: '已切换激励', icon: 'none', duration: 1000 })
  },

  selectSection(event) {
    const key = event.currentTarget.dataset.key
    if (!key) return
    this.setData({ section: key })
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

  // 已勾选的预设 = 首页同名模板（如「国考行测」），直接写入模板存储，首页 onShow 同步
  writePresetTemplate(selected) {
    const presets = app.habitPresets || []
    const presetNames = presets.map(item => item.name)
    const stored = wx.getStorageSync(app.globalData.templateKey) || {}
    let templates = Array.isArray(stored.templates) ? stored.templates.slice() : []
    // 预设模板统一由「已启用」状态维护：先摘掉旧的预设模板，再按勾选重建
    templates = templates.filter(item => presetNames.indexOf(item.name) < 0)
    const active = selected
      .map(key => presets.find(item => item.key === key))
      .filter(Boolean)
    active.forEach(preset => {
      templates.push({
        name: preset.name,
        modules: (preset.modules || []).map(module => ({
          name: module.name,
          targetMinutes: module.targetMinutes,
          source: preset.key
        }))
      })
    })
    let currentName = stored.currentName || ''
    if (active.length) {
      currentName = active[active.length - 1].name
    } else if (presetNames.indexOf(currentName) >= 0 || !currentName) {
      currentName = (templates[0] && templates[0].name) || '常规'
    }
    wx.setStorageSync(app.globalData.templateKey, { currentName, templates })
    wx.setStorageSync(app.globalData.habitApplyKey, { name: currentName, at: Date.now() })
    return active.length
  },

  togglePreset(event) {
    const key = event.currentTarget.dataset.key
    const preset = (app.habitPresets || []).find(item => item.key === key)
    if (!preset) return
    const selected = (this.data.selectedKeys || []).slice()
    const at = selected.indexOf(key)
    if (at >= 0) selected.splice(at, 1)
    else {
      if (selected.length >= (app.globalData.presetLimit || 8)) {
        wx.showToast({ title: `最多同时启用 ${app.globalData.presetLimit || 8} 个预设`, icon: 'none' })
        return
      }
      selected.push(key)
    }
    wx.setStorageSync(app.globalData.presetSelectKey, selected)
    const all = this.buildPresets(selected)
    this.setData({
      selectedKeys: selected,
      selectedCount: selected.length,
      habitPresets: all,
      presetView: fold(all, this.data.presetExpanded, 4)
    })
    this.writePresetTemplate(selected)
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
    const chosen = preset
    wx.showToast({
      title: at >= 0 ? `已从首页移除「${chosen.name}」` : `已加入首页模板「${chosen.name}」`,
      icon: 'none',
      duration: 1600
    })
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

  clearLocalData() {
    wx.showModal({
      title: '清除全部本地数据？',
      content: '训练记录、待办、模板、主题、铃声和设置都会被删除，且无法恢复。',
      confirmText: '清除',
      confirmColor: '#E8442F',
      success: ({ confirm }) => {
        if (!confirm) return
        if (this.audio) this.audio.stop()
        const settings = app.getSettings ? app.getSettings() : {}
        const rings = Array.isArray(settings.customRings) ? settings.customRings : []
        const fs = wx.getFileSystemManager ? wx.getFileSystemManager() : null
        if (fs) {
          rings.forEach(item => {
            if (item && item.path) fs.unlink({ filePath: item.path, fail: () => {} })
          })
          if (settings.customRing && settings.customRing.path) {
            fs.unlink({ filePath: settings.customRing.path, fail: () => {} })
          }
        }
        try {
          wx.clearStorageSync()
        } catch (error) {
          wx.showModal({ title: '清除失败', content: '请稍后重试', showCancel: false })
          return
        }
        wx.showToast({ title: '本地数据已清除', icon: 'success' })
        setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 500)
      }
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
