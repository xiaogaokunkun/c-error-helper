import * as vscode from 'vscode';
import { matchError } from './match';

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

function buildHoverMarkdown(rule: any): string {
  const badge = rule.s === 'e' ? '❌ 错误' : (rule.s === 'w' ? '⚠️ 警告' : 'ℹ️ 提示');
  const lines: string[] = [];
  lines.push(`**${htmlToMarkdown(rule.n)}**  ${badge}`);
  if (rule.why) {
    lines.push('');
    lines.push(htmlToMarkdown(rule.why));
  }
  if (rule.fix && rule.fix.length) {
    lines.push('');
    lines.push('**怎么改：**');
    for (const f of rule.fix) lines.push(`- ${htmlToMarkdown(f)}`);
  }
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

// 「解释」面板：复用同一个 untitled markdown 文档，避免每点一次就堆一个标签页。
// 用文档而不是右下角通知条——通知条会把多行解释挤成一条、截断看不全。
let panel: vscode.TextDocument | undefined;

async function showExplain(markdown: string): Promise<void> {
  if (panel && panel.isClosed) panel = undefined;
  if (!panel) {
    panel = await vscode.workspace.openTextDocument({ language: 'markdown', content: markdown });
    await vscode.window.showTextDocument(panel, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: true,
    });
    return;
  }
  const editor = await vscode.window.showTextDocument(panel, {
    viewColumn: vscode.ViewColumn.Beside,
    preview: true,
  });
  const lastLine = panel.lineCount;
  await editor.edit((b) => b.replace(new vscode.Range(0, 0, lastLine, 0), markdown));
}

export function activate(context: vscode.ExtensionContext) {
  // 命中缓存（message → rule），供 Hover / CodeAction 复用。
  const memo = new Map<string, any>();
  const resolve = (msg: string): any | null => {
    if (!memo.has(msg)) memo.set(msg, matchError(msg));
    return memo.get(msg) || null;
  };

  // 核心监听：onDidChangeDiagnostics，仅 c/cpp，防抖 150ms。
  let timer: NodeJS.Timeout | undefined;
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics((e) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        for (const uri of e.uris) {
          const doc = vscode.workspace.textDocuments.find(
            (d) => d.uri.toString() === uri.toString()
          );
          if (!doc) continue;
          if (doc.languageId !== 'c' && doc.languageId !== 'cpp') continue;
          for (const d of vscode.languages.getDiagnostics(uri)) {
            resolve(d.message);
          }
        }
      }, 150);
    })
  );

  // Hover：光标落在诊断范围内时显示中文解释。
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(['c', 'cpp'], {
      provideHover(document, position) {
        const diag = vscode.languages
          .getDiagnostics(document.uri)
          .find((d) => d.range.contains(position));
        if (!diag) return null;
        const rule = resolve(diag.message);
        if (!rule) return null;
        const md = new vscode.MarkdownString(buildHoverMarkdown(rule));
        return new vscode.Hover(md, diag.range);
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
            arguments: [buildHoverMarkdown(rule)],
          };
          actions.push(a);
        }
        return actions;
      },
    })
  );

  // 点击 QuickFix 后，在侧边打开完整中文解释（可选中复制，Ctrl+Shift+V 还能预览）。
  context.subscriptions.push(
    vscode.commands.registerCommand(CMD_EXPLAIN, (markdown: string) => showExplain(markdown))
  );
}

export function deactivate() {}
