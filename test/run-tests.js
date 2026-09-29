// 单测：直接 require 编译产物 out/match.js（纯函数，无 vscode 依赖）。
const path = require('path');
const { matchError } = require(path.join(__dirname, '..', 'out', 'match.js'));

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

function check(msg, expectedName) {
  const r = matchError(msg);
  const got = r ? clean(r.n) : '(未命中)';
  if (got === expectedName) {
    pass++;
  } else {
    fail++;
    console.log('✗ 未通过: ' + msg);
    console.log('    期望=[' + expectedName + '] 实际=[' + got + ']');
  }
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

console.log('');
console.log('======== 单测结果 ========');
console.log('通过 ' + pass + ' / ' + (pass + fail));
if (fail > 0) process.exit(1);
