// 批改页跟随主程序当前主题：页面根节点拿 theme 类 + 自定义主题的内联变量。
// 内置主题靠 .theme-* 类，自定义主题靠 app.getThemeStyle() 返回的 style。
function themeData() {
  const app = typeof getApp === 'function' ? getApp() : null;
  const theme = (app && app.getTheme && app.getTheme()) || { key: 'sky', style: '' };
  return {
    theme: theme.key || 'sky',
    themeStyle: (app && app.getThemeStyle && app.getThemeStyle()) || theme.style || '',
  };
}

function sync(page) {
  const app = typeof getApp === 'function' ? getApp() : null;
  if (app && app.applyNavBar) app.applyNavBar();
  if (!page || !page.setData) return;
  page.setData(themeData());
}

module.exports = { themeData, sync };
