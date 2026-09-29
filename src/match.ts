import { RULES } from './rules';

/**
 * 纯函数：报错文本 → 命中规则（等价网页版 RULES.find 行为）。
 * 用 message.toLowerCase() 逐个规则、逐个关键词做子串匹配，首个命中即返回。
 * 抽成独立模块（不 import vscode），便于 node 直接 require 编译产物做单测。
 */
export function matchError(message: string): any | null {
  const low = message.toLowerCase();
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
