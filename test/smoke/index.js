// 真机冒烟：在 VS Code 的 extension host 里加载本扩展，调真实 API 验证 hover / 快速修复接线。
// 由 Code.exe --extensionDevelopmentPath=... --extensionTestsPath=<本文件> 拉起。
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const OUT = process.env.CEH_SMOKE_OUT || path.join(__dirname, 'smoke-result.json');

function txt(c) {
  return typeof c === 'string' ? c : (c && c.value) || '';
}

async function run() {
  const rows = [];
  const t = (name, ok, extra) =>
    rows.push({ name, ok: !!ok, extra: extra === undefined ? '' : String(extra) });

  try {
    const ext = vscode.extensions.getExtension('xiaogaokunkun.c-error-helper');
    t('扩展被 VS Code 加载', !!ext);
    if (ext) {
      await ext.activate();
      t('扩展 activate() 成功', true);
    }

    const cmds = await vscode.commands.getCommands(true);
    t('命令 cErrorHelper.explain 已注册', cmds.includes('cErrorHelper.explain'));

    const doc = await vscode.workspace.openTextDocument({
      language: 'c',
      content: '#include <stdio.h>\nint main(){\n  printf("hi")\n  return 0;\n}\n',
    });
    await vscode.window.showTextDocument(doc);
    t('打开 .c 文档 (languageId=' + doc.languageId + ')', doc.languageId === 'c');

    const coll = vscode.languages.createDiagnosticCollection('ceh-smoke');
    const R = new vscode.Range(2, 9, 2, 13);
    const POS = new vscode.Position(2, 10);
    const hoverAt = async () =>
      ((await vscode.commands.executeCommand('vscode.executeHoverProvider', doc.uri, POS)) || [])
        .map((h) => (h.contents || []).map(txt).join('\n'))
        .join('\n');

    // ---- 场景 1：gcc 原文报错 ----
    coll.set(doc.uri, [
      new vscode.Diagnostic(R, "main.c:3:1: error: expected ';' before '}' token", vscode.DiagnosticSeverity.Error),
    ]);
    await new Promise((r) => setTimeout(r, 300));

    const h1 = await hoverAt();
    t('Hover 有内容', h1.length > 0, h1.slice(0, 140).replace(/\n/g, ' / '));
    t('Hover 命中「上一行末尾漏了分号」', h1.includes('上一行末尾漏了分号'));
    t('Hover 带「怎么改」建议', h1.includes('怎么改'));

    const acts =
      (await vscode.commands.executeCommand(
        'vscode.executeCodeActionProvider',
        doc.uri,
        R,
        vscode.CodeActionKind.QuickFix.value
      )) || [];
    const act = acts.find((a) => String(a.title || '').includes('学长解释'));
    t('Ctrl+. 灯泡给出快速修复', !!act, act ? act.title : '返回 ' + acts.length + ' 条');
    t('快速修复绑定 cErrorHelper.explain', !!(act && act.command && act.command.command === 'cErrorHelper.explain'));

    // ---- 场景 1b：点那条快速修复 → 侧边打开完整解释 ----
    if (act && act.command) {
      await vscode.commands.executeCommand('cErrorHelper.explain', act.command.arguments[0]);
      await new Promise((r) => setTimeout(r, 500));
      const ed = vscode.window.activeTextEditor;
      const edText = ed ? ed.document.getText() : '';
      t(
        '快速修复在侧边打开解释文档',
        !!ed && edText.length > 0,
        ed ? ed.document.languageId + ' / ' + edText.split('\n')[0] : '无活动编辑器'
      );
      t('解释文档是 markdown（Ctrl+Shift+V 可预览）', !!ed && ed.document.languageId === 'markdown');
      t(
        '解释文档含完整中文解释+改法',
        edText.includes('上一行末尾漏了分号') && edText.includes('怎么改'),
        edText.split('\n').slice(0, 2).join(' / ')
      );
    }

    // ---- 场景 2：IntelliSense 措辞 ----
    coll.set(doc.uri, [
      new vscode.Diagnostic(R, "use of undeclared identifier 'scanf'", vscode.DiagnosticSeverity.Error),
    ]);
    await new Promise((r) => setTimeout(r, 300));
    const h2 = await hoverAt();
    t('IntelliSense 措辞也命中中文解释', h2.includes('用了一个没声明的变量名'), h2.slice(0, 140).replace(/\n/g, ' / '));

    // ---- 场景 3：无关报错不瞎解释 ----
    coll.set(doc.uri, [
      new vscode.Diagnostic(R, 'zzz totally unknown diagnostic', vscode.DiagnosticSeverity.Error),
    ]);
    await new Promise((r) => setTimeout(r, 300));
    const h3 = ((await vscode.commands.executeCommand('vscode.executeHoverProvider', doc.uri, POS)) || []).length;
    t('无关报错不返回解释', h3 === 0, '返回 ' + h3 + ' 条');

    coll.dispose();
  } catch (e) {
    t('冒烟过程中抛异常: ' + (e && e.message), false, e && e.stack);
  }

  const bad = rows.filter((r) => !r.ok).length;
  fs.writeFileSync(OUT, JSON.stringify({ pass: rows.length - bad, fail: bad, rows }, null, 2), 'utf8');
  if (bad) throw new Error(bad + ' 项冒烟未通过（详见 ' + OUT + '）');
}

module.exports = { run };
