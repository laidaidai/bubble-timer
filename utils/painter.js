// 离屏画布：把原来基于旧版 canvas（canvas-id）的绘制代码，接到 Canvas 2D 的离屏画布上执行。
//
// 这样做的好处：
// 1) 页面里不用再摆 <canvas>。旧版 canvas 是原生组件，不管藏到视口外还是透明都会被它挡住点击，
//    放在视口内又会拦截整页手势，这也是报告页三个按钮、打卡页海报反复出问题的根源。
// 2) 离屏画布没有 DOM 依赖，wx.canvasToTempFilePath 直接传 canvas 节点导出，不受位置/遮挡影响。
//
// 用法：painter = createPainter(750, 1200, 2) → 用 painter.context 按旧 API 画
//      → exportPainter(painter, 1500, 2400) 拿到临时文件路径。

// 和小程序页面用的同一套字体栈（app.wxss 里就是这一串），海报里的字才不会和页面两个长相
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif'

function createPainter(width, height, scale) {
  const factor = scale || 2
  const pixelWidth = Math.round(width * factor)
  const pixelHeight = Math.round(height * factor)
  const canvas = wx.createOffscreenCanvas({ type: '2d', width: pixelWidth, height: pixelHeight })
  const ctx = canvas.getContext('2d')
  // 之后所有绘制坐标都还按 750×1200 的旧坐标系走，由这里统一放大到实际像素
  ctx.scale(factor, factor)

  let fontSize = 16
  let fontWeight = 700
  const syncFont = () => { ctx.font = `${fontWeight} ${fontSize}px ${FONT_FAMILY}` }
  syncFont()

  const context = {
    setFillStyle(color) { ctx.fillStyle = color },
    setStrokeStyle(color) { ctx.strokeStyle = color },
    setLineWidth(lineWidth) { ctx.lineWidth = lineWidth },
    setGlobalAlpha(alpha) { ctx.globalAlpha = alpha },
    setLineCap(cap) { ctx.lineCap = cap },
    setLineJoin(join) { ctx.lineJoin = join },
    setFontSize(size) { fontSize = size; syncFont() },
    setFontWeight(weight) { fontWeight = weight || 700; syncFont() },
    setFont(font) { ctx.font = font },
    setTextBaseline(baseline) { ctx.textBaseline = baseline },
    setTextAlign(align) { ctx.textAlign = align },
    fillRect(x, y, w, h) { ctx.fillRect(x, y, w, h) },
    strokeRect(x, y, w, h) { ctx.strokeRect(x, y, w, h) },
    clearRect(x, y, w, h) { ctx.clearRect(x, y, w, h) },
    beginPath() { ctx.beginPath() },
    closePath() { ctx.closePath() },
    moveTo(x, y) { ctx.moveTo(x, y) },
    lineTo(x, y) { ctx.lineTo(x, y) },
    arc(cx, cy, r, start, end, anticlockwise) { ctx.arc(cx, cy, r, start, end, anticlockwise) },
    rect(x, y, w, h) { ctx.rect(x, y, w, h) },
    fill() { ctx.fill() },
    stroke() { ctx.stroke() },
    save() { ctx.save() },
    restore() { ctx.restore() },
    translate(x, y) { ctx.translate(x, y) },
    scale(x, y) { ctx.scale(x, y) },
    setLineDash(pattern) { if (ctx.setLineDash) ctx.setLineDash(pattern) },
    measureText(text) { syncFont(); return ctx.measureText(String(text)) },
    fillText(text, x, y, maxWidth) {
      syncFont()
      if (maxWidth === undefined) ctx.fillText(String(text), x, y)
      else ctx.fillText(String(text), x, y, maxWidth)
    },
    drawImage(imageResource, ...args) { ctx.drawImage(imageResource, ...args) },
    createLinearGradient(...args) { return ctx.createLinearGradient(...args) },
    // 旧 API 需要显式 draw；2D 画布是即时绘制的，这里只需要把回调交出去
    draw(reserve, callback) {
      if (typeof callback === 'function') callback()
    }
  }

  return { canvas, context, width: pixelWidth, height: pixelHeight }
}

// 导出成临时文件，失败返回空串（调用方负责提示）
function exportPainter(painter, destWidth, destHeight) {
  return new Promise(resolve => {
    if (!painter || !painter.canvas) {
      resolve('')
      return
    }
    wx.canvasToTempFilePath({
      canvas: painter.canvas,
      x: 0,
      y: 0,
      width: painter.width,
      height: painter.height,
      destWidth,
      destHeight,
      fileType: 'png',
      success: res => resolve(res.tempFilePath || ''),
      fail: () => resolve('')
    })
  })
}

// 2D 画布不能像旧版那样直接传图片路径，必须先用 canvas.createImage() 载成图片对象
let sharedImageCanvas = null
function imageCanvas() {
  if (!sharedImageCanvas) {
    sharedImageCanvas = wx.createOffscreenCanvas({ type: '2d', width: 1, height: 1 })
  }
  return sharedImageCanvas
}

function loadImage(src) {
  return new Promise(resolve => {
    if (!src) {
      resolve(null)
      return
    }
    const canvas = imageCanvas()
    if (!canvas || typeof canvas.createImage !== 'function') {
      resolve(null)
      return
    }
    const image = canvas.createImage()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function isSupported() {
  return typeof wx !== 'undefined' && typeof wx.createOffscreenCanvas === 'function'
}

module.exports = { createPainter, exportPainter, loadImage, isSupported }
