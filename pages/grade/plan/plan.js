const themeBind = require('../utils/theme-bind.js');
const { getPaper, paperTimePlan } = require('../utils/data.js');
const store = require('../utils/store.js');

const DEFAULT_SLIDER_MAX = 60;
const MIN_MINUTES = 1;
const MAX_MINUTES = 600;

function clamp(value, min, max) {
  const n = Math.round(Number(value));
  if (!isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

Page({
  data: {
    theme: themeBind.themeData().theme,
    themeStyle: themeBind.themeData().themeStyle,
    isDesktop: false,
    paperId: '',
    paperName: '',
    paperTotal: 0,
    modules: [],
    totalMinutes: 0,
    canStart: false,
    isCustom: false,
    dirty: false,
    saveLabel: '保存方案',
    dragging: false,
    dragIndex: -1,
    dragStyle: '',
    dragStyles: [],
    settleIndex: -1,
    settleStyle: '',
  },

  onLoad(options) {
    themeBind.sync(this);
    const app = getApp();
    this.setData({ isDesktop: !!(app && app.globalData && app.globalData.isDesktop) });

    let paperId = (options && options.paperId) || '';
    try { paperId = decodeURIComponent(paperId); } catch (e) {}
    const found = getPaper(paperId);
    if (!found) {
      wx.showToast({ title: '试卷不存在', icon: 'none' });
      setTimeout(() => this.leavePage(), 420);
      return;
    }

    const base = paperTimePlan(found.paper, found.group.id) || [];
    if (!base.length) {
      wx.showToast({ title: '这套卷还没有可配时的模块', icon: 'none' });
      setTimeout(() => this.leavePage(), 420);
      return;
    }

    this._base = base.map((item) => ({
      key: item.key,
      name: item.name,
      count: item.count,
      start: item.start,
      end: item.end,
      targetMinutes: item.targetMinutes,
    }));
    this._baseKeys = this._base.map((item) => item.key);
    this._baseMinutes = {};
    this._base.forEach((item) => { this._baseMinutes[item.key] = item.targetMinutes; });

    const saved = store.getPaperTimerPlan(paperId);
    const savedOrder = this.normalizeOrder(store.getPaperTimerOrder(paperId), this._baseKeys);
    this._savedMinutes = saved;
    this._savedOrder = savedOrder.join('|') === this._baseKeys.join('|') ? [] : savedOrder;

    this._sliderMax = this._base.reduce((sum, item) => sum + item.targetMinutes, 0);
    this._sliderMax = Math.max(DEFAULT_SLIDER_MAX, this._sliderMax);
    Object.keys(saved).forEach((key) => {
      this._sliderMax = Math.max(this._sliderMax, saved[key]);
    });

    const byKey = {};
    this._base.forEach((item) => { byKey[item.key] = item; });
    const order = this._savedOrder.length ? this._savedOrder : this._baseKeys;
    const modules = order.map((key) => {
      const item = byKey[key];
      const savedMinutes = Number(saved[item.key]);
      return this.toModule(item, savedMinutes > 0 ? savedMinutes : item.targetMinutes);
    });

    const next = this.planState(modules);
    this.setData(Object.assign({
      paperId,
      paperName: found.paper.name,
      paperTotal: found.paper.total,
    }, next, {
      dragStyles: Array(next.modules.length).fill(''),
    }), () => this.measureSliders());
  },

  normalizeOrder(order, baseKeys) {
    const seen = {};
    const out = [];
    (Array.isArray(order) ? order : []).forEach((key) => {
      if (baseKeys.indexOf(key) >= 0 && !seen[key]) {
        seen[key] = true;
        out.push(key);
      }
    });
    return out.length === baseKeys.length ? out : baseKeys.slice();
  },

  onResize() {
    const app = getApp();
    if (app && app.detectEnvironment) app.detectEnvironment();
    this.setData({ isDesktop: !!(app && app.globalData && app.globalData.isDesktop) }, () => {
      this.measureSliders();
    });
  },

  onPageScroll(event) {
    this.pageScrollTop = Number(event && event.scrollTop) || 0;
  },

  onUnload() {
    clearTimeout(this.dragWatchdog);
    clearTimeout(this.settleTimer);
    clearTimeout(this.settleTimer2);
    clearTimeout(this._dragStyleTimer);
    clearTimeout(this._measureTimer);
    if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
  },

  toModule(source, minutes) {
    const safe = clamp(minutes, MIN_MINUTES, MAX_MINUTES);
    return {
      key: source.key,
      name: source.name,
      count: source.count,
      start: source.start,
      end: source.end,
      minutes: safe,
      input: String(safe),
    };
  },

  percent(minutes) {
    const max = Math.max(2, this._sliderMax || DEFAULT_SLIDER_MAX);
    const value = clamp(minutes, 0, MAX_MINUTES);
    if (!value) return 0;
    const ratio = (value - MIN_MINUTES) / (max - MIN_MINUTES);
    return Math.round(Math.min(1, Math.max(0, ratio)) * 1000) / 10;
  },

  planState(modules) {
    const views = modules.map((item) => Object.assign({}, item, {
      percent: this.percent(item.minutes),
    }));
    const totalMinutes = views.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
    const canStart = views.length > 0 && views.every((item) => {
      const minutes = Number(item.minutes);
      return isFinite(minutes) && minutes >= MIN_MINUTES && minutes <= MAX_MINUTES;
    });
    const orderChanged = views.some((item, index) => item.key !== this._baseKeys[index]) || views.length !== this._baseKeys.length;
    const isCustom = orderChanged || views.some((item) => item.minutes !== this._baseMinutes[item.key]);

    const savedKeys = Object.keys(this._savedMinutes || {});
    const referenceOrder = this._savedOrder && this._savedOrder.length ? this._savedOrder : this._baseKeys;
    const orderDirty = views.map((item) => item.key).join('|') !== referenceOrder.join('|');
    const minutesDirty = views.some((item) => {
      const saved = Number((this._savedMinutes || {})[item.key]);
      const reference = saved > 0 ? saved : this._baseMinutes[item.key];
      return item.minutes !== reference;
    });
    const dirty = minutesDirty || orderDirty;
    const hasSavedPlan = savedKeys.length > 0 || (this._savedOrder && this._savedOrder.length > 0);

    return {
      modules: views,
      totalMinutes,
      canStart,
      isCustom,
      dirty,
      saveLabel: dirty || !hasSavedPlan ? '保存方案' : '已保存',
    };
  },

  commit(modules) {
    const next = this.planState(modules);
    this.setData(next);
    this.syncLeaveAlert(next.dirty);
  },

  touchStart(event) {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    this.touchLastY = touch.clientY;
    this.dragCandidateIndex = Number(event.currentTarget.dataset.index);
    this.measureStride();
  },

  measureStride() {
    // 量卡片间距，让拖动位移换算成目标 index 时跟手。
    wx.createSelectorQuery().in(this).selectAll('.plan-card').boundingClientRect((rects) => {
      if (!Array.isArray(rects) || !rects.length) return;
      const tops = rects.filter((rect) => rect).map((rect) => rect.top);
      if (tops.length > 1) {
        const gaps = tops.slice(1).map((top, index) => Math.round(top - tops[index])).sort((a, b) => a - b);
        const median = gaps[Math.floor(gaps.length / 2)];
        const height = rects[0].height || median;
        if (median > 40 && Math.abs(median - height) < height) {
          this.dragStride = median;
          return;
        }
      }
      if (rects[0] && rects[0].height) this.dragStride = Math.round(rects[0].height + 14);
    }).exec();
  },

  handleTouchStart(event) {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    this.touchLastY = touch.clientY;
    this.measureStride();
    this.startDrag(Number(event.currentTarget.dataset.index), touch.clientY);
  },

  activateDrag(event) {
    if (this.dragActive) return;
    const index = this.dragCandidateIndex;
    if (index === undefined || index === null || index < 0) return;
    const touch = event.touches && event.touches[0];
    this.startDrag(index, touch ? touch.clientY : this.touchLastY);
  },

  startDrag(index, startY) {
    if (this.dragActive || index < 0 || index >= this.data.modules.length) return;
    clearTimeout(this.settleTimer);
    clearTimeout(this.settleTimer2);
    clearTimeout(this._dragStyleTimer);
    this.dragActive = true;
    this.dragOriginalIndex = index;
    this.dragTargetIndex = index;
    this.dragBaseY = startY;
    this.dragDelta = 0;
    this.dragHaptic = false;
    this.dragScrollTop = this.pageScrollTop || 0;
    clearTimeout(this.dragWatchdog);
    this.dragWatchdog = setTimeout(() => this.touchEnd(), 10000);
    this.setData({
      dragging: true,
      dragIndex: index,
      settleIndex: -1,
      settleStyle: '',
      dragStyle: 'transition: transform 0ms, box-shadow 140ms ease, background-color 140ms ease; transform: translateY(0px); z-index: 4;',
      dragStyles: Array(this.data.modules.length).fill(''),
    });
  },

  getStride() {
    if (this.dragStride && this.dragStride > 40) return this.dragStride;
    const windowWidth = (wx.getSystemInfoSync && wx.getSystemInfoSync().windowWidth) || 375;
    return Math.round(windowWidth * 214 / 750);
  },

  touchMove(event) {
    if (!this.dragActive) return;
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    if (this.dragScrollTop !== undefined && wx.pageScrollTo) {
      wx.pageScrollTo({ scrollTop: this.dragScrollTop, duration: 0 });
    }
    const stride = this.getStride();
    const length = this.data.modules.length;
    const originalIndex = this.dragOriginalIndex;
    const delta = touch.clientY - this.dragBaseY;
    const threshold = stride * 0.5;
    let targetIndex = this.dragTargetIndex;
    while (targetIndex < length - 1 && delta - (targetIndex - originalIndex) * stride > threshold) targetIndex += 1;
    while (targetIndex > 0 && delta - (targetIndex - originalIndex) * stride < -threshold) targetIndex -= 1;
    this.dragDelta = delta;
    this.dragTargetIndex = targetIndex;
    if (!this.dragHaptic && Math.abs(delta) > 12 && wx.vibrateShort) {
      this.dragHaptic = true;
      wx.vibrateShort({ type: 'light' });
    }
    const dragStyles = Array(length).fill('');
    if (targetIndex > originalIndex) {
      for (let index = originalIndex + 1; index <= targetIndex; index += 1) dragStyles[index] = `transform: translateY(${-stride}px)`;
    } else if (targetIndex < originalIndex) {
      for (let index = targetIndex; index < originalIndex; index += 1) dragStyles[index] = `transform: translateY(${stride}px)`;
    }
    this.setData({ dragStyles, dragStyle: `transition: transform 0ms; transform: translateY(${Math.round(delta)}px) scale(1.015); z-index: 4;` });
  },

  touchEnd() {
    if (!this.dragActive) return;
    this.dragActive = false;
    const fromIndex = this.dragOriginalIndex;
    const length = this.data.modules.length;
    const toIndex = Math.min(length - 1, Math.max(0, this.dragTargetIndex));
    clearTimeout(this.dragWatchdog);
    this.dragHaptic = false;
    if (toIndex === fromIndex && Math.abs(this.dragDelta || 0) < 8) {
      this.setData({
        dragging: false,
        dragIndex: -1,
        dragStyle: '',
        dragStyles: Array(length).fill(''),
        settleIndex: -1,
        settleStyle: '',
      });
      return;
    }
    const stride = this.getStride();
    const residual = Math.round(this.dragDelta - (toIndex - fromIndex) * stride);
    const modules = this.data.modules.slice();
    const [moved] = modules.splice(fromIndex, 1);
    modules.splice(toIndex, 0, moved);
    const next = this.planState(modules);
    const payload = Object.assign({}, next, {
      dragging: false,
      dragIndex: -1,
      dragStyle: '',
      dragStyles: Array(modules.length).fill('transition: transform 0ms; transform: translateY(0px)'),
      settleIndex: -1,
      settleStyle: '',
    });
    if (Math.abs(residual) > 2) {
      payload.settleIndex = toIndex;
      payload.settleStyle = `transition: transform 0ms; transform: translateY(${residual}px) scale(1.015); z-index: 4;`;
    }
    this.setData(payload, () => {
      this.syncLeaveAlert(next.dirty);
      this.measureSliders();
      const neutral = Array(modules.length).fill('');
      this._dragStyleTimer = setTimeout(() => this.setData({ dragStyles: neutral }), 16);
      if (payload.settleIndex < 0) return;
      clearTimeout(this.settleTimer);
      this.settleTimer = setTimeout(() => {
        this.setData({ settleStyle: 'transition: transform 180ms ease-out; transform: translateY(0px) scale(1); z-index: 4;' });
        this.settleTimer2 = setTimeout(() => this.setData({ settleIndex: -1, settleStyle: '' }), 220);
      }, 48);
    });
  },

  measureSliders() {
    clearTimeout(this._measureTimer);
    this._measureTimer = setTimeout(() => {
      wx.createSelectorQuery().in(this).selectAll('.plan-slider').boundingClientRect((rects) => {
        if (!Array.isArray(rects) || !rects.length) return;
        this.sliderRects = rects.map((rect) => (rect ? { left: rect.left, width: rect.width } : null));
      }).exec();
    }, 80);
  },

  startSlider(event) {
    const index = Number(event.currentTarget.dataset.index);
    const touch = event.touches && event.touches[0];
    if (!touch || !isFinite(index)) return;
    const cached = this.sliderRects && this.sliderRects[index];
    const gesture = {
      index,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      rect: cached && cached.width ? { left: cached.left, width: cached.width } : null,
      axis: null,
    };
    this.sliderGesture = gesture;
    this.dragCandidateIndex = -1;
    if (!gesture.rect) {
      wx.createSelectorQuery().in(this).select(`#plan-slider-${index}`).boundingClientRect((rect) => {
        if (!this.sliderGesture || this.sliderGesture !== gesture || !rect || !rect.width) return;
        gesture.rect = { left: rect.left, width: rect.width };
        if (this.sliderRects) this.sliderRects[index] = gesture.rect;
        if (gesture.axis === 'horizontal') this.applySlider(gesture.lastX);
      }).exec();
    }
  },

  moveSlider(event) {
    const gesture = this.sliderGesture;
    const touch = event.touches && event.touches[0];
    if (!gesture || !touch) return;
    gesture.lastX = touch.clientX;
    const dx = touch.clientX - gesture.startX;
    const dy = touch.clientY - gesture.startY;
    if (!gesture.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.05) {
        gesture.axis = 'vertical';
        return;
      }
      gesture.axis = 'horizontal';
    }
    if (gesture.axis !== 'horizontal' || !gesture.rect) return;
    this.applySlider(touch.clientX);
  },

  endSlider(event) {
    const gesture = this.sliderGesture;
    if (!gesture) return;
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch) gesture.lastX = touch.clientX;
    if (gesture.rect && (!gesture.axis || gesture.axis === 'horizontal')) {
      this.applySlider(gesture.lastX);
    }
    this.sliderGesture = null;
  },

  cancelSlider() {
    this.sliderGesture = null;
  },

  applySlider(clientX) {
    const gesture = this.sliderGesture;
    const rect = gesture && gesture.rect;
    if (!rect) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const minutes = Math.round(MIN_MINUTES + ratio * (this._sliderMax - MIN_MINUTES));
    const modules = this.data.modules.slice();
    const index = gesture.index;
    if (!modules[index] || Number(modules[index].minutes) === minutes) return;
    modules[index] = Object.assign({}, modules[index], {
      minutes,
      input: String(minutes),
    });
    this.commit(modules);
  },

  adjustMinutes(event) {
    const index = Number(event.currentTarget.dataset.index);
    const step = Number(event.currentTarget.dataset.step);
    const modules = this.data.modules.slice();
    if (!modules[index] || !isFinite(step)) return;
    const minutes = clamp((Number(modules[index].minutes) || 0) + step, MIN_MINUTES, MAX_MINUTES);
    modules[index] = Object.assign({}, modules[index], {
      minutes,
      input: String(minutes),
    });
    this.commit(modules);
  },

  onMinuteInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    const modules = this.data.modules.slice();
    if (!modules[index]) return;
    const raw = String(event.detail.value || '').replace(/[^\d]/g, '').slice(0, 3);
    const minutes = raw ? Math.min(MAX_MINUTES, Number(raw)) : 0;
    modules[index] = Object.assign({}, modules[index], {
      input: raw && Number(raw) > MAX_MINUTES ? String(MAX_MINUTES) : raw,
      minutes,
    });
    this.commit(modules);
  },

  onMinuteBlur(event) {
    const index = Number(event.currentTarget.dataset.index);
    const modules = this.data.modules.slice();
    if (!modules[index]) return;
    const minutes = clamp(event.detail.value || modules[index].minutes || MIN_MINUTES, MIN_MINUTES, MAX_MINUTES);
    modules[index] = Object.assign({}, modules[index], {
      minutes,
      input: String(minutes),
    });
    this.commit(modules);
  },

  resetDefault() {
    const modules = this._base.map((item) => this.toModule(item, item.targetMinutes));
    const next = this.planState(modules);
    this.setData(Object.assign({}, next, {
      dragging: false,
      dragIndex: -1,
      dragStyle: '',
      dragStyles: Array(modules.length).fill(''),
      settleIndex: -1,
      settleStyle: '',
    }));
    this.syncLeaveAlert(next.dirty);
  },

  persistPlan() {
    if (!this.data.paperId || !this.data.modules.length) return null;
    const modules = this.data.modules.map((item) => {
      const minutes = clamp(item.minutes, MIN_MINUTES, MAX_MINUTES);
      return Object.assign({}, item, { minutes, input: String(minutes) });
    });
    const keys = modules.map((item) => item.key);
    const orderChanged = keys.join('|') !== this._baseKeys.join('|');
    const minutesChanged = modules.some((item) => item.minutes !== this._baseMinutes[item.key]);
    const isDefault = !orderChanged && !minutesChanged;
    const minutesMap = {};
    modules.forEach((item) => {
      if (item.key) minutesMap[item.key] = item.minutes;
    });

    if (isDefault) {
      store.clearPaperTimerPlan(this.data.paperId);
    } else {
      store.savePaperTimerPlan(this.data.paperId, minutesChanged ? minutesMap : {});
      if (orderChanged) store.savePaperTimerOrder(this.data.paperId, keys);
      else store.clearPaperTimerOrder(this.data.paperId);
    }

    this._savedMinutes = !isDefault && minutesChanged ? minutesMap : {};
    this._savedOrder = !isDefault && orderChanged ? keys : [];
    const next = this.planState(modules);
    this.setData(next);
    this.syncLeaveAlert(false);
    return Object.assign({ isDefault }, next);
  },

  savePlan() {
    const saved = this.persistPlan();
    if (!saved) return;
    wx.showToast({
      title: saved.isDefault ? '已恢复默认配时' : '方案已保存',
      icon: saved.isDefault ? 'none' : 'success',
    });
  },

  startTiming() {
    if (!this.data.canStart) {
      wx.showToast({ title: '每个模块至少 1 分钟', icon: 'none' });
      return;
    }
    const saved = this.persistPlan();
    if (!saved) return;

    const found = getPaper(this.data.paperId);
    if (!found) {
      wx.showToast({ title: '试卷不存在', icon: 'none' });
      return;
    }

    const app = getApp();
    const modules = saved.modules.map((item, index) => ({
      id: `paper-${found.paper.id}-${item.key}-${index}`,
      name: item.name,
      targetMinutes: item.minutes,
      moduleKey: item.key,
      start: item.start,
      end: item.end,
      count: item.count,
    }));
    const ok = app.startTrainingSession && app.startTrainingSession(modules, 'countup', {
      source: 'grade',
      paperId: found.paper.id,
      paperName: found.paper.name,
      bankName: found.bank.name,
      groupName: found.group.name,
      total: found.paper.total,
      totalMinutes: saved.totalMinutes,
    });
    if (!ok) {
      wx.showToast({ title: '没有可计时的模块', icon: 'none' });
      return;
    }

    this.syncLeaveAlert(false);
    wx.redirectTo({
      url: '/pages/blank/blank?mode=enter',
      fail: () => wx.showToast({ title: '打开计时页失败，请重试', icon: 'none' }),
    });
  },

  syncLeaveAlert(dirty) {
    const state = !!dirty;
    if (this._leaveAlertState === state) return;
    this._leaveAlertState = state;
    if (state && wx.enableAlertBeforeUnload) {
      wx.enableAlertBeforeUnload({ message: '配时还没保存，离开会丢失本次调整' });
    }
    if (!state && wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload();
    }
  },

  goBack() {
    if (this.data.dirty) {
      wx.showModal({
        title: '还没保存',
        content: '离开会丢失这次配时调整，确定返回？',
        confirmText: '离开',
        cancelText: '继续调整',
        confirmColor: '#E8442F',
        success: (result) => {
          if (result.confirm) this.leavePage();
        },
      });
      return;
    }
    this.leavePage();
  },

  leavePage() {
    this.syncLeaveAlert(false);
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: '/pages/grade/index/index' }),
    });
  },
});
