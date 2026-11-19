const app = getApp()
const { pad, minutesText } = require('../../utils/format')
const poster = require('../../utils/poster')
const draw = require('../../utils/poster-draw')
const { createPainter, exportPainter, loadImage, isSupported } = require('../../utils/painter')

Page({
  data: {
    theme: 'sky', themeStyle: '',
    todayText: '0 分钟',
    todayPercent: 0,
    todayTarget: '3 小时',
    weekText: '0 分钟',
    weekDays: 0,
    streak: 0,
    totalDays: 0,
    todayLabel: '',
    calendar: { monthLabel: '', weekdayLabels: [], rows: [], monthSeconds: 0, monthDays: 0 },
    modeName: '正计时',
    weakness: [],
    trendModules: [],
    hasTrend: false,
    poster,
    posterPath: ''
  },

  syncTheme() {
    const theme = app.getTheme ? app.getTheme() : { key: 'rose' }
    if (theme.key !== this.data.theme || (theme.style || '') !== this.data.themeStyle) {
      this.setData({ theme: theme.key, themeStyle: theme.style || '' })
    }
    if (app.applyNavBar) app.applyNavBar()
  },

  onLoad() {
    const theme = app.getTheme ? app.getTheme() : { key: 'rose' }
    const mode = wx.getStorageSync(app.globalData.modeKey) || 'countup'
    const modeInfo = (app.modes || []).find(item => item.key === mode)
    this.setData({ theme: theme.key, themeStyle: theme.style || '', modeName: modeInfo ? modeInfo.name : '正计时' })
    if (app.applyNavBar) app.applyNavBar()
    this.loadPosterLogo()
    this.loadStats()
    this.ready = true
  },

  onShow() {
    if (this.ready) {
      this.syncTheme()
      this.loadStats()
    }
  },

  loadPosterLogo() {
    if (this.posterLogoImage || this.posterLogoLoading) return
    this.posterLogoLoading = true
    loadImage('/assets/brand/logo-mark.png').then(image => {
      this.posterLogoLoading = false
      if (!image) return
      this.posterLogoImage = image
      if (this.ready) this.refreshPoster()
    })
  },

  loadStats() {
    const summary = app.dailyStats()
    const todayLabel = `${summary.today.getFullYear()}.${pad(summary.today.getMonth() + 1)}.${pad(summary.today.getDate())}`

    this.setData({
      posterPath: '',
      todayText: minutesText(summary.todaySeconds),
      todayPercent: summary.todayPercent,
      todayTarget: minutesText(summary.targetSeconds),
      weekText: minutesText(summary.weekSeconds),
      weekDays: summary.weekDays,
      streak: summary.streak,
      totalDays: summary.totalDays,
      todayLabel,
      calendar: summary.calendar,
      ...this.buildInsights()
    }, () => {
      setTimeout(() => this.drawTrend(), 120)
      this.refreshPoster()
    })
  },

  buildInsights() {
    const records = (wx.getStorageSync(app.globalData.recordsKey) || []).slice(0, 12).reverse()
    const map = {}
    const MIN_SECONDS = 60
    records.forEach(record => {
      const rows = record.rows || []
      // 整次训练不足 1 分钟视为测试数据，整体跳过
      const totalElapsed = rows.reduce((sum, row) => sum + (Number(row.elapsedSeconds) || 0), 0)
      if (totalElapsed < MIN_SECONDS) return
      rows.forEach(row => {
        const target = Number(row.targetMinutes) || 0
        const elapsed = Number(row.elapsedSeconds) || 0
        if (!target || elapsed < MIN_SECONDS) return
        const ratio = Math.round(elapsed / (target * 60) * 100)
        if (!map[row.name]) map[row.name] = { name: row.name, values: [] }
        map[row.name].values.push(ratio)
      })
    })
    const all = Object.keys(map).map(name => {
      const values = map[name].values
      const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      return { name, avg, count: values.length, values }
    })
    const weakness = all
      .slice()
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 4)
      .map(item => ({
        name: item.name,
        avg: item.avg,
        count: item.count,
        bar: Math.max(8, Math.min(100, Math.round(item.avg / 150 * 100)))
      }))
    const trendModules = all
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => ({
        name: item.name,
        count: item.count,
        series: item.values.slice(-8),
        last: item.values[item.values.length - 1]
      }))
    return {
      weakness,
      trendModules,
      hasTrend: trendModules.some(item => item.series.length >= 2)
    }
  },

  drawTrend() {
    if (!this.data.hasTrend) return
    const theme = app.getTheme()
    const palette = theme.canvas
    const tone = theme.css || {}
    const edge = tone.edge || palette.panel
    const cream1 = tone['cream-1'] || palette.soft
    const line = tone.line || palette.soft
    const primary = tone.primary || palette.highlight
    const primary2 = tone['primary-2'] || palette.accent || palette.highlight
    const success = tone.success || palette.success || palette.sub
    const colors = [primary, primary2, success]
    const ctx = wx.createCanvasContext('trendCanvas', this)
    const W = 300
    const H = 150
    const left = 26
    const right = 12
    const top = 14
    const bottom = 20
    const plotW = W - left - right
    const plotH = H - top - bottom
    const series = this.data.trendModules
    const maxLen = Math.max(2, ...series.map(item => item.series.length))
    const maxVal = Math.max(140, ...series.map(item => Math.max(...item.series)))
    const yOf = value => top + plotH - Math.min(1, value / maxVal) * plotH
    const xOf = index => left + (maxLen === 1 ? plotW / 2 : index / (maxLen - 1) * plotW)
    const alpha = (hex, a) => {
      const value = String(hex || '#5AA9E6').replace('#', '')
      const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value
      const r = parseInt(full.slice(0, 2), 16)
      const g = parseInt(full.slice(2, 4), 16)
      const b = parseInt(full.slice(4, 6), 16)
      return `rgba(${r}, ${g}, ${b}, ${a})`
    }

    ctx.setFillStyle('rgba(0,0,0,0)')
    ctx.fillRect(0, 0, W, H)

    // 底格：浅色细线，不抢主体
    for (let i = 0; i <= 3; i += 1) {
      const y = top + (plotH / 3) * i
      ctx.setStrokeStyle(i === 3 ? line : cream1)
      ctx.setLineWidth(1)
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(W - right, y)
      ctx.stroke()
    }

    // 100% 基准线：虚线 + 右侧刻度，跟卡片描边同色
    const baseY = yOf(100)
    ctx.setStrokeStyle(edge)
    ctx.setLineWidth(1.5)
    for (let x = left; x < W - right; x += 10) {
      ctx.beginPath()
      ctx.moveTo(x, baseY)
      ctx.lineTo(Math.min(x + 6, W - right), baseY)
      ctx.stroke()
    }
    ctx.setFillStyle(alpha(edge, .55))
    ctx.setFontSize(8)
    ctx.fillText('100%', W - right - 24, baseY - 4)

    // 折线：粗描边 + 半透明面积 + 圆把手点，沿用首页那张手绘卡的画法
    series.forEach((item, index) => {
      const color = colors[index % colors.length]
      const points = item.series.map((value, i) => ({ x: xOf(i), y: yOf(value) }))
      if (!points.length) return
      ctx.setFillStyle(alpha(color, .13))
      ctx.beginPath()
      points.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      ctx.lineTo(points[points.length - 1].x, top + plotH)
      ctx.lineTo(points[0].x, top + plotH)
      ctx.closePath()
      ctx.fill()

      ctx.setStrokeStyle(color)
      ctx.setLineWidth(3.4)
      ctx.setLineJoin('round')
      ctx.setLineCap('round')
      ctx.beginPath()
      points.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      ctx.stroke()

      points.forEach((point, i) => {
        const last = i === points.length - 1
        ctx.setFillStyle(edge)
        ctx.beginPath()
        ctx.arc(point.x, point.y, last ? 5.4 : 4.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.setFillStyle(color)
        ctx.beginPath()
        ctx.arc(point.x, point.y, last ? 3.4 : 2.6, 0, Math.PI * 2)
        ctx.fill()
      })
    })

    ctx.draw()
  },

  drawPoster(onReady) {
    const theme = app.getTheme()
    const palette = theme.canvas
    const tone = theme.css || {}
    const edge = tone.edge || palette.panel
    const shadow = tone.shadow || palette.panel
    const card = palette.card
    const accentBg = tone['accent-bg'] || palette.accent
    const cream1 = tone['cream-1'] || palette.soft
    const cream2 = tone['cream-2'] || palette.soft
    const line = tone.line || palette.soft
    const primary = tone.primary || palette.highlight
    const primary2 = tone['primary-2'] || palette.panel
    const onPrimary = tone['on-primary'] || palette.ink
    const onPanel = palette.onPanel || palette.ink
    const percent = Math.max(0, Math.min(100, this.data.todayPercent || 0))
    const dateText = this.data.todayLabel || ''
    const W = 750
    const H = 1200
    if (!isSupported()) {
      wx.showToast({ title: '当前版本不支持生成海报', icon: 'none' })
      if (onReady) onReady('')
      return
    }
    let painter = null
    try {
      painter = createPainter(W, H, 2)
    } catch (error) {
      console.warn('[poster] createPainter failed', error)
    }
    if (!painter) {
      wx.showToast({ title: '生成失败，请重试', icon: 'none' })
      if (onReady) onReady('')
      return
    }
    const context = painter.context
    const M = 48
    const CW = W - M * 2
    const cal = this.data.calendar || { rows: [] }

    // 底色 + 主题色泡泡装饰
    context.setFillStyle(palette.bg)
    context.fillRect(0, 0, W, H)
    draw.circle(context, 690, 104, 18, accentBg)
    draw.circle(context, 660, 136, 9, cream2)
    draw.circle(context, 62, 1118, 14, cream2)

    // 页头：品牌 logo + 品牌名 + 日期 + 手绘标题
    if (this.posterLogoImage) {
      context.drawImage(this.posterLogoImage, M, 24, 38, 38)
    }
    const brandX = this.posterLogoImage ? M + 46 : M
    context.setFillStyle(palette.sub)
    context.setFontSize(18)
    context.fillText(poster.brand, brandX, 62)
    const dateWidth = context.measureText(dateText).width
    context.fillText(dateText, W - M - dateWidth, 62)
    context.setFontSize(38)
    const titleWidth = context.measureText(poster.title).width
    draw.roundRect(context, M - 4, 92, titleWidth + 18, 36, 8, accentBg)
    context.setFillStyle(palette.ink)
    context.fillText(poster.title, M, 118)

    // 主卡：今日完成度 + 番茄进度环
    draw.stickerCard(context, M, 180, CW, 300, 28, accentBg, edge, shadow, 7)
    context.setFillStyle(palette.sub)
    context.setFontSize(20)
    context.fillText(poster.ringLabel, M + 36, 238)

    const percentText = `${percent}`
    context.setFillStyle(palette.ink)
    context.setFontWeight(900)
    context.setFontSize(108)
    context.fillText(percentText, M + 32, 350)
    const percentWidth = context.measureText(percentText).width
    context.setFillStyle(palette.sub)
    context.setFontWeight(800)
    context.setFontSize(34)
    context.fillText('%', M + 44 + percentWidth, 350)
    context.setFontWeight(700)

    context.setFillStyle(palette.sub)
    context.setFontSize(19)
    context.fillText(`${poster.metricToday} ${this.data.todayText} · 目标 ${this.data.todayTarget}`, M + 36, 410)

    draw.ring(context, 590, 300, 70, percent, line, primary, 10)
    // 环心里放品牌 logo（取不到图时退回原来的小番茄）
    if (this.posterLogoImage) {
      const markSize = 62
      context.drawImage(this.posterLogoImage, 590 - markSize / 2, 300 - markSize / 2, markSize, markSize)
    } else {
      draw.circle(context, 590, 300, 25, palette.danger)
      draw.circle(context, 582, 292, 8, palette.accent)
      draw.roundRect(context, 584, 266, 22, 10, 4, palette.success)
    }
    context.setFillStyle(palette.sub)
    context.setFontSize(17)
    context.fillText('今日目标', 560, 396)

    // 三个指标贴纸
    const metrics = [
      { label: poster.metricToday, value: this.data.todayText },
      { label: poster.metricWeek, value: this.data.weekText },
      { label: poster.metricStreak, value: `${this.data.streak} ${poster.calendarUnit}` }
    ]
    const gap = 12
    const metricW = (CW - gap * 2) / 3
    metrics.forEach((item, index) => {
      const x = M + index * (metricW + gap)
      draw.stickerCard(context, x, 500, metricW, 112, 20, card, edge, shadow, 4)
      draw.roundRect(context, x + 18, 520, 24, 6, 3, primary)
      context.setFillStyle(palette.sub)
      context.setFontSize(18)
      context.fillText(item.label, x + 18, 558)
      context.setFillStyle(palette.ink)
      context.setFontWeight(800)
      context.setFontSize(28)
      context.fillText(draw.fitText(context, item.value, metricW - 36), x + 18, 592)
      context.setFontWeight(700)
    })

    // 本月日历卡
    draw.stickerCard(context, M, 636, CW, 414, 28, card, edge, shadow, 7)
    context.setFillStyle(palette.ink)
    context.setFontSize(24)
    context.fillText(`${poster.calendarTitle} ${(cal && cal.monthDays) || 0} ${poster.calendarUnit}`, M + 28, 680)
    context.setFillStyle(palette.sub)
    context.setFontSize(18)
    const monthText = (cal && cal.monthLabel ? cal.monthLabel : '').replace('年', '.').replace('月', '').replace(/ /g, '')
    const monthWidth = context.measureText(monthText).width
    context.fillText(monthText, W - M - 28 - monthWidth, 680)

    const weekday = ['一', '二', '三', '四', '五', '六', '日']
    const cellW = 78
    const cellH = 40
    const cellGap = 8
    const rowGap = 7
    const gridW = cellW * 7 + cellGap * 6
    const gridX = (W - gridW) / 2
    let y = 730
    context.setFillStyle(palette.sub)
    context.setFontSize(17)
    weekday.forEach((label, index) => {
      const w = context.measureText(label).width
      context.fillText(label, gridX + index * (cellW + cellGap) + (cellW - w) / 2, y)
    })

    y = 752
    const levelColors = {
      '0': cream1,
      '1': accentBg,
      '2': primary,
      '3': primary2,
      '4': palette.panel,
      none: palette.bg
    }
    ;(cal.rows || []).forEach((row) => {
      const cells = row.cells || []
      cells.forEach((item, index) => {
        const x = gridX + index * (cellW + cellGap)
        if (item.empty) return
        draw.roundRect(context, x, y, cellW, cellH, 8, levelColors[item.level] || cream1)
        if (item.isToday) {
          context.setStrokeStyle(edge)
          context.setLineWidth(3)
          context.strokeRect(x, y, cellW, cellH)
        }
        context.setFillStyle(item.level === '4' ? onPanel : (item.level === '2' || item.level === '3') ? onPrimary : palette.ink)
        context.setFontSize(19)
        const dayText = `${item.day}`
        const dw = context.measureText(dayText).width
        context.fillText(dayText, x + (cellW - dw) / 2, y + 27)
      })
      y += cellH + rowGap
    })

    // 金句贴纸 + 页脚
    draw.stickerCard(context, M, 1080, CW, 64, 18, palette.panel, edge, shadow, 5)
    context.setFillStyle(onPanel)
    context.setFontSize(19)
    context.fillText(draw.fitText(context, poster.quote, CW - 44), M + 22, 1120)
    context.setFillStyle(palette.sub)
    context.setFontSize(16)
    context.fillText(poster.footLeft, M, 1170)
    const footRightWidth = context.measureText(poster.footRight).width
    context.fillText(poster.footRight, W - M - footRightWidth, 1170)

    context.draw(false, () => this.exportPoster(painter, onReady))
  },

  exportPoster(painter, onReady) {
    exportPainter(painter, 1500, 2400).then(path => {
      if (path) {
        this.posterPath = path
        if (onReady) onReady(path)
        else wx.previewImage({ urls: [path] })
        return
      }
      wx.showToast({ title: '生成失败，请重试', icon: 'none' })
      console.warn('[poster] canvasToTempFilePath failed')
      if (onReady) onReady('')
    })
  },

  refreshPoster() {
    clearTimeout(this.posterTimer)
    this.posterTimer = setTimeout(() => {
      this.drawPoster(path => {
        if (path && path !== this.data.posterPath) this.setData({ posterPath: path })
      })
    }, 160)
  },

  previewPoster() {
    if (!this.data.posterPath) return
    wx.previewImage({ urls: [this.data.posterPath] })
  },

  handlePosterLongPress() {
    const path = this.data.posterPath
    if (!path) return
    wx.showActionSheet({
      itemList: ['保存到相册', '发送给朋友'],
      success: ({ tapIndex }) => {
        if (tapIndex === 0) {
          const settings = app.getSettings ? app.getSettings() : {}
          if (settings.privacyAlbum === false) {
            wx.showModal({
              title: '相册保存已关闭',
              content: '可在设置 → 隐私与权限里重新打开「保存图片到相册」。',
              confirmText: '去设置',
              success: res => { if (res.confirm) wx.navigateTo({ url: '/pages/settings/settings' }) }
            })
            return
          }
          wx.saveImageToPhotosAlbum({
            filePath: path,
            success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
            fail: () => wx.showToast({ title: '保存失败，请允许相册权限', icon: 'none' })
          })
          return
        }
        if (wx.showShareImageMenu) {
          wx.showShareImageMenu({ path, fail: () => wx.previewImage({ urls: [path] }) })
          return
        }
        wx.previewImage({ urls: [path] })
      },
      fail: () => {}
    })
  },

  onUnload() {
    clearTimeout(this.posterTimer)
  },
  handleBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else wx.reLaunch({ url: '/pages/index/index' })
  },

  onShareAppMessage() {
    return {
      title: `我在小鱼计时器连续打卡 ${this.data.streak} 天，今日完成 ${this.data.todayPercent}%`,
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return {
      title: `我连续打卡 ${this.data.streak} 天，今日完成 ${this.data.todayPercent}%`,
      query: ''
    }
  },

  onPageScroll(event) {
    const next = (event.scrollTop || 0) > 48
    if (next !== this.data.dockDim) this.setData({ dockDim: next })
  }
})
