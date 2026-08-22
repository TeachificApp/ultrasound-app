import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

const mocks = vi.hoisted(() => ({
  sent: [] as string[],
  startSession: vi.fn(),
  nextQuestion: vi.fn(),
  endSession: vi.fn(),
  socket: null as any,
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 77, name: "Teach Educator" } }) }));
vi.mock("wouter", () => ({ useRoute: (pattern: string) => [pattern === "/teach/games/host/:sessionId", pattern === "/teach/games/host/:sessionId" ? { sessionId: "101" } : null] }));
vi.mock("qrcode.react", () => ({ QRCodeSVG: () => React.createElement("div", { "data-testid": "qr-code" }) }));
vi.mock("sonner", () => ({ toast: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ sonoQuiz: { getSession: { invalidate: vi.fn() } } }),
    sonoQuiz: {
      getSession: { useQuery: () => ({ data: { session: { joinCode: "TEACH1", status: "lobby", quizSnapshot: JSON.stringify({ quiz: { title: "Valve Review", isTeachGame: true, questionCount: 2, timeLimitSeconds: 20, theme: "teal" } }) } }, isLoading: false }) },
      getLiveResponseSummary: { useQuery: () => ({ data: { responseCount: 2, words: [{ word: "mitral", count: 2 }] } }) },
      startSession: { useMutation: () => ({ isPending: false, mutate: mocks.startSession }) },
      advanceQuestion: { useMutation: () => ({ mutate: mocks.nextQuestion }) },
      endSession: { useMutation: () => ({ mutate: mocks.endSession }) },
    },
  },
}));

class FakeWebSocket {
  static OPEN = 1;
  readyState = 1;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor() { mocks.socket = this; setTimeout(() => this.onopen?.(), 0); }
  send(message: string) { mocks.sent.push(message); }
  close() { this.onclose?.(); }
  emit(message: unknown) { this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent); }
}

describe("Teach host route interaction", () => {
  afterEach(() => {
    mocks.sent.length = 0;
    mocks.startSession.mockReset();
    mocks.nextQuestion.mockReset();
    mocks.endSession.mockReset();
    delete (globalThis as any).window;
    delete (globalThis as any).document;
    delete (globalThis as any).location;
    delete (globalThis as any).addEventListener;
    delete (globalThis as any).removeEventListener;
    delete (globalThis as any).WebSocket;
  });

  it("mounts the real Teach host, starts a session, and renders a live word-cloud result", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://learn.allaboutultrasound.com/teach/games/host/101" });
    (globalThis as any).window = dom.window;
    (globalThis as any).document = dom.window.document;
    (globalThis as any).location = dom.window.location;
    (globalThis as any).addEventListener = dom.window.addEventListener.bind(dom.window);
    (globalThis as any).removeEventListener = dom.window.removeEventListener.bind(dom.window);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    Object.assign(window, { WebSocket: FakeWebSocket });
    (globalThis as any).WebSocket = FakeWebSocket;
    const { default: SonoQuizHost } = await import("../client/src/pages/SonoQuizHost");
    const container = document.createElement("div"); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(React.createElement(SonoQuizHost)); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
    expect(container.textContent).toContain("Teach Live Game Host");
    expect(container.textContent).toContain("TEACH1");
    const start = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Start Quiz")) as HTMLButtonElement;
    await act(async () => start.click());
    expect(mocks.startSession).toHaveBeenCalledWith({ sessionId: 101 });
    expect(mocks.sent.some((message) => message.includes("host_start"))).toBe(true);
    await act(async () => { mocks.socket.emit({ type: "question_started", questionIndex: 0, totalQuestions: 2, timeLimitSeconds: 20, question: { id: 4, question: "Name the valve", interactionType: "word_cloud", points: 0, options: "[]" } }); });
    expect(container.textContent).toContain("Word cloud responses");
    expect(container.textContent).toContain("mitral");
    const reveal = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Reveal Answers")) as HTMLButtonElement;
    await act(async () => reveal.click());
    expect(container.textContent).toContain("Next Question");
    await act(async () => { mocks.socket.emit({ type: "leaderboard", leaderboard: [{ participantId: 3, displayName: "Learner", totalScore: 120, correctAnswers: 1 }] }); });
    expect(container.textContent).toContain("Leaderboard");
    expect(container.textContent).toContain("Learner");
    await act(async () => { mocks.socket.emit({ type: "question_started", questionIndex: 1, totalQuestions: 2, timeLimitSeconds: 20, question: { id: 5, question: "Point to the valve", interactionType: "hotspot", points: 100, options: "[]" } }); });
    expect(container.textContent).toContain("Hotspot responses");
    expect(container.textContent).toMatch(/2\s*group responses collected/);
    const next = [...container.querySelectorAll("button")].find((button) => button.textContent?.trim().startsWith("Next")) as HTMLButtonElement;
    await act(async () => next.click());
    expect(mocks.nextQuestion).toHaveBeenCalledWith({ sessionId: 101 }, expect.any(Object));
    (globalThis as any).confirm = () => true;
    const end = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("End")) as HTMLButtonElement;
    await act(async () => end.click());
    expect(mocks.endSession).toHaveBeenCalledWith({ sessionId: 101 });
    expect(mocks.sent.some((message) => message.includes("host_end_session"))).toBe(true);
    await act(async () => {
      root.unmount();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });
});
