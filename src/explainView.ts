// 「学长解释」面板的 HTML 生成 —— 纯函数、不 import vscode，方便 node 直接 require 编译产物做单测
// （和 match.ts 同一个套路）。
//
// 为什么不用原来的文本编辑器标签页：那是 markdown 源码，字号完全由 VS Code 的 editor.fontSize 决定，
// 扩展既不能给它单独的字号、也不能给它一个缩放控件。换成 Webview 后 HTML/CSS 归我们控制，
// 于是可以自己做「A− / A+ / 重置 + Ctrl+滚轮 + Ctrl+= 」这一套缩放，并把档位落盘记住。

export interface ExplainViewInput {
  /** rules.ts 里的规则对象（why / fix / code / n / s 字段，内含 HTML） */
  rule: any;
  /** 该规则对应的 Markdown 文本，供「复制成 Markdown」用（由 extension.ts 生成） */
  markdown: string;
  /** 上次记住的缩放档位，0.6–2.5 */
  scale: number;
  /** CSP nonce（每次渲染新生成） */
  nonce: string;
  /** webview.cspSource */
  cspSource: string;
}

export function escapeHtml(s: any): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BADGE: Record<string, string> = { e: '❌ 错误', w: '⚠️ 警告', i: 'ℹ️ 提示' };

/** 「为什么」+「怎么改」+「正确写法」三块正文（rule 里自带 HTML，原样插入） */
export function buildExplainBody(rule: any): string {
  const parts: string[] = [];
  if (rule.why) parts.push(`<p class="why">${rule.why}</p>`);
  if (rule.fix && rule.fix.length) {
    parts.push('<h2>怎么改</h2><ul class="fix">' +
      rule.fix.map((f: string) => `<li>${f}</li>`).join('') + '</ul>');
  }
  if (rule.code) {
    parts.push('<h2>正确写法</h2><pre><code>' + escapeHtml(rule.code) + '</code></pre>');
  }
  return parts.join('\n');
}

export function buildExplainHtml(input: ExplainViewInput): string {
  const { rule, markdown, scale, nonce, cspSource } = input;
  const title = rule && rule.n ? rule.n : '解释';
  const badge = BADGE[rule && rule.s] || '';
  const body = buildExplainBody(rule);
  const pct = Math.round(scale * 100);

  // CSP：只允许本 webview 自己的资源 + 带 nonce 的内联脚本；不引任何外部东西（和扩展本身一样纯本地）
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root {
    /* 缩放核心：所有字号都从这个变量算出来，改一处全页生效 */
    --scale: ${(scale).toFixed(2)};
    --fs: calc(var(--vscode-font-size, 13px) * var(--scale));
    --bg: var(--vscode-editor-background, #1e1e1e);
    --fg: var(--vscode-editor-foreground, #d4d4d4);
    --mut: var(--vscode-descriptionForeground, #9aa0a6);
    --line: var(--vscode-panel-border, rgba(128,128,128,.28));
    --code-bg: var(--vscode-textCodeBlock-background, rgba(128,128,128,.13));
    --link: var(--vscode-textLink-foreground, #4daafc);
    --btn-bg: var(--vscode-button-secondaryBackground, rgba(128,128,128,.16));
    --btn-fg: var(--vscode-button-secondaryForeground, var(--fg));
    --btn-hover: var(--vscode-button-secondaryHoverBackground, rgba(128,128,128,.28));
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); }
  body {
    font-family: var(--vscode-font-family, -apple-system, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif);
    font-size: var(--fs); line-height: 1.62;
    -webkit-text-size-adjust: 100%;
  }
  /* 工具条固定在顶部，滚动内容时始终能点到缩放按钮 */
  .bar {
    position: sticky; top: 0; z-index: 5;
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    padding: 8px 14px; border-bottom: 1px solid var(--line);
    background: var(--bg);
  }
  .bar .sp { flex: 1 1 auto; }
  button {
    font-family: inherit; font-size: calc(var(--fs) * .92);
    color: var(--btn-fg); background: var(--btn-bg);
    border: 1px solid transparent; border-radius: 5px;
    padding: 3px 9px; cursor: pointer; line-height: 1.5;
  }
  button:hover { background: var(--btn-hover); }
  button:active { transform: translateY(1px); }
  button:focus-visible { outline: 1px solid var(--link); outline-offset: 1px; }
  #pct { min-width: 3.4em; text-align: center; color: var(--mut); font-variant-numeric: tabular-nums; }
  .hint { color: var(--mut); font-size: calc(var(--fs) * .84); }
  main { padding: 14px 18px 40px; max-width: 46em; }
  h1 { font-size: calc(var(--fs) * 1.24); margin: 0 0 4px; line-height: 1.4; }
  h2 { font-size: calc(var(--fs) * 1.02); margin: 18px 0 6px; color: var(--mut); font-weight: 600; }
  .badge { font-size: calc(var(--fs) * .84); color: var(--mut); margin-left: 6px; }
  .why { margin: 6px 0 0; }
  ul.fix { margin: 4px 0 0; padding-left: 1.3em; }
  ul.fix li { margin: 3px 0; }
  code {
    font-family: var(--vscode-editor-font-family, ui-monospace, Consolas, monospace);
    background: var(--code-bg); padding: .1em .35em; border-radius: 4px;
    font-size: .94em;
  }
  pre {
    background: var(--code-bg); border: 1px solid var(--line); border-radius: 8px;
    padding: 10px 12px; overflow: auto; margin: 6px 0 0;
  }
  pre code { background: none; padding: 0; font-size: .95em; line-height: 1.55; }
  strong { font-weight: 700; }
  footer { margin-top: 22px; color: var(--mut); font-size: calc(var(--fs) * .84); }
  #toast {
    position: fixed; right: 14px; bottom: 14px; padding: 6px 12px; border-radius: 6px;
    background: var(--vscode-notifications-background, #2d2d2d); color: var(--fg);
    border: 1px solid var(--line); opacity: 0; transition: opacity .18s; pointer-events: none;
    font-size: calc(var(--fs) * .9);
  }
  #toast.on { opacity: 1; }
</style>
</head>
<body>
  <div class="bar">
    <button id="minus" title="缩小（Ctrl+- 或 Ctrl+滚轮）">A−</button>
    <span id="pct">${pct}%</span>
    <button id="plus" title="放大（Ctrl+= 或 Ctrl+滚轮）">A+</button>
    <button id="reset" title="回到 100%">重置</button>
    <span class="sp"></span>
    <button id="copy" title="把这份解释复制成 Markdown">复制</button>
    <button id="md" title="用原来的 Markdown 文本编辑器打开（可 Ctrl+Shift+V 预览）">Markdown</button>
  </div>
  <main>
    <h1>${title}<span class="badge">${badge}</span></h1>
    ${body}
    <footer>缩放档位会记住；字号跟着 VS Code 的字号设置走（改 <code>editor.fontSize</code> 全站生效）。</footer>
  </main>
  <div id="toast"></div>
<script nonce="${nonce}">
(function () {
  var MIN = 0.6, MAX = 2.5, STEP = 0.1;
  var scale = ${scale.toFixed(2)};
  var root = document.documentElement;
  var api = acquireVsCodeApi();

  function clamp(v) { return Math.min(MAX, Math.max(MIN, Math.round(v * 100) / 100)); }
  function apply(next, persist) {
    scale = clamp(next);
    root.style.setProperty('--scale', String(scale));
    document.getElementById('pct').textContent = Math.round(scale * 100) + '%';
    if (persist !== false) api.postMessage({ type: 'setScale', value: scale });
  }
  document.getElementById('plus').addEventListener('click', function () { apply(scale + STEP); });
  document.getElementById('minus').addEventListener('click', function () { apply(scale - STEP); });
  document.getElementById('reset').addEventListener('click', function () { apply(1); });

  // Ctrl+滚轮
  window.addEventListener('wheel', function (e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    apply(scale + (e.deltaY < 0 ? STEP : -STEP));
  }, { passive: false });

  // Ctrl+= / Ctrl+- / Ctrl+0
  window.addEventListener('keydown', function (e) {
    if (!e.ctrlKey) return;
    if (e.key === '=' || e.key === '+') { e.preventDefault(); apply(scale + STEP); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); apply(scale - STEP); }
    else if (e.key === '0') { e.preventDefault(); apply(1); }
  });

  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('on');
    setTimeout(function () { t.classList.remove('on'); }, 1200);
  }

  document.getElementById('copy').addEventListener('click', function () {
    var text = ${JSON.stringify(markdown)};
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('已复制 Markdown'); }, function () { fallback(); toast('已复制 Markdown'); });
    } else { fallback(); toast('已复制 Markdown'); }
  });

  document.getElementById('md').addEventListener('click', function () {
    api.postMessage({ type: 'openMarkdown' });
  });

  apply(scale, false);   // 初始化：把百分比显示出来，但不回写（避免每次打开都存一遍）
  window.__explainTest = { apply: apply, get: function () { return scale; } };  // 单测用
})();
</script>
</body>
</html>`;
}
