const app = getApp()
const { pad, clockFull: clock, clock: shortClock, dateTimeText: dateTime, dateKey, clone, CLOCK_STYLES, LED_PATTERNS, resolveClockStyle } = require('../../utils/format')
const { CLOCK_BASE, computeSlotSize, fitScale } = require('../../utils/clock-layout')
const { pickTimerQuote } = require('../../utils/quotes')

// 七段数码管：a, b, c, d, e, f, g（段码表已收到 utils/format 共享）
const FOCUS_SECONDS = 25 * 60
const REST_SECONDS = 5 * 60
const LONG_REST_SECONDS = 15 * 60
const LONG_REST_EVERY = 4
const RECORD_LIMIT = 20

// 计时页目标时长的英文缩写：45min / 1h / 1h 30min
function targetUnitText(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0))
  if (!total) return '0min'
  if (total < 60) return `${total}min`
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest ? `${hours}h ${rest}min` : `${hours}h`
}

// 全屏时各时钟样式的放大倍率，需与 timer.wxss 里的 --immersive-clock-scale 保持一致
const IMMERSIVE_CLOCK_SCALE = {
  flip: 1.28, blocks: 1.32, sticker: 1.12, outline: 1.26, jelly: 1.26,
  doodle: 1.20, stamp: 1.18, jellypop: 1.20
}
const OUTRO_DELAY = 180   // 外围组件淡出的时长，之后才切换沉浸布局
const MORPH_GAP = 36      // 切换布局后等一帧再放开过渡，保证起点画面与切换前一致
const CHROME_IDLE_DELAY = 3000  // 全屏时退出键闲置多久后自动收起

Page({
  data: {
    // 首帧就按当前设备与主题渲染，避免桌面上先闪一下手机版顶栏 / 默认配色
    isDesktop: !!(getApp() && getApp().globalData && getApp().globalData.isDesktop),
    runtimeModules: [], currentModule: {}, currentIndex: 0, moduleScrollTarget: 'module-0',
    targetText: '0min', quoteText: '',
    globalSeconds: 0, moduleSeconds: 0,
    globalTimeText: '00:00:00', moduleTimeText: '00:00:00', mainTimeText: '00:00:00',
    progressPercent: 0, isPaused: false, isOvertime: false, isHolding: false,
    clockStyle: 'flip', clockStyleName: '翻页时钟', flipCells: [], flipDigits: [], ledDigits: [], flipPhase: false,
    msText: '00', msShow: true, theme: 'sky', themeStyle: '', immersiveVars: '', immersiveScale: 0,
    isLastModule: false, isFirstModule: true,
    mode: 'countup', modeName: '正计时', mainLabel: '总用时',
    phaseLabel: '', phaseText: '', tickMuted: true, compact: true, immersive: false, moduleOpen: false, chromeIdle: false, portrait: false, wide: false, orientAnim: false, orientStyle: '',
    celebrating: false, celebrationBubbles: [], celebrationMessage: '',
    timerReveal: false, immersiveAnim: false, immersiveLeaving: false,
    clockMorph: false, clockMorphStyle: '',
    stageVars: '', slotVars: '', styleHint: '', clockFitVars: '',
    moduleFabBottom: 20, moduleMenuDown: false, moduleFabVars: '',
    fabDragging: false, fabDragY: 0, fabSettling: false
  },

  onLoad() {
    this.setData({ isDesktop: !!(getApp().globalData && getApp().globalData.isDesktop) })
    const theme = app.getTheme ? app.getTheme() : { key: 'rose' }
    const settings = app.getSettings ? app.getSettings() : {}
    const quote = pickTimerQuote()
    this.tickAudioFlip = false
    this.setData({ theme: theme.key, themeStyle: theme.style || '', tickMuted: settings.tickSound !== true, compact: true, quoteText: quote.text })
    if (app.applyNavBar) app.applyNavBar()
    this.syncOrientation()
    try {
      const savedFab = Number(wx.getStorageSync('exam-timer-module-fab-bottom'))
      if (isFinite(savedFab) && savedFab > 0) {
        this.setData({ moduleFabBottom: savedFab }, () => this.syncModuleFabLayout())
      }
    } catch (error) {}

    const session = wx.getStorageSync(app.globalData.storageKey)
    if (!session || !session.modules || !session.modules.length) {
      // 空会话会在离开页面时被再次持久化，先清掉，避免下一次误进计时页并生成空报告
      wx.removeStorageSync(app.globalData.storageKey)
      // onLoad 里直接 redirect 会撞上「LifeCycle.load fail: Cannot set a non-pending waiting value」，
      // 延到下一拍再跳，等页面 load 落地
      setTimeout(() => this.leaveTimer(), 0)
      return
    }

    // 旧版本保存过已删除的皮肤（gradient / neon / minimal）时，按 utils/format 的 legacy 表迁移到新皮肤
    const clockStyle = resolveClockStyle(wx.getStorageSync(app.globalData.clockStyleKey))
    const mode = session.mode || wx.getStorageSync(app.globalData.modeKey) || 'countup'
    const modeInfo = (app.modes || []).find(item => item.key === mode)

    const savedStartedAt = session.startedAt
    const startedAt = typeof savedStartedAt === 'string'
      ? new Date(savedStartedAt).getTime()
      : Number(savedStartedAt)
    this.startedAt = startedAt && isFinite(startedAt) ? startedAt : Date.now()
    this.totalTargetSeconds = session.totalTargetSeconds || session.modules.reduce((sum, item) => sum + (item.targetMinutes || 0) * 60, 0)
    this.pomodoroPhase = session.pomodoroPhase || 'focus'
    this.phaseRemaining = session.phaseRemaining === undefined ? FOCUS_SECONDS : session.phaseRemaining
    this.pomodoroCycle = session.pomodoroCycle || 1
    this.moduleAlerted = false
    this.totalAlerted = false
    this.finished = false

    this.setData({
      runtimeModules: session.modules,
      currentIndex: session.currentIndex,
      globalSeconds: session.globalSeconds,
      moduleSeconds: session.moduleSeconds,
      isPaused: session.isPaused,
      clockStyle: clockStyle.key,
      clockStyleName: clockStyle.name,
      mode,
      modeName: modeInfo ? modeInfo.name : '正计时'
    }, () => {
      this.updateDisplay()
      this.playTimerReveal()
      if (!this.data.isPaused) {
        this.startTicker()
        this.startMsTicker()
      }
      this.setupFocusGuard(settings)
    })
  },

  onReady() {
    this.measureModuleFabPage()
  },

  onShow() {
    this.syncOrientation()
    if (this.data.runtimeModules && this.data.runtimeModules.length) this.playTimerReveal()
  },

  // ===== 时钟永远不越界：按实测尺寸把时钟整体缩到能放下（只缩不放） =====
  // 用 zoom 而不是 transform：zoom 会真的改变布局尺寸，缩小时
  // 模块名 / 进度条 / 按钮会一起往中间收，不会「视觉变小了但还占原来那么宽」。
  // 每次量之前先把倍率复位成 1，避免量到缩放后的尺寸、来回抖动。
  scheduleFitClock() {
    if (this.fitClockTimer) clearTimeout(this.fitClockTimer)
    this.fitClockTimer = setTimeout(() => {
      this.fitClockTimer = null
      this.fitClock()
    }, 32)
  },

  clockNaturalKey(style) {
    const name = style || this.data.clockStyle
    return `${name}|${this.data.portrait ? 'p' : 'l'}|${this.data.compact ? 'c' : 'n'}|${this.data.wide ? 'w' : 'n'}`
  },

  // 进出全屏的形态过渡期间不许量尺寸：
  // boundingClientRect 把 transform 的放大也算进去，量出来的「原始尺寸」被放大，
  // 算出的 --clk-fit 偏小，退出全屏后时钟就会莫名缩水。
  isClockMorphing() {
    if (this.data.clockMorph || this.data.clockMorphStyle) return true
    return Date.now() - (this.clockMorphAt || 0) < 520
  },

  fitClock() {
    // 全屏时时钟尺寸归 --ic 管，--clk-fit 保持普通档的值不动，退出时直接复用
    if (this.data.immersive) return
    if (this.isClockMorphing()) {
      if (this.fitClockTimer) clearTimeout(this.fitClockTimer)
      const since = Date.now() - (this.clockMorphAt || 0)
      this.fitClockTimer = setTimeout(() => {
        this.fitClockTimer = null
        this.fitClock()
      }, Math.max(60, 560 - since))
      return
    }
    const query = wx.createSelectorQuery().in(this)
    query.select('.clock-slot').boundingClientRect()
    query.select('.clock-body').boundingClientRect()
    query.exec((res) => {
      const slot = res[0]
      const clock = res[1]
      if (!slot || !slot.width || !slot.height) return
      if (!clock || !clock.width || !clock.height) return
      // 不再「先缩回 1 再量」：那会让切皮肤时先闪一下原始大小。
      // 当前 zoom 已经把元素放大/缩小，rect 除以当前倍率就是原始尺寸。
      const current = this.clockFitValue || 1
      const naturalW = clock.width / current
      const naturalH = clock.height / current
      // 记下这个皮肤的原始尺寸：下次切回它时可以直接算倍率，和切换同一帧渲染，不会先闪一下旧尺寸
      this.clockNatural = this.clockNatural || {}
      this.clockNatural[this.clockNaturalKey()] = { w: naturalW, h: naturalH }
      // 容器尺寸只跟窗口有关，皮肤只决定自己被缩到多少
      const fit = fitScale(slot.width, slot.height, naturalW, naturalH, { max: 4.2 })
      if (Math.abs(fit - current) < 0.02) {
        this.clockFitValue = fit
        return
      }
      this.clockFitValue = fit
      const vars = Math.abs(fit - 1) < 0.02 ? '' : `--clk-fit: ${fit};`
      if (vars === this.data.clockFitVars) return
      this.setData({ clockFitVars: vars }, () => this.verifyClockFit(naturalW * fit, slot.width))
    })
  },

  // 万一某些环境不认 zoom（WXSS 被过滤掉），退回 transform 缩放，画面一样不越界
  verifyClockFit (naturalW, availW) {
    const query = wx.createSelectorQuery().in(this)
    query.select('.clock-body').boundingClientRect()
    query.exec((res) => {
      const rect = res && res[0]
      if (!rect || !rect.width) return
      if (rect.width <= availW + 2) return
      const fit = this.clockFitValue || 1
      this.setData({ clockFitVars: `--clk-fit: 1; --clk-scale: ${fit};` })
    })
  },

  // 竖屏判定：窗口比宽高「高」就走竖屏那一套（手机计时页强制横屏，只有电脑/平板的窄竖窗口会命中）
  syncOrientation() {
    let info = null
    try {
      info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    } catch (error) {
      info = null
    }
    if (!info || !info.windowWidth || !info.windowHeight) return
    const portrait = info.windowHeight > info.windowWidth
    const winChanged = info.windowWidth !== this.lastWinW || info.windowHeight !== this.lastWinH
    this.lastWinW = info.windowWidth
    this.lastWinH = info.windowHeight
    // 宽窗口（电脑/平板横屏）：组件往屏幕四周铺开，只略微放大，不再挤在中间
    const wide = !portrait && info.windowWidth >= 900
    // 时钟装在一个“只跟窗口有关”的容器里（尺寸写进 --slot-w / --slot-h），
    // 每种皮肤只负责等比缩放到容器内（JS 算 --clk-fit），所以换皮肤时容器和周围组件都不动。
    const slot = computeSlotSize(info.windowWidth, info.windowHeight, portrait)
    this.lastSlot = slot
    if (winChanged) this.clockNatural = {}
    const slotVars = `--slot-w: ${slot.w}px; --slot-h: ${slot.h}px;`
    // 外围组件（模块名、进度、按钮）只温和跟随窗口，避免按钮在大屏上变成巨块；
    // 时钟本身不再吃 --ts / --fc-scale，全部交给容器。
    const chromeScale = Math.min(1.28, Math.max(1, Math.min(info.windowWidth, info.windowHeight) / 780))
    const stageVars = `--ts: 1; --cs: ${chromeScale.toFixed(3)}; --fc-scale: 1;`
    const patch = { wide }
    if (slotVars !== this.data.slotVars) patch.slotVars = slotVars
    if (stageVars !== this.data.stageVars) patch.stageVars = stageVars
    this.setData(patch)
    if (portrait !== this.data.portrait) this.switchOrientation(portrait)
    else if (winChanged && this.data.immersive) this.refreshImmersiveScale()
    this.scheduleFitClock()
    if (wx.onWindowResize && !this.orientationBound) {
      this.orientationBound = true
      this.boundOrientationResize = () => this.syncOrientation()
      wx.onWindowResize(this.boundOrientationResize)
    }
    this.syncModuleFabLayout()
  },

  // 全屏中窗口尺寸/朝向变了：按新窗口重算倍率，避免沿用旧的倍率顶出边界
  refreshImmersiveScale() {
    const scale = this.computeImmersiveScale()
    this.immersiveScaleTarget = scale
    this.setData({ immersiveScale: scale, immersiveVars: `--ic: ${scale}; --fc-scale: 1;` })
  },

  // 横竖屏切换：先把新布局的时钟钉回旧时钟的位置，再放开过渡滑到自己的位置
  switchOrientation(portrait) {
    clearTimeout(this.orientTimer)
    const measure = cb => {
      try {
        wx.createSelectorQuery().select('.clock-stage').boundingClientRect(rect => cb(rect || null)).exec(() => {})
      } catch (error) {
        cb(null)
      }
    }
    measure(from => {
      this.setData({ portrait, orientAnim: false, orientStyle: '' }, () => {
        if (!from || !from.width) return
        wx.nextTick(() => {
          measure(to => {
            if (!to || !to.width) return
            const dx = Math.round(((from.left + from.width / 2) - (to.left + to.width / 2)) * 10) / 10
            const dy = Math.round(((from.top + from.height / 2) - (to.top + to.height / 2)) * 10) / 10
            const sc = Math.round((from.width / to.width) * 100) / 100
            this.setData({
              orientStyle: `transform: translate(${dx}px, ${dy}px) scale(${sc});`
            }, () => {
              wx.nextTick(() => {
                this.setData({ orientAnim: true }, () => {
                  wx.nextTick(() => {
                    this.setData({ orientStyle: '' })
                    if (this.data.immersive) this.refreshImmersiveScale()
                    this.orientTimer = setTimeout(() => this.setData({ orientAnim: false }), 560)
                  })
                })
              })
            })
          })
        })
      })
    })
  },

  onResize() {
    this.syncOrientation()
  },

  // 进入 / 返回计时页时重新播放入场动效
  playTimerReveal() {
    clearTimeout(this.timerRevealTimer)
    this.setData({ timerReveal: false }, () => {
      this.timerRevealTimer = setTimeout(() => this.setData({ timerReveal: true }), 40)
    })
  },

  setupFocusGuard(settings) {
    if (settings.keepScreenOn && wx.setKeepScreenOn) {
      wx.setKeepScreenOn({ keepScreenOn: true, fail: () => {} })
    }
    if (settings.exitGuard && wx.enableAlertBeforeUnload) {
      wx.enableAlertBeforeUnload({ message: '训练还在进行，确定要退出吗？' })
    }
  },

  startMsTicker() {
    this.stopMsTicker()
    this.msTimer = setInterval(() => this.updateMs(), 40)
  },

  stopMsTicker() {
    if (this.msTimer) clearInterval(this.msTimer)
    this.msTimer = null
  },

  updateMs() {
    if (this.data.isPaused || this.finished) return
    const base = this.lastTickAt || Date.now()
    const ms = Date.now() - base
    const text = String(Math.floor((((ms % 1000) + 1000) % 1000) / 10)).padStart(2, '0')
    // 超过 1 小时（时间变成 HH:MM:SS）就收起毫秒，8 种时钟样式统一遵守这条
    const showMs = String(this.data.mainTimeText || '').length <= 5
    if (text !== this.data.msText || showMs !== this.data.msShow) this.setData({ msText: text, msShow: showMs })
  },

  cycleClockStyle() {
    const index = CLOCK_STYLES.findIndex(item => item.key === this.data.clockStyle)
    const next = CLOCK_STYLES[(index + 1) % CLOCK_STYLES.length]
    // 切皮肤最容易「屏闪」的原因是：新皮肤先按旧倍率渲染一帧，再改成新倍率。
    // 这里先用缓存过的该皮肤原始尺寸算好倍率，和新皮肤同一帧写进去。
    const payload = { clockStyle: next.key, clockStyleName: next.name, styleHint: `已切换为${next.name}` }
    if (!this.data.immersive && this.lastSlot) {
      const cached = (this.clockNatural || {})[this.clockNaturalKey(next.key)]
      if (cached) {
        const fit = fitScale(this.lastSlot.w, this.lastSlot.h, cached.w, cached.h, { max: 4.2 })
        this.clockFitValue = fit
        payload.clockFitVars = Math.abs(fit - 1) < 0.02 ? '' : `--clk-fit: ${fit};`
      }
    }
    this.setData(payload, () => {
      this.fitClock()
      if (this.data.immersive) this.refreshImmersiveScale()
    })
    wx.setStorageSync(app.globalData.clockStyleKey, next.key)
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
    this.flashStyleHint()
  },

  // 切换提示只短暂出现，1.3 秒后自动收起（不是常驻元素）
  flashStyleHint() {
    if (this.styleHintTimer) clearTimeout(this.styleHintTimer)
    this.styleHintTimer = setTimeout(() => {
      this.styleHintTimer = null
      if (this.data.styleHint) this.setData({ styleHint: '' })
    }, 1300)
  },

  onHide() {
    this.clearChromeIdle()
    if (this.data.chromeIdle) this.setData({ chromeIdle: false })
    if (!this.finished && this.data.runtimeModules.length) this.persistSession()
  },

  onUnload() {
    this.clearChromeIdle()
    if (this.styleHintTimer) {
      clearTimeout(this.styleHintTimer)
      this.styleHintTimer = null
    }
    if (this.fabSettleTimer) {
      clearTimeout(this.fabSettleTimer)
      this.fabSettleTimer = null
    }
    if (this.boundOrientationResize && wx.offWindowResize) {
      wx.offWindowResize(this.boundOrientationResize)
      this.boundOrientationResize = null
      this.orientationBound = false
    }
    // 离开前结算最后一秒，避免会话里少记一段；空会话不再写回，避免生成 0 模块报告
    if (!this.finished && this.data.runtimeModules.length) {
      try { this.tick() } catch (error) { /* 已销毁计时器，忽略 */ }
      this.persistSession()
    }
    clearTimeout(this.timerRevealTimer)
    clearTimeout(this.immersiveAnimTimer)
    clearTimeout(this.immersivePhaseTimer)
    this.stopTicker()
    this.stopMsTicker()
    this.stopTotalBuzz()
    if (wx.setKeepScreenOn) wx.setKeepScreenOn({ keepScreenOn: false, fail: () => {} })
    if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload()
    if (app.audioContext) app.audioContext.stop()
    if (this.tickAudios) {
      Object.keys(this.tickAudios).forEach(key => {
        try { this.tickAudios[key].destroy() } catch (error) {}
      })
      this.tickAudios = null
    }
  },

  startTicker() {
    this.stopTicker()
    this.lastTickAt = Date.now()
    this.timer = setInterval(() => this.tick(true), 1000)
  },

  stopTicker() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  },

  tick(withSound) {
    if (this.data.isPaused || this.finished) return
    const elapsed = Math.floor((Date.now() - this.lastTickAt) / 1000)
    if (!elapsed) return
    this.lastTickAt += elapsed * 1000
    if (withSound) this.playTick()
    this.accumulate(elapsed)
  },

  playTick() {
    if (this.data.tickMuted) return
    this.tickAudioFlip = !this.tickAudioFlip
    const key = this.tickAudioFlip ? 'a' : 'b'
    try {
      this.tickAudios = this.tickAudios || {}
      let audio = this.tickAudios[key]
      if (!audio) {
        audio = wx.createInnerAudioContext()
        audio.src = `/assets/audio/tick-${key}.m4a`
        audio.volume = 0.3
        audio.obeyMuteSwitch = true
        this.tickAudios[key] = audio
      }
      audio.stop()
      audio.play()
    } catch (error) { /* 播放失败不影响计时 */ }
  },

  toggleTick() {
    const muted = !this.data.tickMuted
    this.setData({ tickMuted: muted }, () => {
      if (app.saveSettings) app.saveSettings({ tickSound: !muted })
      this.persistSession()
      if (!muted) this.playTick()
    })
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
  },

  accumulate(elapsed) {
    const modules = clone(this.data.runtimeModules)
    const mode = this.data.mode
    const resting = mode === 'pomodoro' && this.pomodoroPhase === 'rest'
    if (!resting && modules[this.data.currentIndex]) {
      modules[this.data.currentIndex].elapsedSeconds += elapsed
      this.data.moduleSeconds += elapsed
    }
    this.data.globalSeconds += elapsed

    if (mode === 'pomodoro') {
      this.phaseRemaining -= elapsed
      if (this.phaseRemaining <= 0) this.switchPomodoroPhase()
    }

    this.setData({
      runtimeModules: modules,
      globalSeconds: this.data.globalSeconds,
      moduleSeconds: this.data.moduleSeconds
    }, () => {
      this.updateDisplay()
      // 番茄进行中：当前模块到目标就即时结算并接到下一个模块，不打断这个专注段
      if (this.data.mode === 'pomodoro' && this.pomodoroPhase === 'focus' && !this.pomodoroAllDone) {
        if (this.settlePomodoroModule()) {
          this.pomodoroAllDone = true
          setTimeout(() => this.exitTraining(true), 900)
          return
        }
      }
      this.checkAlerts()
    })
  },

  // 番茄与模块融合：每个番茄结束时结算当前模块是否达成目标，达成则自动进入下一模块
  settlePomodoroModule() {
    if (this.pomodoroAllDone) return true
    const current = this.data.runtimeModules[this.data.currentIndex]
    if (!current) return false
    const targetSeconds = (current.targetMinutes || 0) * 60
    if (!targetSeconds || this.data.moduleSeconds < targetSeconds) return false
    const modules = clone(this.data.runtimeModules)
    modules[this.data.currentIndex].status = 'done'
    const nextIndex = modules.findIndex(item => item.status !== 'done')
    if (nextIndex < 0) {
      wx.showToast({ title: '所有模块已完成', icon: 'none', duration: 1200 })
      this.moduleSeconds = modules[this.data.currentIndex].elapsedSeconds || this.data.moduleSeconds
      this.setData({ runtimeModules: modules })
      return true
    }
    modules[nextIndex].status = 'current'
    this.moduleSeconds = modules[nextIndex].elapsedSeconds || 0
    this.moduleAlerted = false
    this.setData({
      runtimeModules: modules,
      currentIndex: nextIndex,
      moduleSeconds: this.moduleSeconds
    }, () => {
      this.updateDisplay()
      this.persistSession()
    })
    wx.showToast({ title: `模块完成，下一个 ${modules[nextIndex].name}`, icon: 'none', duration: 1600 })
    return false
  },

  switchPomodoroPhase() {
    if (this.pomodoroPhase === 'focus') {
      const allDone = this.settlePomodoroModule()
      if (allDone) {
        if (app.vibrate) app.vibrate('heavy')
        if (app.playRing) app.playRing()
        setTimeout(() => this.exitTraining(true), 900)
        return
      }
      const completed = this.pomodoroCycle
      const isLong = completed % LONG_REST_EVERY === 0
      this.pomodoroPhase = 'rest'
      this.phaseRemaining = isLong ? LONG_REST_SECONDS : REST_SECONDS
      if (app.vibrate) app.vibrate('heavy')
      if (app.playRing) app.playRing()
      wx.showToast({ title: isLong ? '长休息 15 分钟' : '休息 5 分钟', icon: 'none', duration: 1600 })
    } else {
      this.pomodoroPhase = 'focus'
      this.phaseRemaining = FOCUS_SECONDS
      this.pomodoroCycle += 1
      if (app.vibrate) app.vibrate('heavy')
      if (app.playRing) app.playRing()
      wx.showToast({ title: '番茄专注开始', icon: 'none', duration: 1600 })
    }
    this.updateDisplay()
  },

  checkAlerts() {
    if (this.finished) return
    const settings = app.getSettings ? app.getSettings() : {}
    const current = this.data.runtimeModules[this.data.currentIndex]
    const targetSeconds = current ? (current.targetMinutes || 0) * 60 : 0

    if (this.data.mode !== 'pomodoro' && targetSeconds && !this.moduleAlerted && this.data.moduleSeconds >= targetSeconds) {
      this.moduleAlerted = true
      if (settings.soundMode !== 'silent') {
        if (app.vibrate) app.vibrate('heavy')
        if (app.playRing) app.playRing()
        wx.showToast({ title: `${current.name} 到时间了`, icon: 'none', duration: 1600 })
      }
    }

    if (this.data.mode === 'countdown') {
      const remaining = this.totalTargetSeconds - this.data.globalSeconds
      if (remaining <= 0) {
        this.finishWithAlert()
        return
      }
      if (settings.overtimeAlert && remaining <= 60 && !this.countdownWarned) {
        this.countdownWarned = true
        if (app.vibrate) app.vibrate('medium')
        wx.showToast({ title: '还剩 1 分钟', icon: 'none', duration: 1500 })
      }
      return
    }

    if (this.data.mode === 'countup' && settings.overtimeAlert && !this.totalAlerted && this.totalTargetSeconds && this.data.globalSeconds >= this.totalTargetSeconds) {
      this.totalAlerted = true
      this.startTotalBuzz()
    }
  },

  // 总时间到：持续震动 + 铃声，直到用户操作或 30 秒后停
  startTotalBuzz() {
    const settings = app.getSettings ? app.getSettings() : {}
    this.setData({ totalDone: true })
    wx.showToast({ title: '总时间到了，可以结束训练', icon: 'none', duration: 2500 })
    if (settings.soundMode === 'silent') return
    if (app.playRing) app.playRing()
    this.stopTotalBuzz()
    let count = 0
    this.buzzTimer = setInterval(() => {
      count += 1
      if (wx.vibrateShort) wx.vibrateShort({ type: 'heavy', fail: () => {} })
      if (count % 6 === 0 && app.playRing) app.playRing()
      if (count >= 20) this.stopTotalBuzz()
    }, 1500)
  },

  stopTotalBuzz() {
    if (this.buzzTimer) clearInterval(this.buzzTimer)
    this.buzzTimer = null
  },

  finishWithAlert() {
    if (this.finished) return
    this.startTotalBuzz()
    setTimeout(() => this.exitTraining(true), 1200)
  },

  updateDisplay() {
    const currentModule = this.data.runtimeModules[this.data.currentIndex] || {}
    const targetSeconds = (currentModule.targetMinutes || 0) * 60
    // 模块用时最多显示 60 分钟，格式「分 : 秒」，不用三段
    const cappedModule = Math.min(this.data.moduleSeconds, 3600)
    const moduleText = `${pad(Math.floor(cappedModule / 60))} : ${pad(cappedModule % 60)}`
    const globalText = clock(this.data.globalSeconds)
    const mode = this.data.mode

    let mainTimeText = globalText
    let mainLabel = '总用时'
    let phaseLabel = ''
    let phaseText = ''
    if (mode === 'countdown') {
      const remaining = Math.max(0, this.totalTargetSeconds - this.data.globalSeconds)
      mainTimeText = clock(remaining)
      mainLabel = '剩余'
    } else if (mode === 'pomodoro') {
      mainTimeText = clock(Math.max(0, this.phaseRemaining))
      const moduleTotal = this.data.runtimeModules.length
      mainLabel = this.pomodoroPhase === 'focus'
        ? (moduleTotal ? `第 ${this.data.currentIndex + 1}/${moduleTotal} 个模块` : '专注')
        : (this.phaseRemaining > REST_SECONDS ? '长休息中' : '休息中')
      phaseLabel = this.pomodoroPhase === 'focus' ? '专注' : (this.phaseRemaining > REST_SECONDS ? '长休息' : '休息')
      phaseText = this.pomodoroPhase === 'focus' ? 'FOCUS' : 'BREAK'
    }

    const previousTimeText = this.lastTimeText || mainTimeText
    const flipCells = mainTimeText.split('').map((text, index) => ({
      key: `flip-${index}`,
      text,
      oldText: previousTimeText[index] || text,
      changed: text !== (previousTimeText[index] || text),
      sep: text === ':'
    }))
    const flipDigits = mainTimeText.split('').map((text, index) => ({ key: `digit-${index}`, text, sep: text === ':' }))
    const ledDigits = mainTimeText.split('').map((text, index) => ({
      key: `led-${index}`,
      sep: text === ':',
      segs: LED_PATTERNS[text] || [0, 0, 0, 0, 0, 0, 0]
    }))
    this.lastTimeText = mainTimeText
    if (flipCells.some(item => item.changed)) this.flipPhase = !this.flipPhase

    const patch = {
      currentModule,
      targetText: targetUnitText(currentModule.targetMinutes),
      globalTimeText: globalText,
      moduleTimeText: moduleText,
      mainTimeText,
      msShow: mainTimeText.length <= 5,
      mainLabel,
      phaseLabel,
      phaseText,
      progressPercent: targetSeconds ? Math.min(100, Math.round(this.data.moduleSeconds / targetSeconds * 100)) : 0,
      isOvertime: this.data.moduleSeconds > targetSeconds,
      isLastModule: this.data.currentIndex >= this.data.runtimeModules.length - 1,
      isFirstModule: this.data.currentIndex <= 0,
      flipCells,
      flipDigits,
      ledDigits,
      flipPhase: !!this.flipPhase
    }
    if (this.lastScrollIndex !== this.data.currentIndex) {
      this.lastScrollIndex = this.data.currentIndex
      patch.moduleScrollTarget = `module-${this.data.currentIndex}`
    }
    this.setData(patch)
  },

  // 全屏时退出键闲置 3s 自动收起（只动透明度与缩放，不参与布局）
  scheduleChromeIdle() {
    clearTimeout(this.chromeIdleTimer)
    if (!this.data.immersive) return
    if (this.data.chromeIdle) this.setData({ chromeIdle: false })
    this.chromeIdleTimer = setTimeout(() => {
      if (this.data.immersive) this.setData({ chromeIdle: true })
    }, CHROME_IDLE_DELAY)
  },

  clearChromeIdle() {
    clearTimeout(this.chromeIdleTimer)
    this.chromeIdleTimer = null
  },

  // 点击屏幕任何位置唤回退出键，并把闲置计时重新开始
  handlePageTap() {
    if (!this.data.immersive) return
    this.scheduleChromeIdle()
  },

  // 模块球：右侧上下拖动，面板根据球在屏幕上半/下半自动向上或向下展开
  // 计时页固定为 landscape，短边才是页面高度；getWindowInfo 在某些环境会返回竖屏尺寸，
  // 这里直接取短边，既避开朝向动画中的缩放测量，也能跟着窗口尺寸变化重算。
  syncModuleFabLayout() {
    let info = null
    try {
      info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    } catch (error) {
      info = null
    }
    if (!info || !info.windowWidth || !info.windowHeight) return
    const winH = this._moduleFabPageH || Math.min(info.windowWidth, info.windowHeight)
    if (!this._moduleFabPageH) this._moduleFabPageH = winH
    // 右上角胶囊必须让开，否则球拖到顶部会压住系统菜单
    let menuBottom = 56
    try {
      const menu = wx.getMenuButtonBoundingClientRect
        ? wx.getMenuButtonBoundingClientRect()
        : null
      if (menu && menu.bottom > 0) menuBottom = Math.min(96, menu.bottom)
    } catch (error) {}
    const topSafe = Math.min(120, Math.max(80, menuBottom + 48))
    const safeBottom = 6
    const min = safeBottom + 16
    const max = Math.max(min, winH - topSafe - 56)
    this._moduleFabMin = min
    this._moduleFabMax = max
    let bottom = Number(this.data.moduleFabBottom)
    if (!isFinite(bottom)) bottom = 20 + safeBottom
    bottom = Math.max(min, Math.min(max, bottom))
    // 球心在屏幕上半区时向下弹，下半区时向上弹
    const down = winH - bottom - 26 < winH * 0.52
    const panelBottom = bottom + 78
    const panelTop = winH - bottom + 10
    const available = down
      ? winH - panelTop - safeBottom - 12
      : winH - panelBottom - topSafe - 12
    const panelMax = Math.max(140, Math.min(winH * 0.54, available))
    const bodyMax = Math.max(96, panelMax - 46)
    const vars = `--fab-bottom: ${bottom}px; --panel-bottom: ${panelBottom}px; --panel-top: ${panelTop}px; --panel-max: ${panelMax}px; --panel-body-max: ${bodyMax}px;`
    this.setData({ moduleFabBottom: bottom, moduleMenuDown: down, moduleFabVars: vars })
    this.measureModuleFabPage()
  },

  // wx.getWindowInfo 在横屏页仍可能返回竖屏尺寸；页面 rect 才是实际可视高度
  measureModuleFabPage() {
    if (this._fabPageQuerying) return
    this._fabPageQuerying = true
    try {
      wx.createSelectorQuery().in(this).select('.timer-page').boundingClientRect().exec((res) => {
        this._fabPageQuerying = false
        const rect = res && res[0]
        const h = rect ? Math.round(rect.height) : 0
        if (!h || Math.abs(h - (this._moduleFabPageH || 0)) < 2) return
        this._moduleFabPageH = h
        this.syncModuleFabLayout()
      })
    } catch (error) {
      this._fabPageQuerying = false
    }
  },

  onModuleFabStart(e) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return
    this._fabDrag = {
      startY: t.clientY,
      startBottom: Number(this.data.moduleFabBottom) || 20,
      lastBottom: Number(this.data.moduleFabBottom) || 20,
      moved: false,
    }
    this.fabJustDragged = false
  },

  onModuleFabMove(e) {
    const d = this._fabDrag
    if (!d) return
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return
    const dy = d.startY - t.clientY
    if (!d.moved && Math.abs(dy) < 5) return
    if (!d.moved) {
      d.moved = true
      this.closeModuleFab()
    }
    const min = this._moduleFabMin || 22
    const max = this._moduleFabMax || Math.max(min, (this._moduleFabPageH || 402) - 8 - 74)
    const next = Math.max(min, Math.min(max, d.startBottom + dy))
    // 拖动期间只做 translate，不改 bottom；避免每帧触发页面布局和 CSS 过渡，跟手更顺
    const offset = Math.round((next - d.startBottom) * 2) / 2
    if (Math.abs(offset - (d.lastOffset || 0)) < .5) return
    d.lastBottom = next
    d.lastOffset = offset
    this.setData({ fabDragging: true, fabDragY: -offset })
  },

  onModuleFabEnd() {
    const d = this._fabDrag
    this._fabDrag = null
    if (!d) return
    if (!d.moved) return
    const finalBottom = d.lastBottom
    this.fabJustDragged = true
    clearTimeout(this.fabTapTimer)
    this.fabTapTimer = setTimeout(() => { this.fabJustDragged = false }, 420)
    // 松手时一次性落到最终位置并清掉拖动位移；settling 让这一次渲染禁用 transform 过渡，
    // 否则 bottom 已更新、位移还在过渡，球会先向上跳再落下来
    this.setData({ moduleFabBottom: finalBottom, fabDragging: false, fabDragY: 0, fabSettling: true }, () => {
      try { wx.setStorageSync('exam-timer-module-fab-bottom', finalBottom) } catch (error) {}
      this.syncModuleFabLayout()
      clearTimeout(this.fabSettleTimer)
      this.fabSettleTimer = setTimeout(() => {
        this.setData({ fabSettling: false })
      }, 40)
    })
  },

  toggleModuleFab() {
    // 刚拖完球，系统随后补发的 tap 不应顺手把面板打开
    if (this.fabJustDragged) return
    this.syncModuleFabLayout()
    this.setData({ moduleOpen: !this.data.moduleOpen })
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
  },

  closeModuleFab() {
    if (!this.data.moduleOpen) return
    this.setData({ moduleOpen: false })
  },

  toggleImmersive() {
    // 动画进行中忽略再次点击，避免两段形变互相打断
    if (this.immersiveBusy) return
    clearTimeout(this.immersiveAnimTimer)
    clearTimeout(this.immersivePhaseTimer)
    if (this.data.immersive) this.closeImmersive()
    else this.openImmersive()
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
  },

  // 量出「时钟中心 → 页面中心」的位移，切换布局前后用同一段 transform 衔接，避免尺寸/位置跳变
  // 全屏倍率：用非全屏时量到的「原始尺寸」算，而不是查表估算。
  // 之前按 CLOCK_BASE 估算：翻页、积木的基准接近真实尺寸，看着正好；
  // 奶糖手写 / 糖果手写 / 果冻这些文字皮肤的基准比真实尺寸大，算出来的倍率偏小，全屏反而显得很小。
  // 现在统一用 natural × scale ≈ 可用宽高，左右留 3%、上下留 14%（退出键 + 安全区）。
  computeImmersiveScale(natural) {
    const info = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()) || {}
    const winW = info.windowWidth || 375
    const winH = info.windowHeight || 667
    const cached = natural || (this.clockNatural || {})[this.clockNaturalKey()]
    const base = CLOCK_BASE[this.data.clockStyle] || CLOCK_BASE.flip
    const natW = (cached && cached.w > 1) ? cached.w : base.w
    const natH = (cached && cached.h > 1) ? cached.h : base.h
    const byWidth = (winW * 0.94) / natW
    const byHeight = (winH * 0.86) / natH
    const scale = Math.min(byWidth, byHeight)
    return Math.round(Math.min(12, Math.max(0.8, scale)) * 100) / 100
  },

  // 读当前皮肤的原始（未缩放）尺寸：优先用 fitClock 的缓存，缺失时现场量一次
  readNaturalSize(callback) {
    const cached = (this.clockNatural || {})[this.clockNaturalKey()]
    if (cached && cached.w > 1 && cached.h > 1) {
      callback(cached)
      return
    }
    try {
      wx.createSelectorQuery().in(this)
        .select('.clock-body')
        .boundingClientRect()
        .exec(res => {
          const rect = res && res[0]
          if (!rect || !rect.width) { callback(null); return }
          const current = this.data.immersive ? 1 : (this.clockFitValue || 1)
          const nat = { w: rect.width / current, h: rect.height / current }
          this.clockNatural = this.clockNatural || {}
          this.clockNatural[this.clockNaturalKey()] = nat
          callback(nat)
        })
    } catch (error) {
      callback(null)
    }
  },

  measureImmersiveShift(callback) {
    const finish = shift => {
      if (shift) this.immersiveShift = shift
      callback(this.immersiveShift || { dx: 0, dy: 0 })
    }
    try {
      wx.createSelectorQuery()
        .select('.clock-body')
        .boundingClientRect()
        .select('.timer-page')
        .boundingClientRect()
        .exec(res => {
          const clock = res && res[0]
          const page = res && res[1]
          if (!clock || !page || !clock.width || !page.width) {
            finish(null)
            return
          }
          finish({
            dx: Math.round(((page.left + page.width / 2) - (clock.left + clock.width / 2)) * 10) / 10,
            dy: Math.round(((page.top + page.height / 2) - (clock.top + clock.height / 2)) * 10) / 10
          })
        })
    } catch (error) {
      finish(null)
    }
  },

  openImmersive() {
    this.immersiveBusy = true
    // 进全屏时收起模块球，避免悬浮在时钟上
    if (this.data.moduleOpen) this.setData({ moduleOpen: false })
    // 先拿到当前皮肤的真实原始尺寸，再算全屏倍率：
    // 文字类皮肤按 CLOCK_BASE 估算会明显偏小，实测之后四种样式在全屏里一样大
    this.readNaturalSize(nat => {
      const immersiveScale = this.computeImmersiveScale(nat)
      this.immersiveScaleTarget = immersiveScale
      // 先不注入倍率：进场起点是 1，等时钟落位后再放开，长到铺满的过程才连续
      this.setData({ immersiveScale, immersiveVars: '' })
      // 进场时先摘掉入场动画：否则 immersiveAnim 结束、reveal 里的动画回到默认层，
      // 会重新排队播一遍，看起来就是「切完又多一下」
      clearTimeout(this.timerRevealTimer)
      this.setData({ timerReveal: false })
      this.measureImmersiveShift(shift => {
        // 第一拍：外围组件快速向外淡出
        this.setData({ immersiveLeaving: true })
        this.immersivePhaseTimer = setTimeout(() => {
          // 第二拍：切到沉浸布局，同时把时钟钉在它原来的位置和大小上
          this.clockMorphAt = Date.now()
          this.setData({
            immersive: true,
            immersiveLeaving: false,
            immersiveAnim: false,
            clockMorph: true,
            clockMorphStyle: `transform: translate3d(${shift.dx}px, ${shift.dy}px, 0) scale(1);`
          }, () => {
            // 下一帧放开过渡：由同一个 transform 平滑长到全屏倍率与页面中心
            this.immersiveAnimTimer = setTimeout(() => {
              this.setData({
                clockMorph: false,
                clockMorphStyle: '',
                immersiveVars: `--ic: ${this.immersiveScaleTarget || 1}; --fc-scale: 1;`
              })
              this.clockMorphAt = Date.now()
              this.scheduleChromeIdle()
              this.immersivePhaseTimer = setTimeout(() => { this.immersiveBusy = false }, 460)
            }, MORPH_GAP)
          })
        }, OUTRO_DELAY)
      })
    })
  },

  closeImmersive() {
    this.immersiveBusy = true
    this.clearChromeIdle()
    if (this.data.chromeIdle) this.setData({ chromeIdle: false })
    const shift = this.immersiveShift || { dx: 0, dy: 0 }
    const scale = this.data.immersiveScale || IMMERSIVE_CLOCK_SCALE[this.data.clockStyle] || 1.26
    // 退出前先按缓存算好普通档的倍率：全屏期间可能切过皮肤，数据里的 --clk-fit 未必对应当前皮肤
    const slot = this.lastSlot
    const cached = (this.clockNatural || {})[this.clockNaturalKey()]
    const exitFit = (slot && cached) ? fitScale(slot.w, slot.h, cached.w, cached.h, { max: 4.2 }) : null
    const exitFitVars = exitFit === null ? '' : (Math.abs(exitFit - 1) < 0.02 ? '' : `--clk-fit: ${exitFit};`)
    // 退场期间关掉 reveal：出全屏动画收尾时 immersiveAnim 撤掉，
    // reveal 那套入场动画会被重新命中再播一遍（内容都复原了才突然多一下）
    clearTimeout(this.timerRevealTimer)
    this.clockMorphAt = Date.now()
    // 第一步：回到普通布局。zoom 先清空（全屏里视觉上就是 zoom=1），
    // 时钟继续用 transform 撑在全屏倍率上，和关闭前那一帧完全重合，不会先缩一下
    this.setData({
      immersive: false,
      immersiveLeaving: false,
      immersiveAnim: true,
      timerReveal: false,
      clockMorph: true,
      clockFitVars: '',
      clockMorphStyle: `transform: translate3d(${shift.dx}px, ${shift.dy}px, 0) scale(${scale});`
    }, () => {
      this.immersiveAnimTimer = setTimeout(() => {
        this.clockMorphAt = Date.now()
        if (exitFit !== null) {
          // 第二步：用 transform 从全屏倍率平滑收回普通档倍率（此时 zoom 还是 1）
          this.setData({ clockMorph: false, clockMorphStyle: `transform: translate3d(0, 0, 0) scale(${exitFit});` })
          this.immersivePhaseTimer = setTimeout(() => {
            this.clockMorphAt = Date.now()
            // 第三步：同一帧把 transform 交还给 zoom（视觉尺寸完全一致，所以不会跳）
            this.clockFitValue = exitFit
            this.setData({ clockMorph: true, clockMorphStyle: '', clockFitVars: exitFitVars, immersiveAnim: false }, () => {
              this.setData({ clockMorph: false })
              // 过渡结束后再校准一次（此时不会再量到 transform 的放大量）
              this.scheduleFitClock()
              this.immersiveBusy = false
            })
          }, 460)
        } else {
          this.setData({ clockMorph: false, clockMorphStyle: '' })
          this.immersivePhaseTimer = setTimeout(() => {
            this.setData({ immersiveAnim: false })
            this.scheduleFitClock()
            this.immersiveBusy = false
          }, 460)
        }
      }, MORPH_GAP)
    })
  },

  togglePause() {
    this.tick()
    const isPaused = !this.data.isPaused
    this.setData({ isPaused })
    if (isPaused) {
      this.stopTotalBuzz()
      this.persistSession()
    } else {
      this.startTicker()
      this.startMsTicker()
    }
  },

  startCompleteHold() {
    clearTimeout(this.completeHoldTimer)
    this.setData({ isHolding: true })
    this.completeHoldTimer = setTimeout(() => {
      this.completeHoldTimer = null
      if (this.data.isHolding) this.exitTraining(true)
    }, 1000)
  },

  endCompleteHold() {
    clearTimeout(this.completeHoldTimer)
    this.completeHoldTimer = null
    this.setData({ isHolding: false })
  },

  goModule(index) {
    const target = this.data.runtimeModules[index]
    if (!target || index === this.data.currentIndex) return
    const modules = clone(this.data.runtimeModules)
    const current = modules[this.data.currentIndex]
    if (current && current.status === 'current') current.status = 'pending'
    modules[index].status = 'current'
    this.moduleAlerted = false
    this.moduleSeconds = target.elapsedSeconds || 0
    this.setData({
      runtimeModules: modules,
      currentIndex: index,
      moduleSeconds: this.moduleSeconds
    }, () => {
      this.updateDisplay()
      this.persistSession()
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
    })
  },

  selectModule(event) {
    this.setData({ moduleOpen: false })
    this.goModule(Number(event.currentTarget.dataset.index))
  },

  prevModule() {
    this.tick()
    if (this.data.currentIndex <= 0) return
    this.goModule(this.data.currentIndex - 1)
  },

  nextModule() {
    this.tick()
    const modules = clone(this.data.runtimeModules)
    const current = modules[this.data.currentIndex]
    if (current) current.status = 'done'
    const nextIndex = modules.findIndex((item, index) => index > this.data.currentIndex && item.status !== 'done')
    const fallbackIndex = modules.findIndex(item => item.status !== 'done')
    const targetIndex = nextIndex >= 0 ? nextIndex : fallbackIndex
    if (targetIndex < 0) {
      this.exitTraining(true)
      return
    }
    modules[targetIndex].status = 'current'
    this.moduleAlerted = false
    this.moduleSeconds = modules[targetIndex].elapsedSeconds || 0
    this.setData({
      runtimeModules: modules,
      currentIndex: targetIndex,
      moduleSeconds: this.moduleSeconds
    }, () => {
      this.updateDisplay()
      this.persistSession()
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
    })
  },

  persistSession() {
    if (!this.data.runtimeModules || !this.data.runtimeModules.length) return
    wx.setStorageSync(app.globalData.storageKey, {
      modules: clone(this.data.runtimeModules),
      startedAt: this.startedAt,
      currentIndex: this.data.currentIndex,
      globalSeconds: this.data.globalSeconds,
      moduleSeconds: this.data.moduleSeconds,
      isPaused: this.data.isPaused,
      mode: this.data.mode,
      totalTargetSeconds: this.totalTargetSeconds,
      pomodoroPhase: this.pomodoroPhase,
      phaseRemaining: this.phaseRemaining,
      pomodoroCycle: this.pomodoroCycle,
      tickSound: !this.data.tickMuted
    })
  },

  exitTraining(celebrate = false) {
    this.tick()
    this.finish(clone(this.data.runtimeModules), celebrate)
  },

  finish(modules, celebrate = false) {
    if (this.finished) return
    this.stopTicker()
    this.stopMsTicker()
    this.stopTotalBuzz()
    this.finished = true
    const finishedModules = Array.isArray(modules) ? modules : this.data.runtimeModules
    if (!finishedModules || !finishedModules.length) {
      // 空会话不生成记录，直接在完成后退出
      wx.removeStorageSync(app.globalData.storageKey)
      this.leaveTimer()
      return
    }
    const startedAt = Number(this.startedAt) || Date.now()
    this.startedAt = startedAt
    const rows = finishedModules.map(item => {
      const deltaSeconds = item.elapsedSeconds - item.targetMinutes * 60
      return { ...item, actualText: shortClock(item.elapsedSeconds), deltaSeconds, deltaText: deltaSeconds > 0 ? `超时 ${shortClock(deltaSeconds)}` : `提前 ${shortClock(Math.abs(deltaSeconds))}` }
    })
    const overtimeCount = rows.filter(item => item.deltaSeconds > 0).length
    const overtimeCheers = ['再接再厉', '锲而不舍', '厚积薄发', '渐入佳境', '稳中求进']
    const successCheers = ['一气呵成', '稳扎稳打', '水到渠成', '行云流水', '渐入佳境']
    const englishCheers = ['nice work', 'well done', 'keep going', 'good job', 'stay sharp', 'one more round']
    const cheerPool = overtimeCount ? overtimeCheers : successCheers
    // 偶尔用简短英文代替中文成语，让结算画面更有变化
    const celebrationMessage = Math.random() < 0.35
      ? englishCheers[Math.floor(Math.random() * englishCheers.length)]
      : cheerPool[Math.floor(Math.random() * cheerPool.length)]
    const report = {
      id: `record-${Date.now()}`,
      startedAt,
      startedAtText: dateTime(startedAt),
      totalTarget: finishedModules.reduce((sum, item) => sum + item.targetMinutes, 0),
      totalActual: this.data.globalSeconds,
      totalActualText: shortClock(this.data.globalSeconds),
      overtimeCount,
      passRate: rows.length ? Math.round(rows.filter(item => item.deltaSeconds <= 0).length / rows.length * 100) : 0,
      rows,
      mode: this.data.mode,
      modeName: this.data.modeName,
      quote: '稳定节奏，持续精进。'
    }
    const records = [report].concat(wx.getStorageSync(app.globalData.recordsKey) || []).slice(0, RECORD_LIMIT)
    wx.setStorageSync(app.globalData.recordsKey, records)
    wx.setStorageSync('exam-timer-pending-report', report)
    if (app.addDailyStat) {
      app.addDailyStat({
        date: dateKey(this.startedAt || Date.now()),
        seconds: this.data.globalSeconds,
        targetSeconds: this.totalTargetSeconds,
        modules: rows.length
      })
    }
    if (app.addTomato) app.addTomato(1)
    wx.removeStorageSync(app.globalData.storageKey)
    if (celebrate) {
      const bubbles = Array.from({ length: 18 }).map((_, index) => ({
        id: index,
        x: 8 + Math.round(Math.random() * 84),
        size: 10 + Math.round(Math.random() * 18),
        delay: index * 22,
        duration: 850 + Math.round(Math.random() * 380),
        tone: index % 3
      }))
      this.setData({ celebrating: true, celebrationBubbles: bubbles, celebrationMessage })
      this.celebrateTimer = setTimeout(() => {
        this.celebrateTimer = null
        this.leaveTimer()
      }, celebrationMessage ? 1800 : 1250)
    } else {
      this.leaveTimer()
    }
  },

  // 横屏计时页先经过竖屏空白页，规避微信「横屏直接返回竖屏」导致的 rpx 放大
  leaveTimer() {
    wx.redirectTo({
      url: '/pages/blank/blank',
      fail: () => wx.navigateBack()
    })
  }
})
