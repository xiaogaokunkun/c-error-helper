// 「学长解释」Webview 面板的单测：HTML 结构 + 真跑面板里的 JS（DOM 桩），验证缩放真的能用。
// 只 require 编译产物 out/explainView.js（纯函数，不依赖 vscode）。
const path = require('path');
const vm = require('vm');
const { buildExplainHtml, escapeHtml } = require(path.join(__dirname, '..', 'out', 'explainView.js'));

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.log('✗ ' + name + (extra ? '   → ' + extra : ''));
}

const rule = {
  k: ['expected'], s: 'e', n: '上一行末尾漏了分号',
  why: '编译器期待一个分号，真正少分号的是<strong>上一行</strong>。',
  fix: ['末尾补 <code>;</code>', '结构体右边的 <code>}</code> 后面也要 <code>;</code>'],
  code: 'int a = 1;   // ✅\nif (a < 3) { printf("%d", a); }',
};
const MD = '# 上一行末尾漏了分号\n\n**怎么改：**\n- 补分号';

// ---------- 一、HTML 结构 ----------
const html = buildExplainHtml({ rule, markdown: MD, scale: 1.3, nonce: 'NONCE123', cspSource: 'vscode-webview://abc' });

ok('标题在', html.includes('上一行末尾漏了分号'));
ok('徽章在', html.includes('❌ 错误'));
ok('why 里的 HTML 原样保留（<strong> 不转义）', html.includes('<strong>上一行</strong>'));
ok('fix 里的 <code> 原样保留', html.includes('末尾补 <code>;</code>'));
ok('code 被转义（防止 C 代码里的 <> 被当标签）',
  html.includes('a &lt; 3') && !html.includes('if (a < 3)'),
  '实际含 a &lt; 3 = ' + html.includes('a &lt; 3'));
ok('--scale 按传入值写进 CSS', html.includes('--scale: 1.30'));
ok('缩放控件齐', ['id="minus"', 'id="plus"', 'id="reset"', 'id="pct"', 'id="copy"', 'id="md"']
  .every((s) => html.includes(s)));
ok('CSP 带 nonce 且禁止外部资源', html.includes("script-src 'nonce-NONCE123'") && html.includes("default-src 'none'"));
ok('Markdown 文本传给了复制按钮', html.includes(JSON.stringify(MD)));
ok('escapeHtml 正确', escapeHtml('<a href="x"> & </a>') === '&lt;a href=&quot;x&quot;&gt; &amp; &lt;/a&gt;',
  escapeHtml('<a href="x"> & </a>'));

// ---------- 二、真跑面板里的 JS ----------
function runPanel(scale) {
  const h = buildExplainHtml({ rule, markdown: MD, scale, nonce: 'n1', cspSource: 's' });
  const m = h.match(/<script nonce="n1">([\s\S]*?)<\/script>/);
  const posted = [];
  const els = {};
  function El(id) {
    return {
      id, textContent: '', value: '',
      style: { setProperty(k, v) { this[k] = v; } },
      classList: { add() {}, remove() {} },
      addEventListener(type, fn) { this['on' + type] = fn; },
      appendChild() {}, removeChild() {}, select() {}, parentNode: null,
    };
  }
  const documentStub = {
    documentElement: El('root'),
    getElementById(id) { return els[id] || (els[id] = El(id)); },
    createElement(tag) { return El(tag); },
    body: { appendChild() {}, removeChild() {} },
    execCommand() { return true; },
  };
  const listeners = {};
  const win = { addEventListener(t, fn) { listeners[t] = fn; } };
  const ctx = {
    document: documentStub, window: win, navigator: {}, setTimeout, JSON, Math, String,
    acquireVsCodeApi: () => ({ postMessage: (msg) => posted.push(msg) }),
  };
  vm.createContext(ctx);
  vm.runInContext(m[1], ctx);
  return {
    els, listeners, posted,
    scale: () => win.__explainTest.get(),
    root: documentStub.documentElement,
  };
}

const p = runPanel(1);
ok('初始百分比显示 100%', p.els.pct.textContent === '100%', p.els.pct.textContent);
ok('初始 CSS 变量 = 1', String(p.root.style['--scale']) === '1', String(p.root.style['--scale']));

p.els.plus.onclick();
ok('点 A+ → 1.1', p.scale() === 1.1, String(p.scale()));
ok('A+ 后百分比跟着变', p.els.pct.textContent === '110%', p.els.pct.textContent);
p.els.minus.onclick();
p.els.minus.onclick();
ok('点两次 A− → 0.9（浮点不飘）', p.scale() === 0.9, String(p.scale()));
p.els.reset.onclick();
ok('重置 → 1', p.scale() === 1);

ok('缩放会回传宿主（用于落盘）',
  p.posted.some((m) => m && m.type === 'setScale' && m.value === 1),
  JSON.stringify(p.posted));
// 新开一个面板：初始化时只显示百分比，不该给宿主发任何消息（否则每打开一次都写一遍 globalState）
const fresh = runPanel(1.5);
ok('初始化不回传 setScale', fresh.posted.length === 0, JSON.stringify(fresh.posted));
ok('初始化就按上次的档位显示', fresh.els.pct.textContent === '150%', fresh.els.pct.textContent);

// 边界：1.0 连点 40 次 A+ 应停在 2.5；连点 40 次 A− 应停在 0.6
const hi = runPanel(2.4);
for (let i = 0; i < 40; i++) hi.els.plus.onclick();
ok('上限 2.5', hi.scale() === 2.5, String(hi.scale()));
const lo = runPanel(0.7);
for (let i = 0; i < 40; i++) lo.els.minus.onclick();
ok('下限 0.6', lo.scale() === 0.6, String(lo.scale()));

// Ctrl+滚轮
const w = runPanel(1);
let prevented = 0;
w.listeners.wheel({ ctrlKey: true, deltaY: -100, preventDefault() { prevented++; } });
ok('Ctrl+滚轮向上 → 放大', w.scale() === 1.1, String(w.scale()));
ok('Ctrl+滚轮会 preventDefault（不禁用页面滚动）', prevented === 1, String(prevented));
w.listeners.wheel({ ctrlKey: true, deltaY: 100, preventDefault() {} });
ok('Ctrl+滚轮向下 → 缩小', w.scale() === 1, String(w.scale()));
w.listeners.wheel({ ctrlKey: false, deltaY: -100, preventDefault() {} });
ok('不按 Ctrl 滚轮不动缩放', w.scale() === 1, String(w.scale()));

// Ctrl+= / Ctrl+- / Ctrl+0
w.listeners.keydown({ ctrlKey: true, key: '=', preventDefault() {} });
ok('Ctrl+= 放大', w.scale() === 1.1, String(w.scale()));
w.listeners.keydown({ ctrlKey: true, key: '-', preventDefault() {} });
ok('Ctrl+- 缩小', w.scale() === 1, String(w.scale()));
w.listeners.keydown({ ctrlKey: true, key: '=', preventDefault() {} });
w.listeners.keydown({ ctrlKey: true, key: '0', preventDefault() {} });
ok('Ctrl+0 重置', w.scale() === 1, String(w.scale()));

// 「Markdown」按钮 → 让宿主去开文本编辑器
const md = runPanel(1);
md.els.md.onclick();
ok('Markdown 按钮通知宿主', md.posted.some((m) => m && m.type === 'openMarkdown'), JSON.stringify(md.posted));

// 没有 why / fix / code 的规则也不能崩
const bare = buildExplainHtml({ rule: { n: '光秃秃的规则', s: 'w' }, markdown: 'x', scale: 1, nonce: 'x', cspSource: 's' });
ok('缺字段的规则也能渲染', bare.includes('光秃秃的规则') && bare.includes('⚠️ 警告'));

console.log('\n======== Webview 面板单测 ========');
console.log('通过 ' + pass + ' / ' + (pass + fail));
process.exit(fail ? 1 : 0);
