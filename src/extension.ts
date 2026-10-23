import * as vscode from 'vscode';
import { matchError } from './match';
import { RULES } from './rules';
import { buildExplainHtml } from './explainView';
import { pickDiagnostic } from './diagnostics';
import { createDebounced } from './debounce';

// 规则里存的是 HTML 标签与实体（网页版直接 innerHTML），渲染层再转成 Markdown。
// 注意顺序：先把真标签处理完，最后才还原实体。
// 反过来的话，规则里的 &lt;stdio.h&gt; 会先变成 <stdio.h> 被当成 HTML 标签剥掉（hover 里直接缺词）。
function htmlToMarkdown(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<code>/g, '`')
    .replace(/<\/code>/g, '`')
    .replace(/<strong>/g, '**')
    .replace(/<\/strong>/g, '**')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

// 纯文本用（CodeAction 标题等）：这里把 &lt; &gt; 也还原成真正的尖括号
function toPlain(s: string): string {
  return htmlToMarkdown(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\*\*/g, '')
    .replace(/`/g, '');
}

// hover 的高度有硬上限：VS Code 把悬停框压进「视口可用空间」里（本机实测 1456×908 窗口 = 250px、
// 最大化 2560×1440 = 317px；字号 14px 时正文每行 19px），内容超出就出现滚动条、正文被截掉
// ——这就是「悬停框太小」的真正成因，而且 VS Code 没给扩展任何设置宽高的 API
// （editor.hover.* 只有 enabled/delay/sticky/hidingDelay/above/showLongLineWarning）。
// 所以 hover 只放「标题 + 为什么 + 全部改法」，Ctrl+. 入口折进「怎么改」那行省掉一整行；
// 实测 36 条规则 132–246px，小窗口（250px 上限）也不滚动。代码块（最占高度）留给完整讲解。
function buildSections(rule: any, compact = false): string[] {
  const badge = rule.s === 'e' ? '❌ 错误' : (rule.s === 'w' ? '⚠️ 警告' : 'ℹ️ 提示');
  const lines: string[] = [];
  lines.push(`**${htmlToMarkdown(rule.n)}**  ${badge}`);
  if (rule.why) {
    lines.push('');
    lines.push(htmlToMarkdown(rule.why));
  }
  if (rule.fix && rule.fix.length) {
    lines.push('');
    lines.push(compact ? '**怎么改**（按 `Ctrl+.` 看完整讲解）：' : '**怎么改：**');
    for (const f of rule.fix) lines.push(`- ${htmlToMarkdown(f)}`);
  }
  return lines;
}

// 悬停用的精简版：不能超高度上限，否则会被截 + 出滚动条。
// 布局：标题+徽章 / 为什么 / 「怎么改」（Ctrl+. 的入口折进这行标题里，省下一整行高度）。
function buildHoverMarkdown(rule: any): string {
  const lines = buildSections(rule, true);
  return lines.join('\n');
}

// Ctrl+. 打开的完整讲解：hover 放不下的代码示例在这里
function buildExplainMarkdown(rule: any): string {
  const lines = buildSections(rule);
  if (rule.code) {
    lines.push('');
    lines.push('**正确写法：**');
    lines.push('```c');
    lines.push(rule.code);
    lines.push('```');
  }
  return lines.join('\n');
}

const CMD_EXPLAIN = 'cErrorHelper.explain';
/** 同一个解释，改用 markdown 文本标签页打开（Webview 面板右上角那个「Markdown」按钮走这条） */
const CMD_EXPLAIN_MD = 'cErrorHelper.explainMarkdown';
/** 缩放档位记住在 globalState 里（全局，跨工作区） */
const SCALE_KEY = 'cErrorHelper.explainScale';

// 「学长解释」有两种打开方式：
//   ① 默认（CMD_EXPLAIN）：Webview 面板 —— HTML/CSS 归我们控制，所以能做 A−/A+/重置 + Ctrl+滚轮 + Ctrl+= 的
//      缩放，颜色/字号跟随 VS Code 主题与 editor.fontSize；复用同一个面板，避免每点一次堆一个标签页。
//   ② CMD_EXPLAIN_MD：退回原来的纯文本 markdown 标签页（想 Ctrl+Shift+V 预览、想直接改文本时用）。
let view: vscode.WebviewPanel | undefined;
let textDoc: vscode.TextDocument | undefined;
/** 当前面板里展示的是哪条规则 —— 「Markdown」按钮要用 */
let currentRuleIndex = -1;

function renderExplain(webview: vscode.Webview, rule: any, markdown: string, scale: number): string {
  const nonce = Array.from({ length: 32 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 62))
  ).join('');
  return buildExplainHtml({ rule, markdown, scale, nonce, cspSource: webview.cspSource });
}

function clampScale(v: any): number {
  const n = typeof v === 'number' && isFinite(v) ? v : 1;
  return Math.min(2.5, Math.max(0.6, n));
}

async function openExplainMarkdown(ruleIndex: number): Promise<void> {
  const rule = RULES[ruleIndex];
  if (!rule) return;
  const markdown = buildExplainMarkdown(rule);
  if (textDoc && textDoc.isClosed) textDoc = undefined;
  if (!textDoc) {
    textDoc = await vscode.workspace.openTextDocument({ language: 'markdown', content: markdown });
    await vscode.window.showTextDocument(textDoc, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: true,
    });
    return;
  }
  const editor = await vscode.window.showTextDocument(textDoc, {
    viewColumn: vscode.ViewColumn.Beside,
    preview: true,
  });
  const lastLine = textDoc.lineCount;
  await editor.edit((b) => b.replace(new vscode.Range(0, 0, lastLine, 0), markdown));
}

function showExplain(context: vscode.ExtensionContext, ruleIndex: number): void {
  const rule = RULES[ruleIndex];
  if (!rule) return;
  currentRuleIndex = ruleIndex;
  const markdown = buildExplainMarkdown(rule);
  const scale = clampScale(context.globalState.get<number>(SCALE_KEY, 1));
  const title = '学长解释：' + toPlain(rule.n);

  if (view) {
    view.title = title;
    view.webview.html = renderExplain(view.webview, rule, markdown, scale);
    view.reveal(vscode.ViewColumn.Beside, true);
    return;
  }

  view = vscode.window.createWebviewPanel('cErrorHelper.explain', title, vscode.ViewColumn.Beside, {
    enableScripts: true,
    retainContextWhenHidden: true,   // 切走再回来不重载，缩放档位与滚动位置都不丢
  });
  view.webview.html = renderExplain(view.webview, rule, markdown, scale);

  view.webview.onDidReceiveMessage((msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'setScale') {
      void context.globalState.update(SCALE_KEY, clampScale(msg.value));
    } else if (msg.type === 'openMarkdown') {
      void openExplainMarkdown(currentRuleIndex);
    }
  });

  view.onDidDispose(() => {
    view = undefined;
  });
}

export function activate(context: vscode.ExtensionContext) {
  // 命中缓存（message → rule），供 Hover / CodeAction 复用。
  const memo = new Map<string, any>();
  const resolve = (msg: string): any | null => {
    if (!memo.has(msg)) memo.set(msg, matchError(msg));
    return memo.get(msg) || null;
  };

  // 核心监听：onDidChangeDiagnostics，仅 c/cpp，防抖 150ms。
  // 防抖器自己实现 dispose：deactivate 时 context.subscriptions 会清掉还悬着的 timer。
  let pendingUris: readonly vscode.Uri[] = [];
  const diagnosticsDebounce = createDebounced(150, () => {
    const uris = pendingUris;
    pendingUris = [];
    for (const uri of uris) {
      const doc = vscode.workspace.textDocuments.find(
        (d) => d.uri.toString() === uri.toString()
      );
      if (!doc) continue;
      if (doc.languageId !== 'c' && doc.languageId !== 'cpp') continue;
      for (const d of vscode.languages.getDiagnostics(uri)) {
        resolve(d.message);
      }
    }
  });
  context.subscriptions.push(
    diagnosticsDebounce,
    vscode.languages.onDidChangeDiagnostics((e) => {
      pendingUris = e.uris;
      diagnosticsDebounce.schedule();
    })
  );

  // Hover：光标落在诊断范围内时显示中文解释。
  // 同一位置可能同时有 Error / Warning：按严重度从高到低找第一条能匹配到规则的诊断，
  // 匹配不到的高严重度诊断（例如没收录的报错）不会挡住后面能解释的那条。
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(['c', 'cpp'], {
      provideHover(document, position) {
        const picked = pickDiagnostic(
          vscode.languages.getDiagnostics(document.uri),
          position,
          (d) => resolve(d.message)
        );
        if (!picked) return null;
        const md = new vscode.MarkdownString(buildHoverMarkdown(picked.rule));
        return new vscode.Hover(md, picked.diagnostic.range);
      },
    })
  );

  // CodeAction（Ctrl+. 灯泡）：每个诊断给一条 QuickFix。
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(['c', 'cpp'], {
      provideCodeActions(document, _range, ctx) {
        const actions: vscode.CodeAction[] = [];
        for (const d of ctx.diagnostics) {
          const rule = resolve(d.message);
          if (!rule) continue;
          const a = new vscode.CodeAction(
            `📖 学长解释：${toPlain(rule.n)}`,
            vscode.CodeActionKind.QuickFix
          );
          a.diagnostics = [d];
          a.command = {
            command: CMD_EXPLAIN,
            title: '解释这条报错',
            // 传规则下标，不传整段文本：命令参数要能跨进程传递，长文本/对象都会被序列化掉。
            arguments: [RULES.indexOf(rule)],
          };
          actions.push(a);
        }
        return actions;
      },
    })
  );

  // 从命令面板直接调用时没有 ruleIndex：给一句提示，别让用户以为命令坏了。
  // （正常入口是代码旁边的灯泡 Ctrl+.，那里会带上规则下标。）
  const isRuleIndex = (v: any): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < RULES.length;
  const showPaletteHint = (): void => {
    void vscode.window.showInformationMessage(
      '请把光标放到报错处，点灯泡（Ctrl+.）选择「学长解释」。'
    );
  };

  // 点快速修复 → 侧边打开 Webview 面板（可缩放、可复制）。
  context.subscriptions.push(
    vscode.commands.registerCommand(CMD_EXPLAIN, (ruleIndex?: number) => {
      if (!isRuleIndex(ruleIndex)) {
        showPaletteHint();
        return;
      }
      showExplain(context, ruleIndex);
    })
  );

  // 同一个解释的 markdown 文本版（面板右上角「Markdown」按钮；也是真机测试断言内容的入口）
  context.subscriptions.push(
    vscode.commands.registerCommand(CMD_EXPLAIN_MD, (ruleIndex?: number) => {
      if (!isRuleIndex(ruleIndex)) {
        showPaletteHint();
        return;
      }
      void openExplainMarkdown(ruleIndex);
    })
  );
}

export function deactivate() {}
