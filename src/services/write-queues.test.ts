import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  enqueueConfigWrite,
  flushConfigQueue,
} from "./config-write-queue";
import {
  enqueueEntitiesWrite,
  flushEntitiesQueue,
} from "./entities-write-queue";
import {
  enqueueHorizonWrite,
  flushHorizonQueue,
} from "./horizon-write-queue";
import {
  enqueuePoolWrite,
  flushPoolQueue,
} from "./pool-write-queue";
import {
  enqueueWeekWrite,
  flushWeekQueue,
} from "./week-write-queue";

// Five write queues share two shapes: global (single chain) and
// per-key (Map of chains). Every queue has the same invariants —
// serial order, value/error propagation, and chain survival after a
// rejected write. The recovery branch is the one we're really here
// to pin: `inflight = next.catch(() => undefined)` looks like dead
// defensive code, so it is exactly the line a future refactor is
// most likely to delete. Without it, one thrown write freezes every
// subsequent write to that queue silently.

type GlobalQueue = {
  name: string;
  enqueue: <T>(fn: () => Promise<T>) => Promise<T>;
  flush: () => Promise<void>;
};

type KeyedQueue = {
  name: string;
  enqueue: <T>(key: string, fn: () => Promise<T>) => Promise<T>;
  flush: () => Promise<void>;
};

const globalQueues: GlobalQueue[] = [
  {
    name: "entities",
    enqueue: enqueueEntitiesWrite,
    flush: flushEntitiesQueue,
  },
  { name: "config", enqueue: enqueueConfigWrite, flush: flushConfigQueue },
  {
    name: "horizon",
    enqueue: enqueueHorizonWrite,
    flush: flushHorizonQueue,
  },
];

const keyedQueues: KeyedQueue[] = [
  { name: "pool", enqueue: enqueuePoolWrite, flush: flushPoolQueue },
  { name: "week", enqueue: enqueueWeekWrite, flush: flushWeekQueue },
];

describe.each(globalQueues)(
  "$name write queue (global)",
  ({ enqueue, flush }) => {
    // The chain is module-level state. Drain before and after so a
    // leftover pending write from a prior test cannot bleed into the
    // next one and show up as an unhandled rejection.
    beforeEach(() => flush());
    afterEach(() => flush());

    it("resolves with the value returned by fn", async () => {
      const result = await enqueue(async () => 42);
      expect(result).toBe(42);
    });

    it("rejects with the error thrown by fn", async () => {
      await expect(
        enqueue(async () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
    });

    it("serializes calls in submission order", async () => {
      const log: number[] = [];
      let release: () => void = () => {};
      const blocker = new Promise<void>((r) => {
        release = r;
      });
      const p1 = enqueue(async () => {
        await blocker;
        log.push(1);
      });
      const p2 = enqueue(async () => {
        log.push(2);
      });
      release();
      await Promise.all([p1, p2]);
      expect(log).toEqual([1, 2]);
    });

    // The critical invariant for the data-corruption story.
    it("does not freeze after a rejected write", async () => {
      await expect(
        enqueue(async () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
      const result = await enqueue(async () => "alive");
      expect(result).toBe("alive");
    });

    it("survives several consecutive rejections", async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          enqueue(async () => {
            throw new Error(`fail-${i}`);
          }),
        ).rejects.toThrow(`fail-${i}`);
      }
      const result = await enqueue(async () => "ok");
      expect(result).toBe("ok");
    });
  },
);

describe.each(keyedQueues)(
  "$name write queue (per-key)",
  ({ enqueue, flush }) => {
    beforeEach(() => flush());
    afterEach(() => flush());

    it("resolves with the value returned by fn", async () => {
      const result = await enqueue("k1", async () => 42);
      expect(result).toBe(42);
    });

    it("serializes calls within the same key", async () => {
      const log: number[] = [];
      let release: () => void = () => {};
      const blocker = new Promise<void>((r) => {
        release = r;
      });
      const p1 = enqueue("k1", async () => {
        await blocker;
        log.push(1);
      });
      const p2 = enqueue("k1", async () => {
        log.push(2);
      });
      release();
      await Promise.all([p1, p2]);
      expect(log).toEqual([1, 2]);
    });

    it("does not block one key behind another", async () => {
      let release: () => void = () => {};
      const blocker = new Promise<void>((r) => {
        release = r;
      });
      const a = enqueue("k-a", async () => {
        await blocker;
        return "a";
      });
      // k-b must complete while k-a is still held.
      const b = await enqueue("k-b", async () => "b");
      expect(b).toBe("b");
      release();
      await expect(a).resolves.toBe("a");
    });

    it("does not freeze a key after a rejected write", async () => {
      await expect(
        enqueue("k1", async () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
      const result = await enqueue("k1", async () => "alive");
      expect(result).toBe("alive");
    });

    it("isolates failures between keys", async () => {
      await expect(
        enqueue("k-a", async () => {
          throw new Error("a-boom");
        }),
      ).rejects.toThrow("a-boom");
      const result = await enqueue("k-b", async () => "b-ok");
      expect(result).toBe("b-ok");
    });
  },
);
