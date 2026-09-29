const fs = require('fs');
const path = require('path');

const src = 'C:/Users/31546/OneDrive/文档/ds1/副业/A-校园小工具/C语言报错翻译器.html';
const out = 'C:/Users/31546/OneDrive/文档/ds1/副业/A-校园小工具/vscode-c-error-helper/src/rules.ts';

const html = fs.readFileSync(src, 'utf8');

const startMarker = 'const RULES=[';
const start = html.indexOf(startMarker);
if (start < 0) { console.error('FAIL: 未找到 const RULES=['); process.exit(1); }

// RULES 数组以 const LOGIC=[ 之前最近的一个 '];' 结束
const logicIdx = html.indexOf('const LOGIC=[');
if (logicIdx < 0) { console.error('FAIL: 未找到 const LOGIC=['); process.exit(1); }
const end = html.lastIndexOf('];', logicIdx);
if (end < 0 || end <= start) { console.error('FAIL: 未找到 RULES 闭合 ];'); process.exit(1); }

let block = html.slice(start, end + 2); // 含 '];'

block = block.replace('const RULES=[', 'export const RULES: any[] = [');

// 安全检查：模板字面量里若含 ${ 会被 JS 当作插值
const interp = (block.match(/\$\{/g) || []).length;
if (interp > 0) { console.error('WARN: 规则内发现 ' + interp + ' 处 ${ 插值，需人工检查！'); }

const header = [
  '// 从 C语言报错翻译器.html 的 const RULES 数组原样提取，仅改头部为 export。',
  '// 字段说明：k 关键词数组 / n 名称 / why 解释 / fix 修复建议数组 / code 示例(模板串) / t 简称 / s 严重度 e|w|i / p 优先级 / ig 可忽略。',
  '// 内容未做任何改动（含 HTML 标签与实体，渲染层再转义）。',
  '',
].join('\n');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, header + block + '\n', 'utf8');

const ruleCount = (block.match(/\{k:\[/g) || []).length;
console.log('OK 规则条数:', ruleCount);
console.log('OK 输出文件:', out);
console.log('OK 字符数:', (header + block).length);
