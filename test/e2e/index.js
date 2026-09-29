// 端到端：不注入任何人造诊断，让真实 C/C++ 扩展(ms-vscode.cpptools)去分析一个写错的 .c，
// 然后看装了 vsix 的 c-error-helper 能不能把那堆英文报错 hover 成中文。
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const OUT = process.env.CEH_E2E_OUT || path.join(__dirname, 'e2e-result.json');
const WORK = process.env.CEH_E2E_WORK || path.join(__dirname, '..', 'workspace');
let BAD_C = path.join(WORK, 'bad.c');

// 第 3 行末尾故意漏分号（最经典的新手错）
const SRC = [
  '#include <stdio.h>',
  'int main() {',
  '  int a = 1',
  '  printf("%d\\n", a);',
  '  return 0;',
  '}',
  '',
].join('\n');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const rows = [];
  const t = (name, ok, extra) =>
    rows.push({ name, ok: !!ok, extra: extra === undefined ? '' : String(extra) });

  try {
    fs.mkdirSync(WORK, { recursive: true });
    if (process.env.CEH_E2E_USE_EXISTING === '1') {
      const all = fs.readdirSync(WORK).filter((f) => f.toLowerCase().endsWith('.c'));
      const pick = all.find((f) => /报错|测试|bad|wrong/i.test(f)) || all[0];
      if (!pick) throw new Error('工作区里没有 .c 文件: ' + WORK);
      BAD_C = path.join(WORK, pick);
    } else {
      fs.writeFileSync(BAD_C, SRC, 'utf8');
    }

    if (!vscode.workspace.workspaceFolders || !vscode.workspace.workspaceFolders.length) {
      vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.file(WORK), name: 'ceh-e2e' });
      await sleep(2000);
    }

    const ext = vscode.extensions.getExtension('xiaogaokunkun.c-error-helper');
    t('已安装的 c-error-helper 被加载', !!ext);
    if (ext && !ext.isActive) await ext.activate();

    const cpp = vscode.extensions.getExtension('ms-vscode.cpptools');
    t('C/C++ 扩展(ms-vscode.cpptools)在位', !!cpp, cpp ? 'v' + cpp.packageJSON.version : '');

    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(BAD_C));
    await vscode.window.showTextDocument(doc);
    t('打开磁盘上的 bad.c (languageId=' + doc.languageId + ')', doc.languageId === 'c');

    // 等 C/C++ 扩展出诊断（首次初始化 IntelliSense 要几秒）
    let diags = vscode.languages.getDiagnostics(doc.uri);
    const deadline = Date.now() + 60000;
    while ((!diags || !diags.length) && Date.now() < deadline) {
      await sleep(1000);
      diags = vscode.languages.getDiagnostics(doc.uri);
    }
    t(
      '真实报错出现（C/C++ 扩展的英文诊断）',
      !!diags && diags.length > 0,
      (diags || []).map((d) => d.message).join(' | ').slice(0, 220)
    );

    // 逐个诊断试 hover，看有没有被翻成中文（先预热一次：cpptools 首帧解析慢，会让第一次请求超时返回空）
    const dbg = [];
    let hit = '';
    let hitMsg = '';
    for (const d of diags || []) {
      const ask = async () => {
        const hovers =
          (await vscode.commands.executeCommand('vscode.executeHoverProvider', doc.uri, d.range.start)) || [];
        return hovers
          .map((h) => (h.contents || []).map((c) => (typeof c === 'string' ? c : c.value || '')).join('\n'))
          .join('\n');
      };
      await ask();
      await sleep(300);
      const text = await ask();
      dbg.push({
        diag: d.message.slice(0, 120),
        range:
          d.range.start.line + ':' + d.range.start.character + '-' + d.range.end.line + ':' + d.range.end.character,
        hover: text ? text.slice(0, 200).replace(/\n/g, ' / ') : '(空)',
      });
      if (text && /怎么改|漏了分号|没声明|括号|头文件/.test(text)) {
        hit = text;
        hitMsg = d.message;
        break;
      }
    }
    fs.writeFileSync(path.join(path.dirname(OUT), 'hover-debug.json'), JSON.stringify(dbg, null, 2), 'utf8');
    t(
      '英文报错的 hover 被翻成中文解释',
      hit.length > 0,
      hit ? '【' + hitMsg.slice(0, 60) + '】→ ' + hit.slice(0, 160).replace(/\n/g, ' / ') : '没有任何诊断命中规则'
    );

    // 顺带：Ctrl+. 灯泡在这份真实文件里也应有「学长解释」
    let actTitle = '';
    for (const d of diags || []) {
      const acts =
        (await vscode.commands.executeCommand(
          'vscode.executeCodeActionProvider',
          doc.uri,
          d.range,
          vscode.CodeActionKind.QuickFix.value
        )) || [];
      const a = acts.find((x) => String(x.title || '').includes('学长解释'));
      if (a) {
        actTitle = a.title;
        break;
      }
    }
    t('真实文件里 Ctrl+. 也有「学长解释」', !!actTitle, actTitle);
  } catch (e) {
    t('e2e 抛异常: ' + (e && e.message), false, e && e.stack);
  }

  const bad = rows.filter((r) => !r.ok).length;
  fs.writeFileSync(OUT, JSON.stringify({ pass: rows.length - bad, fail: bad, rows }, null, 2), 'utf8');
  if (bad) throw new Error(bad + ' 项 e2e 未通过（详见 ' + OUT + '）');
}

module.exports = { run };
