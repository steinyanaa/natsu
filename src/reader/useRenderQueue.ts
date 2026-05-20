import { useEffect, useMemo } from "react";

export type QueuedRenderTask<T = void> = {
  promise: Promise<T>;
  cancel: () => void;
};

type PendingTask<T> = {
  run: (signal: AbortSignal) => Promise<T> | T;
  controller: AbortController;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  started: boolean;
  settled: boolean;
};

function createCancelError() {
  return new DOMException("Render task was cancelled", "AbortError");
}

export function createRenderQueue(concurrency = 2) {
  const maxConcurrent = Math.max(1, Math.floor(concurrency));
  const pending: PendingTask<unknown>[] = [];
  const active = new Set<PendingTask<unknown>>();
  let activeCount = 0;
  let disposed = false;

  const pump = () => {
    if (disposed) return;

    while (activeCount < maxConcurrent) {
      const task = pending.shift();
      if (!task) return;
      if (task.controller.signal.aborted) {
        if (!task.settled) {
          task.settled = true;
          task.reject(createCancelError());
        }
        continue;
      }

      task.started = true;
      active.add(task);
      activeCount += 1;

      Promise.resolve()
        .then(() => task.run(task.controller.signal))
        .then(
          (value) => {
            if (!task.settled) {
              task.settled = true;
              task.resolve(value);
            }
          },
          (error) => {
            if (!task.settled) {
              task.settled = true;
              task.reject(error);
            }
          }
        )
        .finally(() => {
          active.delete(task);
          activeCount = Math.max(0, activeCount - 1);
          pump();
        });
    }
  };

  return {
    enqueue<T>(run: (signal: AbortSignal) => Promise<T> | T): QueuedRenderTask<T> {
      if (disposed) {
        return {
          promise: Promise.reject(createCancelError()),
          cancel: () => undefined
        };
      }

      let task: PendingTask<T>;
      const promise = new Promise<T>((resolve, reject) => {
        task = {
          run,
          controller: new AbortController(),
          resolve,
          reject,
          started: false,
          settled: false
        };
      });

      pending.push(task! as PendingTask<unknown>);
      pump();

      return {
        promise,
        cancel: () => {
          if (task!.settled) return;
          task!.controller.abort();

          if (!task!.started) {
            const index = pending.indexOf(task! as PendingTask<unknown>);
            if (index >= 0) {
              pending.splice(index, 1);
            }
            task!.settled = true;
            task!.reject(createCancelError());
          }
        }
      };
    },
    dispose() {
      disposed = true;
      for (const task of pending.splice(0)) {
        if (!task.settled) {
          task.controller.abort();
          task.settled = true;
          task.reject(createCancelError());
        }
      }
      for (const task of active) {
        if (!task.settled) {
          task.controller.abort();
        }
      }
    }
  };
}

export type RenderQueue = ReturnType<typeof createRenderQueue>;

export function useRenderQueue(concurrency = 2) {
  const queue = useMemo(() => createRenderQueue(concurrency), [concurrency]);

  useEffect(() => () => queue.dispose(), [queue]);

  return queue;
}
