import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

const mocks = vi.hoisted(() => ({ join: vi.fn(), submit: vi.fn(), socket: null as any }));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("wouter", () => ({ useRoute: (pattern: string) => [pattern === "/quiz/:joinCode", pattern === "/quiz/:joinCode" ? { joinCode: "teach1" } : null] }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    sonoQuiz: {
      joinSession: { useMutation: (options: any) => ({ isPending: false, mutate: (input: any) => { mocks.join(input); options.onSuccess({ sessionId: 101, participantId: 202, quizTitle: "Valve Review", musicTrack: null, theme: "teal", isTeachGame: true }); } }) },
      submitAnswer: { useMutation: (options: any) => ({ mutate: (input: any) => { mocks.submit(input); options.onSuccess({ pointsEarned: 0, isCorrect: false }); } }) },
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
  send() {}
  close() { this.onclose?.(); }
  emit(message: unknown) { this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent); }
}

describe("Teach participant route interaction", () => {
  afterEach(() => {
    mocks.join.mockReset(); mocks.submit.mockReset();
    delete (globalThis as any).window; delete (globalThis as any).document; delete (globalThis as any).location;
    delete (globalThis as any).WebSocket; delete (globalThis as any).addEventListener; delete (globalThis as any).removeEventListener;
  });

  it("joins a Teach PIN session, renders media, and submits a hotspot response", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://learn.allaboutultrasound.com/quiz/TEACH1" });
    (globalThis as any).window = dom.window; (globalThis as any).document = dom.window.document; (globalThis as any).location = dom.window.location;
    (globalThis as any).addEventListener = dom.window.addEventListener.bind(dom.window); (globalThis as any).removeEventListener = dom.window.removeEventListener.bind(dom.window);
    (globalThis as any).HTMLInputElement = dom.window.HTMLInputElement; (globalThis as any).Event = dom.window.Event; (globalThis as any).MouseEvent = dom.window.MouseEvent;
    (globalThis as any).WebSocket = FakeWebSocket; (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const { default: SonoQuizPlay } = await import("../client/src/pages/SonoQuizPlay");
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(React.createElement(SonoQuizPlay)); });
    expect(container.textContent).toContain("SonoQuiz");
    const randomName = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Pick a Random")) as HTMLButtonElement;
    await act(async () => randomName.click());
    const joinButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Join Quiz")) as HTMLButtonElement;
    await act(async () => joinButton.click());
    expect(mocks.join).toHaveBeenCalledWith(expect.objectContaining({ joinCode: "TEACH1", displayName: expect.any(String), useAnonymous: false }));
    expect(container.textContent).toContain("Valve Review");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
    await act(async () => { mocks.socket.emit({ type: "question_started", questionIndex: 0, totalQuestions: 1, timeLimitSeconds: 20, question: { id: 5, question: "Point to the valve", interactionType: "hotspot", points: 0, options: "[]", mediaUrl: "https://example.com/valve.gif", mediaType: "image" } }); });
    expect(container.querySelector('img[src="https://example.com/valve.gif"]')).not.toBeNull();
    const hotspot = container.querySelector('[aria-label="Select hotspot location"]') as HTMLButtonElement;
    hotspot.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON: () => ({}) });
    await act(async () => hotspot.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, clientX: 50, clientY: 25 })));
    const submit = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Submit location")) as HTMLButtonElement;
    await act(async () => submit.click());
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 101, participantId: 202, questionId: 5, responsePayload: { hotspot: { x: 50, y: 25 } } }));
    await act(async () => { root.unmount(); await new Promise((resolve) => setTimeout(resolve, 0)); });
  });
});
