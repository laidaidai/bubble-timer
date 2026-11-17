const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const palette = require(path.join(ROOT, 'theme/palette.js'))
const wxssPath = path.join(ROOT, 'app.wxss')

const START = '/* THEME-TOKENS:START 由 theme/palette.js 生成，勿手改 */'
const END = '/* THEME-TOKENS:END */'

function blockFor(theme) {
  const selector = theme.key === 'cream' ? 'page, .theme-cream' : `.theme-${theme.key}`
  const vars = Object.keys(theme.css)
    .map(name => `  --${name}: ${theme.css[name]};`)
    .join('\n')
  return `${selector} {\n${vars}\n}`
}

const generated = [START, ...palette.map(blockFor), END].join('\n\n')
const current = fs.readFileSync(wxssPath, 'utf8')

if (current.includes(START)) {
  const next = current.slice(0, current.indexOf(START)) + generated + current.slice(current.indexOf(END) + END.length)
  fs.writeFileSync(wxssPath, next)
  console.log('app.wxss 主题变量已重新生成')
} else {
  console.log('未找到生成标记，跳过（首次接入请先手工插入标记）')
}
