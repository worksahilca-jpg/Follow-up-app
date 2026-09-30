/**
 * The ten seconds between pressing Send and a message reaching a real
 * customer (useUndoableSend, A-048).
 *
 * ## The bug these tests pin
 *
 * The hook's "leaving sends" effect listed the request body among its
 * dependencies, and its cleanup flushes the send. So any re-render that
 * CHANGED the body while the countdown was running was treated as the card
 * going away: the cleanup won the one-shot gate and fired the request
 * there and then, with the old text. The countdown kept drawing, Undo lost
 * the gate and did nothing, and the timer's own send was silently dropped.
 *
 * On the Inbox and on a customer's page (ReplyCard) the "$ price" blank
 * stayed editable during the countdown, and it is part of the body. An
 * owner who pressed Send, noticed "$45" should be "$450" and typed the 0
 * sent "$45" to the customer on that keystroke, with an Undo button on
 * screen that no longer undid anything.
 *
 * React itself is replaced below with the smallest hook runtime that keeps
 * its effect rules (an effect's cleanup runs when its dependencies change
 * and on unmount), because this suite runs in node without a DOM.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Slot = { value?: unknown; deps?: unknown[]; cleanup?: (() => void) | void; pending?: () => void | (() => void) };

const runtime = vi.hoisted(() => {
  const state = { slots: [] as Slot[], index: 0 };
  const depsChanged = (a: unknown[] | undefined, b: unknown[] | undefined) =>
    !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
  return { state, depsChanged };
});

vi.mock("react", () => {
  const { state, depsChanged } = runtime;
  const next = (): Slot => {
    const i = state.index++;
    state.slots[i] ??= {};
    return state.slots[i];
  };
  return {
    useState<T>(init: T | (() => T)) {
      const slot = next();
      if (!("value" in slot)) slot.value = typeof init === "function" ? (init as () => T)() : init;
      const set = (v: T | ((p: T) => T)) => {
        slot.value = typeof v === "function" ? (v as (p: T) => T)(slot.value as T) : v;
      };
      return [slot.value as T, set];
    },
    useRef<T>(init: T) {
      const slot = next();
      if (!("value" in slot)) slot.value = { current: init };
      return slot.value;
    },
    useCallback<T>(fn: T, deps: unknown[]) {
      const slot = next();
      if (depsChanged(slot.deps, deps)) {
        slot.value = fn;
        slot.deps = deps;
      }
      return slot.value as T;
    },
    useEffect(fn: () => void | (() => void), deps?: unknown[]) {
      const slot = next();
      if (depsChanged(slot.deps, deps)) {
        slot.deps = deps;
        slot.pending = fn;
      }
    },
  };
});

import { useUndoableSend } from "@/components/useUndoableSend";
import { UNDO_WINDOW_MS } from "@/lib/undoWindow";

type Props = { body: string };

function mount(initial: Props) {
  const { state } = runtime;
  state.slots = [];
  let props = initial;
  let api!: ReturnType<typeof useUndoableSend>;
  const onResponse = vi.fn();
  // Named as a component: to the hooks lint rule this is one render of one.
  const Render = () => {
    state.index = 0;
    api = useUndoableSend({ url: "/api/leads/L1/send", body: props.body, onResponse, onNetworkError: vi.fn() });
    for (const slot of state.slots) {
      if (!slot.pending) continue;
      const fn = slot.pending;
      slot.pending = undefined;
      if (typeof slot.cleanup === "function") slot.cleanup();
      slot.cleanup = fn();
    }
  };
  Render();
  return {
    get api() {
      return api;
    },
    rerender(p?: Partial<Props>) {
      props = { ...props, ...p };
      Render();
    },
    unmount() {
      for (const slot of state.slots) if (typeof slot.cleanup === "function") slot.cleanup();
    },
  };
}

const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("navigator", { sendBeacon: vi.fn() });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const sentBodies = () => (fetchMock.mock.calls as unknown as [string, RequestInit][]).map(([, init]) => init.body);

describe("useUndoableSend — the countdown is not cut short by a re-render", () => {
  it("does not send when the body changes during the countdown", () => {
    const h = mount({ body: '{"message":"It is $45"}' });
    h.api.start();
    h.rerender();
    expect(h.api.pending).toBe(true);

    // The owner corrects the price while the clock runs.
    h.rerender({ body: '{"message":"It is $450"}' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.api.pending).toBe(true);
  });

  it("Undo still stops it after such a re-render, and nothing is sent", () => {
    const h = mount({ body: '{"message":"It is $45"}' });
    h.api.start();
    h.rerender();
    h.rerender({ body: '{"message":"It is $450"}' });

    h.api.undo();
    h.rerender();
    vi.advanceTimersByTime(UNDO_WINDOW_MS + 1000);
    h.rerender();
    h.unmount();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.api.cancelled).toBe(true);
  });

  it("sends exactly once when the clock runs out, with what was on screen at the press", () => {
    const h = mount({ body: '{"message":"It is $450"}' });
    h.api.start();
    h.rerender();
    h.rerender({ body: '{"message":"It is $4500"}' });

    vi.advanceTimersByTime(UNDO_WINDOW_MS + 500);
    h.rerender();
    h.unmount();

    expect(sentBodies()).toEqual(['{"message":"It is $450"}']);
  });

  it("leaving the page mid-countdown still sends, once (guarantee 3 is unchanged)", () => {
    const h = mount({ body: '{"message":"Hi"}' });
    h.api.start();
    h.rerender();
    h.unmount();
    vi.advanceTimersByTime(UNDO_WINDOW_MS + 500);

    expect(sentBodies()).toEqual(['{"message":"Hi"}']);
  });
});
