// 海报绘制的通用小工具：圆角卡片、进度环、文本截断

function roundRect(ctx, x, y, w, h, r, color) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arc(x + w - radius, y + radius, radius, -Math.PI / 2, 0)
  ctx.arc(x + w - radius, y + h - radius, radius, 0, Math.PI / 2)
  ctx.arc(x + radius, y + h - radius, radius, Math.PI / 2, Math.PI)
  ctx.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5)
  ctx.closePath()
  ctx.setFillStyle(color)
  ctx.fill()
}

function stickerCard(ctx, x, y, w, h, r, bg, edge, shadow, offset) {
  const gap = offset === undefined ? 6 : offset
  const border = 3
  roundRect(ctx, x + gap, y + gap, w, h, r, shadow)
  roundRect(ctx, x, y, w, h, r, edge)
  roundRect(ctx, x + border, y + border, w - border * 2, h - border * 2, Math.max(0, r - border), bg)
}

function stickerPill(ctx, x, y, w, h, bg, edge, text, color, fontSize) {
  roundRect(ctx, x, y, w, h, h / 2, edge)
  roundRect(ctx, x + 3, y + 3, w - 6, h - 6, (h - 6) / 2, bg)
  if (text) {
    ctx.setFillStyle(color)
    ctx.setFontSize(fontSize || 17)
    const tw = ctx.measureText(text).width
    ctx.fillText(text, x + (w - tw) / 2, y + h / 2 + (fontSize || 17) * .35)
  }
}

function circle(ctx, cx, cy, r, color) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.setFillStyle(color)
  ctx.fill()
}

function ring(ctx, cx, cy, r, percent, trackColor, fillColor, lineWidth) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0))
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.setStrokeStyle(trackColor)
  ctx.setLineWidth(lineWidth)
  ctx.stroke()

  if (value > 0) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * value / 100)
    ctx.setStrokeStyle(fillColor)
    ctx.setLineWidth(lineWidth)
    ctx.stroke()
  }
}

function fitText(ctx, text, maxWidth) {
  const source = String(text || '')
  if (ctx.measureText(source).width <= maxWidth) return source
  let result = source
  while (result.length > 1 && ctx.measureText(result + '…').width > maxWidth) {
    result = result.slice(0, -1)
  }
  return result + '…'
}

module.exports = { roundRect, stickerCard, stickerPill, circle, ring, fitText }
