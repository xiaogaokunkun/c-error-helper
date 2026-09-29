// 空驱动扩展：只为让 --extensionTestsPath 能挂上去跑。真正被测的是“已安装”的 c-error-helper。
function activate() {}
function deactivate() {}
module.exports = { activate, deactivate };
