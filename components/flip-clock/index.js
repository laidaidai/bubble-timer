// 翻页时钟：纯展示组件，由页面把主时间字符串切好按位传入。
// cells 每位 { key, text, sep }，msCells 是毫秒两位。
// 设计目标：页面只关心「要显示什么」，不关心翻页怎么动。
Component({
  properties: {
    cells: { type: Array, value: [] },
    msCells: { type: Array, value: [] },
    msShow: { type: Boolean, value: false },
    flipPhase: { type: Boolean, value: false },
    compact: { type: Boolean, value: false }
  }
})