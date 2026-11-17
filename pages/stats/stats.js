const app = getApp()
const { pad, minutesText } = require('../../utils/format')
const poster = require('../../utils/poster')
const HEAT_LEVELS = ['0', '1', '2', '3', '4']

Page({
  data: {
    theme: 'cream',
    todayText: '0 分钟',
    todayPercent: 0,
    todayTarget: '3 小时',
    weekText: '0 分钟',
    weekDays: 0,
    streak: 0,
    totalDays: 0,
    todayLabel: '',
    heatCols: [],
    heatLegend: HEAT_LEVELS,
    trend: [],
    rankList: [],
    weekRank: 0,
    modeName: '正计时',
    poster
  },

  onLoad() {
    const theme = app.getTheme ? app.getTheme() : { key: 'cream' }
    const mode = wx.getStorageSync(app.globalData.modeKey) || 'countup'
    const modeInfo = (app.modes || []).find(item => item.key === mode)
    this.setData({ theme: theme.key, modeName: modeInfo ? modeInfo.name : '正计时' })
    if (app.applyNavBar) app.applyNavBar()
    this.loadStats()
  },

  loadStats() {
    const summary = app.dailyStats()
    const todayLabel = `${summary.today.getFullYear()}.${pad(summary.today.getMonth() + 1)}.${pad(summary.today.getDate())}`

    const maxSeconds = summary.trend.reduce((max, item) => Math.max(max, item.seconds || 0), 1)
    const trendBars = summary.trend.map(item => ({
      ...item,
      text: `${Math.floor((item.seconds || 0) / 60)}`,
      height: Math.max(4, Math.round((item.seconds || 0) / maxSeconds * 100))
    }))

    const rankList = summary.weekDaily.map(item => ({
      key: item.key,
      label: item.label,
      seconds: item.seconds || 0,
      text: `${Math.floor((item.seconds || 0) / 60)} 分钟`
    }))
    rankList.sort((a, b) => b.seconds - a.seconds)
    const maxRank = rankList.length ? rankList[0].seconds : 1
    rankList.forEach(item => {
      item.width = maxRank ? Math.max(item.seconds ? 6 : 0, Math.round(item.seconds / maxRank * 100)) : 0
    })

    this.setData({
      todayText: minutesText(summary.todaySeconds),
      todayPercent: summary.todayPercent,
      todayTarget: minutesText(summary.targetSeconds),
      weekText: minutesText(summary.weekSeconds),
      weekDays: summary.weekDays,
      streak: summary.streak,
      totalDays: summary.totalDays,
      todayLabel,
      heatCols: summary.heatCols,
      trend: trendBars,
      rankList,
      weekRank: summary.weekSeconds
    })
  },

  drawPoster(onReady) {
    const palette = app.getTheme().canvas
    const percent = Math.max(0, Math.min(100, this.data.todayPercent || 0))
    const today = new Date()
    const dateText = `${today.getFullYear()}.${pad(today.getMonth() + 1)}.${pad(today.getDate())}`
    const context = wx.createCanvasContext('posterCanvas', this)
    const W = 750
    const H = 1180

    // 底
    context.setFillStyle(palette.bg)
    context.fillRect(0, 0, W, H)

    // 顶部品牌条
    context.setFillStyle(palette.panel)
    context.fillRect(0, 0, W, 168)
    context.setFillStyle(palette.highlight)
    context.setFontSize(20)
    context.fillText(poster.brand, 60, 66)
    context.setFillStyle(palette.onPanel)
    context.setFontSize(40)
    context.fillText(poster.title, 60, 122)
    context.setFillStyle(palette.onPanel)
    context.setFontSize(22)
    context.fillText(dateText, W - 60 - context.measureText(dateText).width, 122)

    // 圆环 + 百分比
    const ringX = 236
    const ringY = 430
    const ringR = 132
    context.setLineWidth(26)
    context.setStrokeStyle(palette.soft)
    context.beginPath()
    context.arc(ringX, ringY, ringR, 0, Math.PI * 2, false)
    context.stroke()
    context.setStrokeStyle(palette.highlight)
    context.beginPath()
    context.arc(ringX, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * percent / 100, false)
    context.stroke()

    const percentText = `${percent}`
    context.setFillStyle(palette.ink)
    context.setFontSize(112)
    const pWidth = context.measureText(percentText).width
    context.fillText(percentText, ringX - pWidth / 2 - 22, ringY + 34)
    context.setFillStyle(palette.sub)
    context.setFontSize(34)
    context.fillText('%', ringX + pWidth / 2 - 18, ringY + 34)
    context.setFillStyle(palette.sub)
    context.setFontSize(20)
    context.fillText(poster.ringLabel, ringX - 66, ringY + 86)

    // 右侧三行指标
    const rows = [
      { label: poster.metricToday, value: this.data.todayText },
      { label: poster.metricWeek, value: this.data.weekText },
      { label: poster.metricStreak, value: `${this.data.streak} 天` }
    ]
    rows.forEach((row, index) => {
      const y = 340 + index * 96
      context.setFillStyle(palette.sub)
      context.setFontSize(20)
      context.fillText(row.label, 436, y)
      context.setFillStyle(palette.ink)
      context.setFontSize(38)
      context.fillText(row.value, 436, y + 38)
      context.setFillStyle(palette.soft)
      context.fillRect(436, y + 54, 248, 3)
    })

    // 分割线
    context.setFillStyle(palette.soft)
    context.fillRect(60, 596, W - 120, 3)

    // 近 7 天小柱
    context.setFillStyle(palette.ink)
    context.setFontSize(24)
    context.fillText(poster.trendTitle, 60, 654)
    context.setFillStyle(palette.sub)
    context.setFontSize(18)
    context.fillText(poster.trendUnit, W - 140, 654)

    const bars = this.data.trend || []
    const baseY = 852
    const colWidth = 76
    const gap = (W - 120 - bars.length * colWidth) / (bars.length - 1 || 1)
    bars.forEach((item, index) => {
      const x = 60 + index * (colWidth + gap)
      const h = Math.max(8, 150 * (item.height || 0) / 100)
      context.setFillStyle(palette.soft)
      context.fillRect(x, baseY - 150, colWidth, 150)
      context.setFillStyle(palette.highlight)
      context.fillRect(x, baseY - h, colWidth, h)
      if (index === bars.length - 1) {
        context.setFillStyle(palette.panel)
        context.fillRect(x, baseY - h, colWidth, 6)
      }
      context.setFillStyle(palette.ink)
      context.setFontSize(20)
      const labelWidth = context.measureText(item.label).width
      context.fillText(item.label, x + (colWidth - labelWidth) / 2, baseY + 32)
      context.setFillStyle(palette.sub)
      context.setFontSize(18)
      context.fillText(item.text, x + (colWidth - context.measureText(item.text).width) / 2, baseY - 168)
    })
    context.setFillStyle(palette.soft)
    context.fillRect(60, baseY, W - 120, 3)

    // 底部金句
    context.setFillStyle(palette.panel)
    context.fillRect(60, 952, W - 120, 128)
    context.setFillStyle(palette.highlight)
    context.setFontSize(26)
    context.fillText('★', 92, 1016)
    context.setFillStyle(palette.onPanel)
    context.setFontSize(24)
    context.fillText(poster.quote, 136, 1016)
    context.setFillStyle(palette.soft)
    context.setFontSize(18)
    context.fillText(`${poster.totalPrefix} ${this.data.totalDays} 天`, 92, 1052)

    // 页脚
    context.setFillStyle(palette.sub)
    context.setFontSize(20)
    context.fillText(poster.footLeft, 60, 1122)
    context.setFillStyle(palette.sub)
    context.setFontSize(16)
    context.fillText(poster.footRight, W - 60 - 128, 1122)

    context.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'posterCanvas',
        destWidth: 1500,
        destHeight: 2360,
        success: ({ tempFilePath }) => {
          this.posterPath = tempFilePath
          if (onReady) onReady(tempFilePath)
          else wx.previewImage({ urls: [tempFilePath] })
        },
        fail: () => wx.showToast({ title: '生成失败，请重试', icon: 'none' })
      }, this)
    })
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
      title: `我在小鱼计时器连续打卡 ${this.data.streak} 天，今日完成 ${this.data.todayPercent}%`,
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
