const app = getApp()
const { pad, minutesText } = require('../../utils/format')
const poster = require('../../utils/poster')

Page({
  data: {
    theme: 'pearl', themeStyle: '',
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
    this.loadStats()
    this.ready = true
  },

  onShow() {
    if (this.ready) {
      this.syncTheme()
      this.loadStats()
    }
  },

  loadStats() {
    const summary = app.dailyStats()
    const todayLabel = `${summary.today.getFullYear()}.${pad(summary.today.getMonth() + 1)}.${pad(summary.today.getDate())}`

    this.setData({
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
    const palette = app.getTheme().canvas
    const colors = [palette.highlight, palette.accent || palette.highlight, palette.success || palette.sub]
    const ctx = wx.createCanvasContext('trendCanvas', this)
    const W = 300
    const H = 150
    const left = 30
    const right = 10
    const top = 12
    const bottom = 22
    const plotW = W - left - right
    const plotH = H - top - bottom
    const series = this.data.trendModules
    const maxLen = Math.max(2, ...series.map(item => item.series.length))
    const maxVal = Math.max(140, ...series.map(item => Math.max(...item.series)))
    const yOf = value => top + plotH - Math.min(1, value / maxVal) * plotH
    const xOf = index => left + (maxLen === 1 ? plotW / 2 : index / (maxLen - 1) * plotW)

    ctx.setFillStyle('rgba(0,0,0,0)')
    ctx.fillRect(0, 0, W, H)
    // 网格
    for (let i = 0; i <= 3; i += 1) {
      const y = top + (plotH / 3) * i
      ctx.setStrokeStyle(palette.soft)
      ctx.setLineWidth(1)
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(W - right, y)
      ctx.stroke()
    }
    // 100% 基准线
    ctx.setStrokeStyle(palette.sub)
    ctx.setLineWidth(1.5)
    ctx.beginPath()
    ctx.moveTo(left, yOf(100))
    ctx.lineTo(W - right, yOf(100))
    ctx.stroke()

    series.forEach((item, index) => {
      const color = colors[index % colors.length]
      ctx.setStrokeStyle(color)
      ctx.setLineWidth(2.5)
      ctx.beginPath()
      item.series.forEach((value, i) => {
        const x = xOf(i)
        const y = yOf(value)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.setFillStyle(color)
      item.series.forEach((value, i) => {
        const x = xOf(i)
        const y = yOf(value)
        ctx.beginPath()
        ctx.arc(x, y, 2.4, 0, Math.PI * 2)
        ctx.fill()
      })
    })
    ctx.draw()
  },

  drawPoster(onReady) {
    const palette = app.getTheme().canvas
    const percent = Math.max(0, Math.min(100, this.data.todayPercent || 0))
    const today = new Date()
    const dateText = `${today.getFullYear()}.${pad(today.getMonth() + 1)}.${pad(today.getDate())}`
    const context = wx.createCanvasContext('posterCanvas', this)
    const W = 750
    const H = 1200
    const cal = this.data.calendar || { rows: [] }

    context.setFillStyle(palette.bg)
    context.fillRect(0, 0, W, H)

    // 顶部品牌条
    context.setFillStyle(palette.panel)
    context.fillRect(0, 0, W, 208)
    context.setFillStyle(palette.highlight)
    context.setFontSize(20)
    context.fillText(poster.brand, 60, 66)
    context.setFillStyle(palette.onPanel)
    context.setFontSize(44)
    context.fillText(poster.title, 60, 130)
    context.setFontSize(22)
    const dateWidth = context.measureText(dateText).width
    context.fillText(dateText, W - 60 - dateWidth, 130)
    context.setFillStyle(palette.soft)
    context.fillRect(60, 156, W - 120, 3)

    // 大百分比 + 进度条
    const percentText = `${percent}`
    context.setFillStyle(palette.ink)
    context.setFontSize(124)
    context.fillText(percentText, 58, 358)
    const pWidth = context.measureText(percentText).width
    context.setFillStyle(palette.sub)
    context.setFontSize(40)
    context.fillText('%', 70 + pWidth, 358)
    context.setFontSize(22)
    context.fillText(poster.ringLabel, 74 + pWidth, 298)

    context.setFillStyle(palette.soft)
    context.fillRect(60, 402, W - 120, 18)
    context.setFillStyle(palette.highlight)
    context.fillRect(60, 402, Math.max(12, (W - 120) * percent / 100), 18)
    context.setFillStyle(palette.sub)
    context.setFontSize(20)
    context.fillText(`${poster.metricToday} ${this.data.todayText} · 目标 ${this.data.todayTarget}`, 60, 458)

    // 三列指标
    const metrics = [
      { label: poster.metricToday, value: this.data.todayText },
      { label: poster.metricWeek, value: this.data.weekText },
      { label: poster.metricStreak, value: `${this.data.streak} ${poster.calendarUnit}` }
    ]
    const colW = (W - 120) / 3
    metrics.forEach((item, index) => {
      const x = 60 + index * colW
      if (index > 0) {
        context.setFillStyle(palette.soft)
        context.fillRect(x - 20, 496, 3, 84)
      }
      context.setFillStyle(palette.sub)
      context.setFontSize(18)
      context.fillText(item.label, x + (index > 0 ? 0 : 0), 520)
      context.setFillStyle(palette.ink)
      context.setFontSize(34)
      context.fillText(item.value, x + (index > 0 ? 0 : 0), 570)
    })

    // 本月日历
    context.setFillStyle(palette.soft)
    context.fillRect(60, 626, W - 120, 3)
    context.setFillStyle(palette.ink)
    context.setFontSize(24)
    context.fillText(`${poster.calendarTitle} ${this.data.calendar.monthDays || 0} ${poster.calendarUnit}`, 60, 682)
    context.setFillStyle(palette.sub)
    context.setFontSize(18)
    context.fillText(poster.calendarUnit === '天' ? `${(this.data.calendar.monthLabel || '').replace('年', '.').replace('月', '').replace(/ /g, '')}` : '', 60, 710)

    const weekday = ['一', '二', '三', '四', '五', '六', '日']
    const cellW = 84
    const cellH = 42
    const gap = 6
    const gridW = cellW * 7 + gap * 6
    const gridX = (W - gridW) / 2
    let y = 750
    context.setFillStyle(palette.sub)
    context.setFontSize(19)
    weekday.forEach((label, index) => {
      const w = context.measureText(label).width
      context.fillText(label, gridX + index * (cellW + gap) + (cellW - w) / 2, y - 16)
    })

    const levelColors = {
      '0': palette.soft,
      '1': palette.accent,
      '2': palette.highlight,
      '3': palette.onPanelWarm || palette.highlight,
      '4': palette.panel,
      none: palette.bg
    }
    ;(cal.rows || []).forEach((row) => {
      const cells = row.cells || []
      cells.forEach((item, index) => {
        const x = gridX + index * (cellW + gap)
        if (item.empty) return
        context.setFillStyle(levelColors[item.level] || palette.soft)
        context.fillRect(x, y, cellW, cellH)
        if (item.isToday) {
          context.setStrokeStyle(palette.panel)
          context.setLineWidth(4)
          context.strokeRect(x, y, cellW, cellH)
        }
        context.setFillStyle(item.level === '4' || item.level === '3' ? palette.onPanel : palette.ink)
        context.setFontSize(21)
        const dayText = `${item.day}`
        const dw = context.measureText(dayText).width
        context.fillText(dayText, x + (cellW - dw) / 2, y + cellH / 2 + 7)
      })
      y += cellH + gap
    })

    // 金句
    context.setFillStyle(palette.panel)
    context.fillRect(60, 1064, W - 120, 72)
    context.setFillStyle(palette.onPanel)
    context.setFontSize(22)
    context.fillText(poster.quote, 88, 1108)

    // 页脚
    context.setFillStyle(palette.sub)
    context.setFontSize(18)
    context.fillText(poster.footLeft, 60, 1180)
    const footRightWidth = context.measureText(poster.footRight).width
    context.fillText(poster.footRight, W - 60 - footRightWidth, 1180)

    context.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'posterCanvas',
        destWidth: 1500,
        destHeight: 2400,
        success: ({ tempFilePath }) => {
          this.posterPath = tempFilePath
          if (onReady) onReady(tempFilePath)
          else wx.previewImage({ urls: [tempFilePath] })
        },
        fail: () => wx.showToast({ title: '生成失败，请重试', icon: 'none' })
      }, this)
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

  savePoster() {
    this.drawPoster((path) => {
      wx.saveImageToPhotosAlbum({
        filePath: path,
        success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
        fail: () => wx.showToast({ title: '保存失败，请允许相册权限', icon: 'none' })
      })
    })
  },

  sharePoster() {
    this.drawPoster((path) => {
      if (wx.showShareImageMenu) {
        wx.showShareImageMenu({
          path,
          fail: () => wx.previewImage({ urls: [path] })
        })
        return
      }
      wx.showModal({
        title: '直接分享图片暂不可用',
        content: poster.savedTip,
        showCancel: false,
        confirmText: '预览',
        success: () => wx.previewImage({ urls: [path] })
      })
    })
  },

  handleBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else wx.reLaunch({ url: '/pages/index/index' })
  },

  onShareAppMessage() {
    return {
      title: `我在泡泡计时器连续打卡 ${this.data.streak} 天，今日完成 ${this.data.todayPercent}%`,
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return {
      title: `我连续打卡 ${this.data.streak} 天，今日完成 ${this.data.todayPercent}%`,
      query: ''
    }
  }
})
