# 更新日志

## 0.1.1 — 2026-09-30

只改了说明文案（扩展功能与规则库无变化）：安装方式改成「扩展市场优先」（`code --install-extension xiaogaokunkun.c-error-helper`），补上市场徽章和条目链接。

- 上架 VS Code 扩展市场：<https://marketplace.visualstudio.com/items?itemName=xiaogaokunkun.c-error-helper>

## 0.1.0 — 2026-09-29

首个版本。

- **悬停中文解释**：光标停在报错波浪线上，直接显示「错在哪 + 为什么 + 怎么改」（其中 11 条规则另附「正确写法」对照示例）。
- **`Ctrl+.` 快速修复**：菜单里出现「📖 学长解释：xxx」，点一下在侧边打开完整解释文档（Markdown，可复制、可 `Ctrl+Shift+V` 预览）。
- **36 条规则**：全角标点、整数除法、`if` 里把 `==` 写成 `=`、`scanf` 漏 `&`、`for` 里分号写成逗号、数组越界、变量未初始化……每条都来自真实踩坑。
- **纯本地离线**：关键词匹配，毫秒级出结果，不联网、不登录、代码不出本机。
- 同时认 GCC / Dev-C++ 与 VS Code C/C++ 扩展（IntelliSense）两套报错措辞。

### 已知限制

- 只处理 `.c` / `.cpp` 文件。
- 报错本身由 VS Code 的 C/C++ 扩展（`ms-vscode.cpptools`）产生，本扩展只负责翻译；需要把编译器路径配到工作区（README 有说明）。
- `expected a ';'` 这类报错文本同时对应「上一行漏分号」和「`for` 里分号写成逗号」，纯文本分不开，已在改法里同时给出两种提示。
