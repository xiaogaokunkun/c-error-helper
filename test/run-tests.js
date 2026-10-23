// 单测：直接 require 编译产物 out/*.js（纯函数，无 vscode 依赖）。
const path = require('path');
const fs = require('fs');
const { matchError, normalizeMessage } = require(path.join(__dirname, '..', 'out', 'match.js'));
const { rangeContainsPosition, diagnosticsAtPosition, pickDiagnostic } =
  require(path.join(__dirname, '..', 'out', 'diagnostics.js'));
const { createDebounced } = require(path.join(__dirname, '..', 'out', 'debounce.js'));
const pkg = require(path.join(__dirname, '..', 'package.json'));

// 去 HTML 标签 + 解码实体，用于断言规则名。
const clean = (s) => String(s)
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
  if (cond) {
    pass++;
    return;
  }
  fail++;
  console.log('✗ ' + name + (extra !== undefined ? '   → ' + extra : ''));
}

function check(msg, expectedName) {
  const r = matchError(msg);
  const got = r ? clean(r.n) : '(未命中)';
  ok('命中: ' + msg, got === expectedName, '期望=[' + expectedName + '] 实际=[' + got + ']');
}

// ---------- gcc 原文 ----------
check("main.c:3:1: error: expected ';' before '}' token", '上一行末尾漏了分号');
check("main.c:2:1: error: expected declaration or statement at end of input", '花括号没配平，少了一个 }');
check("main.c:7:12: error: 'n' undeclared (first use in this function)", '用了一个没声明的变量名');
check("main.c:2:1: error: stray '\\357' in program", '代码里混进了中文全角字符');
check("main.c:4:5: warning: implicit declaration of function 'printf'", '没 #include 就把函数拿来用了');
check("main.c:9:10: error: invalid operands to binary % (have 'double' and 'double')", '把 % 用在了小数上');
check("main.c:5:7: warning: format '%d' expects argument of type 'int *', but argument 2 has type 'int'", 'scanf 漏了取地址符 &');
check("main.c:3:1: error: expected ')' before ';' token", '圆括号没配对，或括号里内容写错');
check("[Error] ld returned 1 exit status", '链接失败（Dev-C++ 最出名的报错）');
check("undefined reference to 'sqrt'", '函数/变量声明了但没实现');
check("main.c:1:10: fatal error: stdio.h: No such file or directory", '头文件找不到 / 文件名写错');
check("main.c:8:5: warning: unused variable 'tmp'", '声明了变量但没用（这个警告可以忽略）');

// ---------- IntelliSense (MS C/C++) 变体 ----------
check("expected a ';'", '上一行末尾漏了分号');
check("use of undeclared identifier 'scanf'", '用了一个没声明的变量名');
check('identifier "x" is undefined', '用了一个没声明的变量名');
check("expected a ')'", '圆括号没配对，或括号里内容写错');
check("expected an expression", '某个符号前面缺了个东西（表达式不完整）');
check('cannot open source file "stdio.h"', '头文件找不到 / 文件名写错');
// VS Code 的 C/C++ 扩展在没配 includePath / compilerPath 时的措辞（实测自 cpptools 1.34.4）
check('could not open source file "stdio.h" (no directories in search list)', '头文件找不到 / 文件名写错');
check('#include errors detected. Please update your includePath.', '头文件找不到 / 文件名写错');

// ---------- 规范化：直接断言 normalizeMessage 的输出 ----------
ok('规范化：中文引号 → 半角',
  normalizeMessage('use of undeclared identifier ‘x’') === "use of undeclared identifier 'x'",
  normalizeMessage('use of undeclared identifier ‘x’'));
ok('规范化：全角括号 → 半角',
  normalizeMessage('foo（bar）') === 'foo(bar)',
  normalizeMessage('foo（bar）'));
ok('规范化：去掉尾部 (dependency of ...) 备注',
  normalizeMessage('cannot open source file "a.h" (dependency of "main.c")') ===
    'cannot open source file "a.h"',
  normalizeMessage('cannot open source file "a.h" (dependency of "main.c")'));
ok('规范化：Windows 绝对路径只留文件名',
  normalizeMessage(String.raw`cannot open source file "C:\work\inc\a.h"`) ===
    'cannot open source file "a.h"',
  normalizeMessage(String.raw`cannot open source file "C:\work\inc\a.h"`));
ok('规范化：带空格的 Windows 路径也只留文件名',
  normalizeMessage(String.raw`cannot open source file "C:\Program Files\MSYS2\include\a.h"`) ===
    'cannot open source file "a.h"',
  normalizeMessage(String.raw`cannot open source file "C:\Program Files\MSYS2\include\a.h"`));
ok('规范化：Unix 绝对路径只留文件名',
  normalizeMessage('fatal error: /usr/include/stdio.h: No such file or directory') ===
    'fatal error: stdio.h: No such file or directory',
  normalizeMessage('fatal error: /usr/include/stdio.h: No such file or directory'));
ok('规范化：全角引号 + 绝对路径 + 括号备注可叠加',
  normalizeMessage(String.raw`cannot open source file “C:\work\inc\a.h”（dependency of “main.c”）`) ===
    'cannot open source file "a.h"',
  normalizeMessage(String.raw`cannot open source file “C:\work\inc\a.h”（dependency of “main.c”）`));

// ---------- 规范化：命中结果 ----------
check('use of undeclared identifier ‘x’', '用了一个没声明的变量名');
check('expected ‘;’ at end of declaration', '上一行末尾漏了分号');
check("expected ';' at end of declaration", '上一行末尾漏了分号');
check('cannot open source file “a.h”（dependency of “main.c”）', '头文件找不到 / 文件名写错');
// 下面两条在规范化前会被路径/备注里的 stray 骗到「中文全角字符」规则（规则 4 排在规则 8 前面）；
// 去掉备注 / 路径前缀后必须落到正确的「头文件找不到」。
check('cannot open source file "a.h" (dependency of "stray.c")', '头文件找不到 / 文件名写错');
check(String.raw`error: cannot open source file "C:\work\stray\foo.h"`, '头文件找不到 / 文件名写错');

// ---------- 规范化：反例（不能乱匹配） ----------
check('note: nothing relevant here（仅提示，没有关键词）', '(未命中)');
check(`unknown note (dependency of "expected ';' before 'x'")`, '(未命中)');
// 路径目录里的 stray 被剥掉后，剩下的文件名不含任何关键词 → 不应命中。
check('could not read config /tmp/stray/config.txt', '(未命中)');

// ---------- Hover：同位置多诊断的取舍 ----------
const pos = (line, character) => ({ line, character });
const rng = (sl, sc, el, ec) => ({ start: { line: sl, character: sc }, end: { line: el, character: ec } });
const diag = (message, severity, range) => ({ message, severity, range });
const nameOf = (rule) => (rule ? clean(rule.n) : '(未命中)');

// 数组里 Warning 在前、Error 在后：必须选 Error。
const mixed = [
  diag("warning: unused variable 'tmp'", 1, rng(3, 5, 3, 12)),
  diag("use of undeclared identifier 'x'", 0, rng(3, 5, 3, 6)),
];
const pickedMixed = pickDiagnostic(mixed, pos(3, 5), (d) => matchError(d.message));
ok('Hover：Error 压过先出现的 Warning',
  pickedMixed && nameOf(pickedMixed.rule) === '用了一个没声明的变量名',
  pickedMixed && nameOf(pickedMixed.rule));

// 最高严重度的诊断匹配不到规则时，不能让 hover 空掉 —— 继续找下一条。
const unknownErrorFirst = [
  diag('totally unknown diagnostic text', 0, rng(1, 0, 1, 10)),
  diag("warning: unused variable 'tmp'", 1, rng(1, 0, 1, 10)),
];
const pickedFallback = pickDiagnostic(unknownErrorFirst, pos(1, 0), (d) => matchError(d.message));
ok('Hover：匹配不到规则的 Error 不挡住 Warning',
  pickedFallback && nameOf(pickedFallback.rule) === '声明了变量但没用（这个警告可以忽略）',
  pickedFallback && nameOf(pickedFallback.rule));

// 同 severity：保持 getDiagnostics 原顺序。
const sameSeverity = [
  diag("warning: unused variable 'tmp'", 1, rng(2, 0, 2, 10)),
  diag("warning: implicit declaration of function 'foo'", 1, rng(2, 0, 2, 10)),
];
const sameOrder = diagnosticsAtPosition(sameSeverity, pos(2, 0));
ok('Hover：同 severity 保持原顺序',
  sameOrder[0] === sameSeverity[0] && sameOrder[1] === sameSeverity[1]);

// severity 缺失：排到最后，不抢已知严重度的位置。
const undefinedSeverity = [
  diag("warning: unused variable 'tmp'", undefined, rng(4, 0, 4, 10)),
  diag("warning: implicit declaration of function 'foo'", 3, rng(4, 0, 4, 10)),
];
const sevOrder = diagnosticsAtPosition(undefinedSeverity, pos(4, 0));
ok('Hover：undefined severity 排最后', sevOrder[0] === undefinedSeverity[1]);

const far = [diag("warning: unused variable 'tmp'", 1, rng(9, 0, 9, 5))];
ok('Hover：位置外的诊断不参与', diagnosticsAtPosition(far, pos(1, 0)).length === 0);

// 范围端点：Range.contains 语义是包含端点。
const endpointRange = rng(3, 5, 3, 10);
ok('Range：起点包含', rangeContainsPosition(endpointRange, pos(3, 5)));
ok('Range：终点包含', rangeContainsPosition(endpointRange, pos(3, 10)));
ok('Range：起点前一位不包含', !rangeContainsPosition(endpointRange, pos(3, 4)));
ok('Range：终点后一位不包含', !rangeContainsPosition(endpointRange, pos(3, 11)));

const multiLine = rng(2, 5, 4, 2);
ok('Range：多行中间行包含', rangeContainsPosition(multiLine, pos(3, 999)));
ok('Range：多行最后一行越界不包含', !rangeContainsPosition(multiLine, pos(4, 3)));

// ---------- 宿主接线（源码级检查，防止实现被改回旧写法） ----------
const extSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'extension.ts'), 'utf8');
ok('extension.ts 的 Hover 走 pickDiagnostic', extSrc.includes('pickDiagnostic('));
ok('extension.ts 把防抖器注册进 context.subscriptions',
  /context\.subscriptions\.push\(\s*diagnosticsDebounce/.test(extSrc));

// ---------- package.json：命令面板可见 ----------
const commands = (pkg.contributes && pkg.contributes.commands) || [];
const commandById = new Map(commands.map((c) => [c.command, c]));
ok('package.json 声明 cErrorHelper.explain', commandById.has('cErrorHelper.explain'));
ok('cErrorHelper.explain 标题为中文',
  (commandById.get('cErrorHelper.explain') || {}).title === '学长解释：解释当前报错',
  JSON.stringify(commandById.get('cErrorHelper.explain')));
ok('package.json 声明 cErrorHelper.explainMarkdown', commandById.has('cErrorHelper.explainMarkdown'));
ok('cErrorHelper.explainMarkdown 标题为中文',
  (commandById.get('cErrorHelper.explainMarkdown') || {}).title === '学长解释：用 Markdown 打开',
  JSON.stringify(commandById.get('cErrorHelper.explainMarkdown')));
ok('不污染右键菜单（contributes.menus 不存在）',
  !pkg.contributes.menus, JSON.stringify(pkg.contributes.menus));

// ---------- 防抖器：资源释放（异步，最后跑） ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let calls = 0;
  const debounced = createDebounced(25, () => { calls++; });

  debounced.schedule();
  debounced.schedule();
  debounced.schedule();
  ok('防抖：连续触发时 pending=true', debounced.pending() === true);
  await sleep(120);
  ok('防抖：3 次连续触发合并成 1 次', calls === 1, 'calls=' + calls);

  debounced.schedule();
  debounced.dispose();   // 模拟 deactivate 时 context.subscriptions 回收
  await sleep(120);
  ok('dispose 清掉未触发的 timer', calls === 1, 'calls=' + calls);
  ok('dispose 后 pending=false', debounced.pending() === false);

  // dispose 只是取消当前 timer，不把对象永久停用；之后仍可正常调度。
  debounced.schedule();
  await sleep(120);
  ok('dispose 只取消当前 timer，不影响后续 schedule', calls === 2, 'calls=' + calls);

  console.log('');
  console.log('======== 单测结果 ========');
  console.log('通过 ' + pass + ' / ' + (pass + fail));
  if (fail > 0) process.exit(1);
})();
