import { RULES } from './rules';

/**
 * 匹配前的消息规范化：把 IntelliSense / 编译器消息里「跟报错本身无关」的装饰去掉，
 * 再做关键词子串匹配。只处理字符串，不改 rules.ts 里的任何规则文案。
 *
 * 为什么不能无脑剥所有尾部括号：规则里 "undeclared (first use in this function)"
 * 的括号本身就是关键词；只剥 dependency of / included from / no directories 这类备注。
 */
export function normalizeMessage(message: string): string {
  let s = message == null ? '' : String(message);

  // 1) 中文引号 / 全角括号 → 半角（规则关键词用的都是半角符号）
  s = s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\uff08/g, '(')
    .replace(/\uff09/g, ')');

  // 2) 去掉尾部括号备注（可能叠加多层，循环剥干净）
  //    例：cannot open source file "a.h" (dependency of "main.c")
  //        could not open source file "stdio.h" (no directories in search list)
  //        /usr/include/a.h (included from "main.c")
  let prev: string;
  do {
    prev = s;
    s = s.replace(
      /\s*\((?:dependency of|included from|no directories in search list)\b[^()]*\)\s*$/i,
      ''
    );
  } while (s !== prev);

  // 3) 绝对路径前缀只留文件名 —— 否则路径里的目录名可能命中别的规则
  //    （例如 C:\work\stray\foo.h 里的 stray 会把「中文全角字符」规则骗出来）。
  // 3a) 带引号的 Windows 路径（允许路径里含空格）："C:\Program Files\inc\a.h" → "a.h"
  s = s.replace(/"([A-Za-z]:[\\/][^"]*[\\/])([^\\/":]+)"/g, '"$2"');
  // 3b) 不带引号的 Windows 路径：C:\work\inc\a.h → a.h
  s = s.replace(
    /(^|[\s('])([A-Za-z]:[\\/](?:[^\\/\s()'":]+[\\/])*)([^\\/\s()'":]+)/g,
    '$1$3'
  );
  // 3c) Unix 绝对路径：/usr/include/stdio.h → stdio.h
  s = s.replace(
    /(^|[\s('"])((?:\/[^\/\s()'"]+)+)\/([^\/\s()'":]+)/g,
    '$1$3'
  );

  // 4) IntelliSense 的「分号缺失」措辞归一成规则里已有的关键词
  //    例：expected ';' at end of declaration → expected ';' before
  s = s.replace(
    /\bexpected\s+';'\s+at\s+end\s+of\s+(?:declaration|input)\b/gi,
    "expected ';' before"
  );

  return s.trim();
}

/**
 * 纯函数：报错文本 → 命中规则（等价网页版 RULES.find 行为）。
 * 先规范化消息，再用 message.toLowerCase() 逐个规则、逐个关键词做子串匹配，首个命中即返回。
 * 抽成独立模块（不 import vscode），便于 node 直接 require 编译产物做单测。
 */
export function matchError(message: string): any | null {
  const low = normalizeMessage(message).toLowerCase();
  for (const r of RULES) {
    const ks: string[] = Array.isArray(r.k) ? r.k : [];
    for (const k of ks) {
      if (low.includes(String(k).toLowerCase())) {
        return r;
      }
    }
  }
  return null;
}

export { RULES };
