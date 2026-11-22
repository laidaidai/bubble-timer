// 题库、模块划分、标准答案与选项统计的数据源
// 说明：标准答案默认由确定性规则生成，用户可在「答案导入」页为每套试卷粘贴导入真实答案覆盖。

// 模块定义库：key 全局唯一，name 展示名，short 答题卡浮窗简称，scored 是否计入总分
const MODULE_DEFS = {
  politics: { key: 'politics', name: '政治理论', short: '政治', scored: true },
  common: { key: 'common', name: '常识判断', short: '常识', scored: true },
  verbal: { key: 'verbal', name: '言语理解', short: '言语', scored: true },
  quant: { key: 'quant', name: '数量关系', short: '数量', scored: true },
  logic: { key: 'logic', name: '判断推理', short: '判断', scored: true },
  data: { key: 'data', name: '资料分析', short: '资料', scored: true },
  // 事业单位三类专有模块：B 类「综合分析」、D/E 类「策略选择」
  comprehensive: { key: 'comprehensive', name: '综合分析', short: '综合', scored: true },
  strategy: { key: 'strategy', name: '策略选择', short: '策略', scored: true },
  // 事业单位单招《公共基础知识》的模块：
  legal: { key: 'legal', name: '法律知识', short: '法律', scored: true },
  econ: { key: 'econ', name: '经济常识', short: '经济', scored: true },
  admin: { key: 'admin', name: '管理与公文', short: '公文', scored: true },
  science: { key: 'science', name: '科技人文', short: '科技', scored: true },
  current: { key: 'current', name: '时事省情', short: '时政', scored: true },
};

// 分值口径：每套试卷总分固定 100 分。
// layout 每段可写 points（该模块总分）或 per（每题分值），按「官方题型分值 / 机构通行估值」配置；
// 同一个 key 可拆多段（如判断推理的图形 / 定义 / 类比 / 逻辑各自不同分值），展示时自动合并成一个模块。
// 各卷的分值安排见 README「四、批改规则与数据口径」。

// 默认模块排布（卷子没写 layout 时兜底）：130 题，按国考地市级口径配 100 分。
// 官方只公布行测满分 100，不公布每题分值；这里用主流估算：
// 政治 0.5/题、常识 0.6、言语 0.8、数量 1.0、判断 0.77（图形8+定义7+类比3+逻辑9）、资料 1.0/题。
// 资料分析 20 题＝20 分，不再用 1.2 分/题去凑总分。
const DEFAULT_LAYOUT = [
  { key: 'politics', count: 20, points: 10 },
  { key: 'common', count: 15, points: 9 },
  { key: 'verbal', count: 30, points: 24 },
  { key: 'quant', count: 10, points: 10 },
  { key: 'logic', count: 35, points: 27 },
  { key: 'data', count: 20, points: 20 },
];

// 用户对预设卷的题量 / 分值覆盖：只存用户真正改过的卷，原题库保持只读。
// 结构 { [paperId]: { name, layout, updatedAt } }，存本地 storage。
const PAPER_OVERRIDE_KEY = 'xc_paper_overrides';
let overrideCache = null;

function readPaperOverrides() {
  if (overrideCache) return overrideCache;
  try {
    if (typeof wx === 'undefined') {
      overrideCache = {};
      return overrideCache;
    }
    const raw = wx.getStorageSync(PAPER_OVERRIDE_KEY);
    overrideCache = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch (e) {
    overrideCache = {};
  }
  return overrideCache;
}

function savePaperOverride(paperId, patch) {
  if (!paperId || !patch) return;
  const all = Object.assign({}, readPaperOverrides());
  all[paperId] = Object.assign({}, all[paperId], patch, { updatedAt: Date.now() });
  overrideCache = all;
  try {
    if (typeof wx !== 'undefined') wx.setStorageSync(PAPER_OVERRIDE_KEY, all);
  } catch (e) {}
}

function clearPaperOverride(paperId) {
  if (!paperId) return;
  const all = Object.assign({}, readPaperOverrides());
  delete all[paperId];
  overrideCache = all;
  try {
    if (typeof wx !== 'undefined') wx.setStorageSync(PAPER_OVERRIDE_KEY, all);
  } catch (e) {}
}

// 把用户改过的题量 / 分值套到预设卷上；total 由 layout 重新累加，
// 这样卷面题号、答题卡、交卷算分都跟着新题量走。
function effectivePaper(paper) {
  if (!paper) return paper;
  const override = readPaperOverrides()[paper.id];
  if (!override || !Array.isArray(override.layout) || !override.layout.length) return paper;
  const layout = override.layout.map((seg) => Object.assign({}, seg));
  const total = layout.reduce((sum, seg) => sum + (Number(seg.count) || 0), 0);
  return Object.assign({}, paper, {
    name: String(override.name || paper.name),
    layout: layout,
    total: total,
    edited: true,
  });
}


// 这里仅保留五维核心模块常量供旧引用兜底（含政治理论的卷实际是六维）
const RADAR_KEYS = ['common', 'verbal', 'quant', 'logic', 'data'];

const OPTIONS = ['A', 'B', 'C', 'D'];

// 确定性伪随机（保证每次进入 mock 数据稳定）

// 默认标准答案
function defaultAnswer(qNo) {
  return OPTIONS[(qNo * 7 + 3) % 4];
}

// 生成一套试卷的默认标准答案数组（下标 0 对应第 1 题）

// 每题选项选择人数 / 占比（mock，确定性）

function filterLevel(filter) {
  if (filter === 'g60') return 1;
  if (filter === 'g70') return 2;
  if (filter === 'g80') return 3;
  return 0;
}


// 模块定义：标准模块查 MODULE_DEFS；自定义卷自建模块（key 不在表内）用段上的 name 兜底，
// 让「添加模块」能加任意名字的板块，而不是只能从预设里挑
function segDef(seg) {
  const def = MODULE_DEFS[seg.key];
  if (def) return def;
  const name = String(seg.name || '').trim();
  if (!name) return null;
  return { key: seg.key, name: name, short: name.slice(0, 2), scored: true };
}

// 按试卷 layout 计算各模块题号区间与分值
// 返回 [{ key, name, short, scored, start, end, count, points, parts }]
// 同一模块拆成多段（判断推理的四种题型）时，相邻同 key 段自动合并成一个模块；
// parts 保留每个小节的题号区间和独立分值，供自定义编辑和细分展示；
// points = 该模块总分，per = 每题平均分值（展示用，实际按每题 points/count 精确累加）
function paperModules(paper) {
  const layout = (paper && paper.layout) || DEFAULT_LAYOUT;
  const mods = [];
  let cursor = 1;
  for (let i = 0; i < layout.length; i++) {
    const seg = layout[i];
    const def = segDef(seg);
    if (!def || !seg.count) continue;
    const segPoints = segPointsOf(seg);
    const start = cursor;
    const end = cursor + seg.count - 1;
    // 自定义卷可以给模块改名：显示名取段上的 name，没填就用标准名
    const customName = String(seg.name || '').trim();
    const displayName = customName || def.name;
    const displayShort = customName ? customName.slice(0, 2) : def.short;
    const part = {
      key: def.key,
      label: String(seg.section || '').trim(),
      start: start,
      end: end,
      count: seg.count,
      points: segPoints,
      per: seg.count ? round2(segPoints / seg.count) : 0,
    };
    const last = mods[mods.length - 1];
    // 相邻同模块的细分段合并，避免结果页出现两张「判断推理」卡
    if (last && last.key === def.key && last.end === start - 1) {
      last.end = end;
      last.count += seg.count;
      last.points = round2(last.points + segPoints);
      last.parts.push(part);
    } else {
      mods.push(Object.assign({}, def, {
        name: displayName,
        short: displayShort,
        start: start,
        end: end,
        count: seg.count,
        points: segPoints,
        parts: [part],
      }));
    }
    cursor += seg.count;
  }
  for (let j = 0; j < mods.length; j++) {
    mods[j].per = mods[j].count ? round2(mods[j].points / mods[j].count) : 0;
  }
  return mods;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

// 单段分值：优先 points，其次 per × 题量
function segPointsOf(seg) {
  if (typeof seg.points === 'number') return seg.points;
  if (typeof seg.per === 'number') return round2(seg.per * seg.count);
  return 0;
}

// 每题分值表：下标 0 对应第 1 题
// 用于批改时按真实分值累加，不再按正确率等分
function questionPoints(paper) {
  const layout = (paper && paper.layout) || DEFAULT_LAYOUT;
  const size = paperSize(paper);
  const list = [];
  for (let i = 0; i < size; i++) list.push(0);
  let cursor = 0;
  for (let i = 0; i < layout.length; i++) {
    const seg = layout[i];
    if (!segDef(seg) || !seg.count) continue;
    const per = segPointsOf(seg) / seg.count;
    for (let k = 0; k < seg.count; k++) {
      const idx = cursor + k;
      if (idx < size) list[idx] = per;
    }
    cursor += seg.count;
  }
  return list;
}

// 试卷满分：各计分模块分值之和（正常为 100）
function paperScoreTotal(paper) {
  const mods = paperModules(paper);
  let sum = 0;
  for (let i = 0; i < mods.length; i++) {
    if (mods[i].scored) sum += mods[i].points;
  }
  return round2(sum);
}

// 兼容旧引用：默认排布下的模块区间
const MODULES = paperModules({ layout: DEFAULT_LAYOUT });

// 题库结构：bank -> group -> papers
// 【模板配置区】当前为通用示例试卷，不绑定任何外部题库品牌；
// 接入真实数据时，在此替换或新增试卷即可。
// 试卷字段：
//   id(全局唯一) / name(试卷名称) / total(题量)
//   layout: [{ key, count }] 模块排布，key 取自 MODULE_DEFS；数组顺序即卷面章节顺序
//   lastScore(上次得分，无则填 null)
const BANKS = [
  {
    id: 'bank-a',
    name: '标准真题卷',
    tag: '真题',
    groups: [
      {
        id: 'group-a1',
        name: '国家公务员考试（国考）',
        papers: [
          {
            id: 'paper-gk-fs',
            name: '国考 · 副省级卷',
            total: 135,
            lastScore: null,
            layout: [
              // 135 题满分 100（抖音分值表）：政治 20×0.5=10、常识 15×0.5=7.5、
              // 言语 30×0.8=24、数量 15×1=15、判断 23.5、资料 20×1=20
              { key: 'politics', count: 20, per: 0.5 },
              { key: 'common', count: 15, per: 0.5 },
              { key: 'verbal', count: 30, per: 0.8 },
              { key: 'quant', count: 15, per: 1 },
              { key: 'logic', count: 10, per: 0.6 },
              { key: 'logic', count: 10, per: 0.7 },
              { key: 'logic', count: 5, per: 0.5 },
              { key: 'logic', count: 10, per: 0.8 },
              { key: 'data', count: 20, per: 1 },
            ],
          },
          {
            id: 'paper-gk-ds',
            name: '国考 · 地市级卷',
            total: 130,
            lastScore: null,
            // 130 题满分 100，按主流每题估值：政治 0.5、常识 0.6、言语 0.8、
            // 数量 1、判断（图形 0.8 / 定义 0.7 / 类比 0.6 / 逻辑 0.9）、资料 1
            layout: [
              { key: 'politics', count: 20, per: 0.5 },
              { key: 'common', count: 15, per: 0.6 },
              { key: 'verbal', count: 30, per: 0.8 },
              { key: 'quant', count: 10, per: 1 },
              { key: 'logic', count: 10, per: 0.8 },
              { key: 'logic', count: 10, per: 0.7 },
              { key: 'logic', count: 5, per: 0.6 },
              { key: 'logic', count: 10, per: 0.9 },
              { key: 'data', count: 20, per: 1 },
            ],
          },
          {
            id: 'paper-gk-zf',
            name: '国考 · 行政执法类卷',
            total: 130,
            lastScore: null,
            // 题量与地市级一致，按同一套分值口径
            layout: [
              { key: 'politics', count: 20, per: 0.5 },
              { key: 'common', count: 15, per: 0.6 },
              { key: 'verbal', count: 30, per: 0.8 },
              { key: 'quant', count: 10, per: 1 },
              { key: 'logic', count: 10, per: 0.8 },
              { key: 'logic', count: 10, per: 0.7 },
              { key: 'logic', count: 5, per: 0.6 },
              { key: 'logic', count: 10, per: 0.9 },
              { key: 'data', count: 20, per: 1 },
            ],
          },
        ],
      },
      {
        id: 'group-a2',
        name: '多省联考（3 月大联考）',
        papers: [
          {
            id: 'paper-hn',
            name: '河南省考卷',
            total: 120,
            lastScore: null,
            // 河南 2025：120 题满分 100（抖音 @雨菲老师 按粉笔近两年真题整理）：
            // 政治 15×0.8、常识 15×0.8、言语 30×0.8、数量 15×1、
            // 判断 30 题 22 分（图推 10×0.7 / 定义 5×0.6 / 类比 5×0.6 / 逻辑 10×0.9）、资料 15×1
            layout: [
              { key: 'verbal', count: 30, per: 0.8 },
              { key: 'quant', count: 15, per: 1 },
              { key: 'logic', count: 30, points: 22 },
              { key: 'politics', count: 15, per: 0.8 },
              { key: 'common', count: 15, per: 0.8 },
              { key: 'data', count: 15, per: 1 },
            ],
          },
          {
            id: 'paper-hb',
            name: '湖北省考卷',
            total: 125,
            lastScore: null,
            // 湖北 2025：125 题满分 100（抖音多条视频用 3 万多份成绩反推，每题 0.8 分，
            // 125×0.8=100）：政治 12、常识 8、言语 24、数量 12、判断 28、资料 16
            layout: [
              { key: 'politics', count: 15, per: 0.8 },
              { key: 'common', count: 10, per: 0.8 },
              { key: 'verbal', count: 30, per: 0.8 },
              { key: 'quant', count: 15, per: 0.8 },
              { key: 'logic', count: 35, per: 0.8 },
              { key: 'data', count: 20, per: 0.8 },
            ],
          },
          {
            id: 'paper-jx',
            name: '江西省考卷',
            total: 130,
            lastScore: null,
            // 江西 2026 抖音口径：130 题（数量从 15 减到 10），满分 100：
            // 政治 20×0.6、常识 15×0.6、言语 30×0.8、数量 10×0.8、
            // 判断 35 题 27 分、资料 20×1
            layout: [
              { key: 'politics', count: 20, per: 0.6 },
              { key: 'common', count: 15, per: 0.6 },
              { key: 'verbal', count: 30, per: 0.8 },
              { key: 'quant', count: 10, per: 0.8 },
              { key: 'logic', count: 35, points: 27 },
              { key: 'data', count: 20, per: 1 },
            ],
          },
        ],
      },
      {
        id: 'group-a3',
        name: '小联考（12 月·自主命题）',
        papers: [
          {
            id: 'paper-sd',
            name: '山东省考卷',
            total: 120,
            lastScore: null,
            // 山东 120 题满分 100：政治/常识 0.7、言语 0.8、数量 1.0、
            // 判断（图形 0.6 / 定义 0.8 / 类比 0.6 / 逻辑 1.0）、资料 1.0
            layout: [
              { key: 'politics', count: 10, per: 0.7 },
              { key: 'common', count: 10, per: 0.7 },
              { key: 'verbal', count: 30, per: 0.8 },
              { key: 'quant', count: 10, per: 1 },
              { key: 'logic', count: 5, per: 0.6 },
              { key: 'logic', count: 10, per: 0.8 },
              { key: 'logic', count: 10, per: 0.6 },
              { key: 'logic', count: 15, per: 1 },
              { key: 'data', count: 20, per: 1 },
            ],
          },
          {
            id: 'paper-zj',
            name: '浙江省考卷（A 卷）',
            total: 120,
            lastScore: null,
            // 浙江 2026 A 卷（抖音口径）：120 题、均分制，满分 100：
            // 政治 10、常识 10、言语 25、数量 20、判断 40、资料 15
            layout: [
              { key: 'politics', count: 10, points: 8.34 },
              { key: 'common', count: 10, points: 8.33 },
              { key: 'verbal', count: 25, points: 20.83 },
              { key: 'quant', count: 20, points: 16.67 },
              { key: 'logic', count: 40, points: 33.33 },
              { key: 'data', count: 15, points: 12.5 },
            ],
          },
          {
            id: 'paper-js',
            name: '江苏省考卷（A 类）',
            total: 135,
            lastScore: null,
            // 江苏 A 类 135 题满分 100：政治 0.8、常识 0.6、言语 23 分、数量 0.8、判断 0.6、资料 1.0
            layout: [
              { key: 'politics', count: 10, per: 0.8 },
              { key: 'common', count: 10, per: 0.6 },
              { key: 'verbal', count: 30, points: 23 },
              { key: 'quant', count: 20, per: 0.8 },
              { key: 'logic', count: 45, per: 0.6 },
              { key: 'data', count: 20, per: 1 },
            ],
          },
          {
            id: 'paper-gd',
            name: '广东省考卷',
            total: 90,
            lastScore: null,
            // 广东 2025 起 90 题满分 100：政治 10、常识 5、言语 15、数量 15、
            // 判断 25 题 30 分、资料 20 题 25 分（旧版 100 题分值已不适用）
            layout: [
              { key: 'politics', count: 10, per: 1 },
              { key: 'common', count: 5, per: 1 },
              { key: 'verbal', count: 15, per: 1 },
              { key: 'quant', count: 15, per: 1 },
              { key: 'logic', count: 25, points: 30 },
              { key: 'data', count: 20, points: 25 },
            ],
          },
          {
            id: 'paper-sc',
            name: '四川省考卷',
            total: 100,
            lastScore: null,
            // 四川 100 题满分 100，每题 1 分
            layout: [
              { key: 'politics', count: 10, per: 1 },
              { key: 'common', count: 10, per: 1 },
              { key: 'verbal', count: 25, per: 1 },
              { key: 'quant', count: 10, per: 1 },
              { key: 'logic', count: 30, per: 1 },
              { key: 'data', count: 15, per: 1 },
            ],
          },
        ],
      },
      {
        id: 'group-a4',
        name: '事业单位联考（职测）',
        papers: [
          {
            id: 'paper-sydw-a',
            name: '事业单位联考 · A 类（综合管理）',
            total: 100,
            lastScore: null,
            // 卷面参照 2025 年 10 月 25 日联考职测 A 类（总分 150）：
            // 常识 20×1 / 言语 25×1.6 / 数量 5×2 / 判断 35 题 / 资料 15×2，
            // 按模块权重折算到本站统一的 100 分制
            layout: [
              { key: 'common', count: 20, points: 13.3 },
              { key: 'verbal', count: 25, points: 26.7 },
              { key: 'quant', count: 5, points: 6.7 },
              { key: 'logic', count: 35, points: 33.3 },
              { key: 'data', count: 15, points: 20 },
            ],
          },
          {
            id: 'paper-sydw-b',
            name: '事业单位联考 · B 类（社科专技）',
            total: 100,
            lastScore: null,
            // B 类职测：常识 20 / 言语 25 / 数量 5 / 判断 35 / 资料 10 / 综合分析 5，
            // 150 分口径折算 100（资料 20 分、综合 7.5 分，其余同 A 类题型分值）
            layout: [
              { key: 'common', count: 20, points: 13.6 },
              { key: 'verbal', count: 25, points: 27.1 },
              { key: 'quant', count: 5, points: 6.8 },
              { key: 'logic', count: 35, points: 33.9 },
              { key: 'data', count: 10, points: 13.6 },
              { key: 'comprehensive', count: 5, points: 5 },
            ],
          },
          {
            id: 'paper-sydw-c',
            name: '事业单位联考 · C 类（自然科学专技）',
            total: 100,
            lastScore: null,
            // C 类职测：常识 20 / 言语 25 / 数量 5 / 判断 30（1.5 分/题）/
            // 资料 10×2 / 综合分析 10×1.5，150 分口径折算 100
            layout: [
              { key: 'common', count: 20, points: 13.3 },
              { key: 'verbal', count: 25, points: 26.7 },
              { key: 'quant', count: 5, points: 6.7 },
              { key: 'logic', count: 30, points: 30 },
              { key: 'data', count: 10, points: 13.3 },
              { key: 'comprehensive', count: 10, points: 10 },
            ],
          },
          {
            id: 'paper-sydw-d',
            name: '事业单位联考 · D 类（中小学教师）',
            total: 100,
            lastScore: null,
            // D 类职测：常识 20 / 言语 25 / 数量分析（数学运算 5 + 资料 10）/
            // 判断 30 / 策略选择 10，150 分口径折算 100
            layout: [
              { key: 'common', count: 20, points: 13.3 },
              { key: 'verbal', count: 25, points: 26.7 },
              { key: 'quant', count: 5, points: 6.7 },
              { key: 'data', count: 10, points: 13.3 },
              { key: 'logic', count: 30, points: 30 },
              { key: 'strategy', count: 10, points: 10 },
            ],
          },
          {
            id: 'paper-sydw-e',
            name: '事业单位联考 · E 类（医疗卫生）',
            total: 100,
            lastScore: null,
            // E 类职测：常识 20 / 言语 20 / 数量分析 15 / 判断 30 / 策略选择 15，
            // 150 分口径折算 100
            layout: [
              { key: 'common', count: 20, points: 13.3 },
              { key: 'verbal', count: 20, points: 20 },
              { key: 'quant', count: 5, points: 6.7 },
              { key: 'data', count: 10, points: 13.3 },
              { key: 'logic', count: 30, points: 26.7 },
              { key: 'strategy', count: 15, points: 20 },
            ],
          },
        ],
      },
      {
        id: 'group-a5',
        name: '事业单位单招',
        papers: [
          {
            id: 'paper-sydw-gj',
            name: '事业单位单招 · 公共基础知识',
            total: 100,
            lastScore: null,
            // 单招公基常见卷面：100 题、每题 1 分，模块按大纲知识块分布
            layout: [
              { key: 'politics', count: 30, per: 1 },
              { key: 'legal', count: 25, per: 1 },
              { key: 'econ', count: 15, per: 1 },
              { key: 'admin', count: 10, per: 1 },
              { key: 'science', count: 12, per: 1 },
              { key: 'current', count: 8, per: 1 },
            ],
          },
        ],
      },
      {
        id: 'group-a6',
        name: '选调生',
        papers: [
          {
            id: 'paper-xd',
            name: '选调生 · 行测通用卷',
            total: 100,
            lastScore: null,
            // 选调生各省题量不一（多与省考同卷或 90–100 题自主命题），
            // 这里给一版 100 题、每题 1 分的通用行测卷，便于按卷面答案直接批改
            layout: [
              { key: 'politics', count: 10, per: 1 },
              { key: 'common', count: 10, per: 1 },
              { key: 'verbal', count: 25, per: 1 },
              { key: 'quant', count: 10, per: 1 },
              { key: 'logic', count: 30, per: 1 },
              { key: 'data', count: 15, per: 1 },
            ],
          },
        ],
      },
    ],
  },
];

function getPaper(paperId) {
  for (let bi = 0; bi < BANKS.length; bi++) {
    const bank = BANKS[bi];
    for (let gi = 0; gi < bank.groups.length; gi++) {
      const g = bank.groups[gi];
      const p = g.papers.find((x) => x.id === paperId);
      if (p) return { bank: bank, group: g, paper: effectivePaper(p) };
    }
  }
  return null;
}

function moduleOfQuestion(qNo, paper) {
  const mods = paper ? paperModules(paper) : MODULES;
  for (let i = 0; i < mods.length; i++) {
    if (qNo >= mods[i].start && qNo <= mods[i].end) return mods[i];
  }
  return null;
}

// 试卷总题量
function paperSize(paper) {
  return paper.total;
}

module.exports = {
  MODULE_DEFS,
  MODULES,
  RADAR_KEYS,
  OPTIONS,
  BANKS,
  getPaper,
  effectivePaper,
  readPaperOverrides,
  savePaperOverride,
  clearPaperOverride,
  paperModules,
  moduleOfQuestion,
  paperSize,
  questionPoints,
  paperScoreTotal,
};
