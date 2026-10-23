// Hover 选诊断的纯逻辑（不 import vscode，方便 node 直接 require 编译产物做单测）。
//
// 背景：同一位置可能同时挂着 Error 和 Warning（例如「未使用变量」+「类型不匹配」），
// VS Code 的 getDiagnostics 数组顺序不保证严重度优先。这里统一做：
//   1. 收集所有「范围包含光标」的诊断（端点算包含，和 VS Code Range.contains 一致）；
//   2. 按 severity 排序 Error(0) > Warning(1) > Information(2) > Hint(3)；
//   3. 同一 severity 保持原数组顺序（稳定）；
//   4. 从高到低找第一条能匹配到规则的诊断 —— 匹配不到的高严重度诊断不会挡住后面的。

export interface PositionLike {
  line: number;
  character: number;
}

export interface RangeLike {
  start: PositionLike;
  end: PositionLike;
}

export interface DiagnosticLike {
  range: RangeLike;
  severity?: number;
  message?: string;
}

/** 等价于 VS Code Range.contains(position)：行/列都在范围内，端点包含。 */
export function rangeContainsPosition(range: RangeLike, position: PositionLike): boolean {
  if (position.line < range.start.line || position.line > range.end.line) return false;
  if (position.line === range.start.line && position.character < range.start.character) return false;
  if (position.line === range.end.line && position.character > range.end.character) return false;
  return true;
}

/** severity 可能是 undefined（少见）；排到最后，不抢任何已知严重度的位置。 */
function severityRank(d: DiagnosticLike): number {
  return typeof d.severity === 'number' && isFinite(d.severity) ? d.severity : Number.MAX_SAFE_INTEGER;
}

/** 与光标相交的诊断，按严重度从高到低、同严重度保持原顺序返回。 */
export function diagnosticsAtPosition<T extends DiagnosticLike>(
  diagnostics: readonly T[],
  position: PositionLike
): T[] {
  return diagnostics
    .map((diagnostic, index) => ({ diagnostic, index }))
    .filter((x) => rangeContainsPosition(x.diagnostic.range, position))
    .sort((a, b) => {
      const bySeverity = severityRank(a.diagnostic) - severityRank(b.diagnostic);
      return bySeverity !== 0 ? bySeverity : a.index - b.index;
    })
    .map((x) => x.diagnostic);
}

/**
 * 从高严重度到低严重度找第一条能解析出规则的诊断。
 * resolve 返回空（null/undefined）表示这条诊断没有对应规则，继续往下找。
 */
export function pickDiagnostic<T extends DiagnosticLike, R>(
  diagnostics: readonly T[],
  position: PositionLike,
  resolve: (diagnostic: T) => R | null | undefined
): { diagnostic: T; rule: R } | null {
  for (const diagnostic of diagnosticsAtPosition(diagnostics, position)) {
    const rule = resolve(diagnostic);
    if (rule) return { diagnostic, rule };
  }
  return null;
}
