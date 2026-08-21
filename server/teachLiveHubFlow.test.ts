import { describe, expect, it } from "vitest";
import {
  broadcastQuestionEnd,
  broadcastQuestionStart,
  recordAnswer,
  registerHost,
  registerParticipant,
} from "./sonoQuizHub";

function fakeSocket(messages: any[]) {
  return { readyState: 1, send: (payload: string) => messages.push(JSON.parse(payload)) } as any;
}

describe("Teach live room flow", () => {
  it("delivers a mixed Teach slide, response progress, and reveal to the host and QR/PIN participant", () => {
    const sessionId = 9_100_001;
    const hostMessages: any[] = [];
    const participantMessages: any[] = [];
    registerHost(sessionId, 501, fakeSocket(hostMessages));
    registerParticipant(sessionId, 801, fakeSocket(participantMessages));

    broadcastQuestionStart(sessionId, {
      id: 22,
      interactionType: "word_cloud",
      interactionConfig: { wordLimit: 3 },
      slideTitle: "What did you notice?",
      question: "Share one Doppler term",
      options: [],
      mediaUrl: "https://cdn.example.com/doppler-loop.gif",
      mediaType: "gif",
      points: 0,
    }, 0, 2, 20);
    expect(recordAnswer(sessionId)).toEqual({ count: 1, total: 1 });
    broadcastQuestionEnd(sessionId, -1, "Discuss the most common terms.", []);

    for (const messages of [hostMessages, participantMessages]) {
      expect(messages[0]).toMatchObject({ type: "question_start", question: { interactionType: "word_cloud", slideTitle: "What did you notice?", mediaUrl: "https://cdn.example.com/doppler-loop.gif", mediaType: "gif" } });
      expect(messages[1]).toEqual({ type: "answer_count", count: 1, total: 1 });
      expect(messages[2]).toMatchObject({ type: "question_end", explanation: "Discuss the most common terms." });
    }
  });
});
