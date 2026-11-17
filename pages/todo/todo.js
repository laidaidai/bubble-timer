const app = getApp()

const REMIND_OPTIONS = [
  { key: 0, label: '不提醒' },
  { key: 10, label: '提前 10 分钟' },
  { key: 30, label: '提前 30 分钟' },
  { key: 60, label: '提前 1 小时' }
]

const { pad, dateKey, timeKey } = require('../../utils/format')

function parseDue(dateText, timeText) {
  if (!dateText) return 0
  const parts = dateText.split('-').map(Number)
  const clock = (timeText || '23:59').split(':').map(Number)
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1, clock[0] || 0, clock[1] || 0, 0).getTime()
}

function dueLabel(dueAt) {
  if (!dueAt) return ''
  const now = Date.now()
  const target = new Date(dueAt)
  const today = dateKey(new Date())
  const tomorrow = dateKey(new Date(now + 24 * 3600 * 1000))
  const dayText = dateKey(target) === today ? '今天' : dateKey(target) === tomorrow ? '明天' : `${target.getMonth() + 1}月${target.getDate()}日`
  return `${dayText} ${pad(target.getHours())}:${pad(target.getMinutes())}`
}

Page({
  data: {
    theme: 'cream',
    todos: [],
    total: 0,
    doneCount: 0,
    percent: 0,
    inputValue: '',
    focus: false,
    dueDate: '',
    dueTime: '',
    remindOptions: REMIND_OPTIONS,
    remindBefore: 0,
    remindLabel: '不提醒',
    dueHint: ''
  },

  onLoad() {
    const theme = app.getTheme ? app.getTheme() : { key: 'cream' }
    const now = new Date()
    const next = new Date(now.getTime() + 60 * 60 * 1000)
    this.setData({ theme: theme.key, dueDate: dateKey(next), dueTime: timeKey(next) })
    if (app.applyNavBar) app.applyNavBar()
    this.loadTodos()
  },

  onShow() {
    this.checkReminders()
    clearInterval(this.timer)
    this.timer = setInterval(() => this.checkReminders(), 30000)
  },

  onHide() {
    clearInterval(this.timer)
    this.timer = null
  },

  onUnload() {
    clearInterval(this.timer)
    this.timer = null
  },

  loadTodos() {
    const todos = wx.getStorageSync(app.globalData.todoKey) || []
    this.setTodos(todos)
    this.checkReminders()
  },

  setTodos(todos) {
    const total = todos.length
    const doneCount = todos.filter(item => item.done).length
    const list = todos.map(item => ({
      ...item,
      dueText: dueLabel(item.dueAt),
      overdue: !!item.dueAt && !item.done && item.dueAt < Date.now(),
      remindText: item.remindBefore ? `提前 ${item.remindBefore >= 60 ? `${item.remindBefore / 60} 小时` : `${item.remindBefore} 分钟`}` : ''
    }))
    this.setData({
      todos: list,
      total,
      doneCount,
      percent: total ? Math.round(doneCount / total * 100) : 0
    })
    wx.setStorageSync(app.globalData.todoKey, list.map(({ dueText, overdue, remindText, ...rest }) => rest))
  },

  onInput(event) {
    this.setData({ inputValue: event.detail.value })
  },

  onDateChange(event) {
    this.setData({ dueDate: event.detail.value })
  },

  onTimeChange(event) {
    this.setData({ dueTime: event.detail.value })
  },

  setRemind(event) {
    const key = Number(event.currentTarget.dataset.key)
    const option = REMIND_OPTIONS.find(item => item.key === key)
    this.setData({ remindBefore: key, remindLabel: option ? option.label : '不提醒' })
  },

  addTodo() {
    const text = (this.data.inputValue || '').trim()
    if (!text) {
      wx.showToast({ title: '先写点内容', icon: 'none' })
      return
    }
    const dueAt = parseDue(this.data.dueDate, this.data.dueTime)
    const todo = {
      id: `t-${Date.now()}`,
      text,
      done: false,
      createdAt: Date.now(),
      dueAt,
      remindBefore: this.data.remindBefore,
      notified: false
    }
    const todos = this.data.todos.map(({ dueText, overdue, remindText, ...rest }) => rest).concat([todo])
    this.setData({ inputValue: '' })
    this.setTodos(todos)
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
    if (this.data.remindBefore > 0) this.requestSubscribe(todo)
  },

  requestSubscribe(todo) {
    const tmplId = app.globalData.notifyTmplId
    if (!tmplId || !wx.requestSubscribeMessage) return
    wx.requestSubscribeMessage({
      tmplIds: [tmplId],
      success: ({ [tmplId]: status }) => {
        wx.showToast({ title: status === 'accept' ? '已授权，到点在小程序内提醒' : '未授权，仅在本页提醒', icon: 'none' })
      },
      fail: () => wx.showToast({ title: '订阅失败，可稍后再试', icon: 'none' })
    })
  },

  checkReminders() {
    const todos = (this.data.todos || []).filter(item => item.dueAt && !item.done)
    if (!todos.length) return
    const now = Date.now()
    const due = todos.find(item => !item.notified && now >= item.dueAt - (item.remindBefore || 0) * 60000 && now <= item.dueAt + 30 * 60000)
    if (!due) return
    const marked = this.data.todos.map(item => (item.id === due.id ? { ...item, notified: true } : item))
    this.setTodos(marked.map(({ dueText, overdue, remindText, ...rest }) => rest))
    if (wx.vibrateLong) wx.vibrateLong({ fail: () => {} })
    wx.showModal({
      title: due.dueAt <= now ? '待办已到时间' : '待办快到时间',
      content: `${due.text}\n计划时间 ${dueLabel(due.dueAt)}`,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  toggleTodo(event) {
    const id = event.currentTarget.dataset.id
    const todos = this.data.todos.map(item => (item.id === id ? { ...item, done: !item.done } : item))
    this.setTodos(todos.map(({ dueText, overdue, remindText, ...rest }) => rest))
    const target = todos.find(item => item.id === id)
    if (target && target.done) {
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
      if (todos.every(item => item.done) && todos.length > 1) {
        wx.showToast({ title: '今天的清单清空了', icon: 'none' })
      }
    }
  },

  removeTodo(event) {
    const id = event.currentTarget.dataset.id
    const target = this.data.todos.find(item => item.id === id)
    if (!target) return
    wx.showModal({
      title: '删除这条待办？',
      content: target.text,
      confirmText: '删除',
      confirmColor: '#E8442F',
      success: ({ confirm }) => {
        if (!confirm) return
        const kept = this.data.todos.filter(item => item.id !== id).map(({ dueText, overdue, remindText, ...rest }) => rest)
        this.setTodos(kept)
      }
    })
  },

  clearDone() {
    if (!this.data.doneCount) {
      wx.showToast({ title: '还没有已完成的', icon: 'none' })
      return
    }
    wx.showModal({
      title: '清空已完成？',
      content: `将移除 ${this.data.doneCount} 条已完成的待办`,
      confirmText: '清空',
      confirmColor: '#E8442F',
      success: ({ confirm }) => {
        if (!confirm) return
        this.setTodos(this.data.todos.filter(item => !item.done).map(({ dueText, overdue, remindText, ...rest }) => rest))
        wx.showToast({ title: '已清空', icon: 'none' })
      }
    })
  },

  pushReminder() {
    const tmplId = app.globalData.notifyTmplId
    if (!tmplId || !wx.requestSubscribeMessage) {
      wx.showModal({ title: '订阅消息暂不可用', content: '当前环境不支持订阅消息，请在小程序内使用待办提醒。', showCancel: false, confirmText: '知道了' })
      return
    }
    wx.requestSubscribeMessage({
      tmplIds: [tmplId],
      success: ({ [tmplId]: status }) => {
        wx.showToast({ title: status === 'accept' ? '已授权提醒' : '未授权，可稍后再试', icon: 'none' })
      },
      fail: () => wx.showToast({ title: '订阅失败', icon: 'none' })
    })
  },

  handleBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else wx.reLaunch({ url: '/pages/index/index' })
  }
})
