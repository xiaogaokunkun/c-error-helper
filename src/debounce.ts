// 可释放的防抖器（不 import vscode，方便 node 直接 require 编译产物做单测）。
//
// 原实现把 timer 闭包在 activate 里，deactivate 时没人清：扩展卸载/重载时
// 还可能有一个 150ms 的回调悬着。抽成对象后直接塞进 context.subscriptions，
// VS Code 在 deactivate 时会调用它的 dispose()。

export interface Debounced {
  /** 安排一次执行（会重置倒计时） */
  schedule(): void;
  /** 取消尚未触发的执行 */
  cancel(): void;
  /** 同 cancel，供 context.subscriptions 在扩展停用时调用 */
  dispose(): void;
  /** 是否有等待触发的回调（单测用） */
  pending(): boolean;
}

export function createDebounced(delay: number, run: () => void): Debounced {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return {
    schedule(): void {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        run();
      }, delay);
    },
    cancel,
    dispose: cancel,
    pending(): boolean {
      return timer !== undefined;
    },
  };
}
