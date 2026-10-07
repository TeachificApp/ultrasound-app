import { createServer } from "node:http";
import { afterAll, describe, expect, it } from "vitest";
import { WebSocket, type RawData } from "ws";
import { broadcastQuestionEnd, broadcastQuestionStart, initSonoQuizHub, recordAnswer } from "./sonoQuizHub";

function waitForMessage(socket: WebSocket, type: string) {
  return new Promise<any>((resolve, reject) => {
    const handler = (raw: RawData) => {
      const message = JSON.parse(raw.toString());
      if (message.type === type) {
        clearTimeout(timeout);
        socket.off("message", handler);
        resolve(message);
      }
    };
    const timeout = setTimeout(() => {
      socket.off("message", handler);
      reject(new Error(`Timed out waiting for ${type}`));
    }, 2_000);
    socket.on("message", handler);
  });
}

describe("Teach live WebSocket integration", () => {
  const server = createServer();
  initSonoQuizHub(server);
  let port = 0;

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("joins a host and PIN participant over real sockets, then broadcasts a hotspot slide and reveal", async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    port = (server.address() as any).port;
    const sessionId = 9_200_001;
    const host = new WebSocket(`ws://127.0.0.1:${port}/ws/sonoquiz`);
    const player = new WebSocket(`ws://127.0.0.1:${port}/ws/sonoquiz`);
    await Promise.all([
      new Promise<void>((resolve) => host.on("open", () => resolve())),
      new Promise<void>((resolve) => player.on("open", () => resolve())),
    ]);
    const hostJoined = waitForMessage(host, "host_joined");
    const playerJoined = waitForMessage(player, "joined");
    host.send(JSON.stringify({ type: "join_host", sessionId, hostUserId: 700 }));
    player.send(JSON.stringify({ type: "join", sessionId, participantId: 900 }));
    await Promise.all([hostJoined, playerJoined]);

    const hostQuestion = waitForMessage(host, "question_start");
    const playerQuestion = waitForMessage(player, "question_start");
    broadcastQuestionStart(sessionId, {
      id: 44, interactionType: "hotspot", interactionConfig: { targetRegions: [{ x: 25, y: 25, width: 20, height: 20 }] },
      slideTitle: "Point to the valve", question: "Tap the mitral valve", options: [], mediaUrl: "https://cdn.example.com/valve.png", mediaType: "image", points: 100,
    }, 0, 1, 20);
    const [hostPayload, playerPayload] = await Promise.all([hostQuestion, playerQuestion]);
    expect(hostPayload.question).toMatchObject({ interactionType: "hotspot", mediaType: "image" });
    expect(playerPayload.question.slideTitle).toBe("Point to the valve");

    const hostReveal = waitForMessage(host, "question_end");
    const playerReveal = waitForMessage(player, "question_end");
    broadcastQuestionEnd(sessionId, -1, "The mitral valve is between the left atrium and ventricle.", []);
    expect((await hostReveal).explanation).toContain("mitral valve");
    expect((await playerReveal).type).toBe("question_end");

    const hostWordCloud = waitForMessage(host, "question_start");
    const playerWordCloud = waitForMessage(player, "question_start");
    broadcastQuestionStart(sessionId, {
      id: 45, interactionType: "word_cloud", interactionConfig: { wordLimit: 3 },
      slideTitle: "Name the finding", question: "Share a Doppler finding", options: [], points: 0,
    }, 1, 2, 15);
    const [hostWordPayload, playerWordPayload] = await Promise.all([hostWordCloud, playerWordCloud]);
    expect(hostWordPayload.question).toMatchObject({ interactionType: "word_cloud", interactionConfig: { wordLimit: 3 } });
    expect(playerWordPayload.question.question).toBe("Share a Doppler finding");
    const hostWordReveal = waitForMessage(host, "question_end");
    const playerWordReveal = waitForMessage(player, "question_end");
    broadcastQuestionEnd(sessionId, -1, "Compare the group word cloud.", []);
    expect((await hostWordReveal).explanation).toBe("Compare the group word cloud.");
    expect((await playerWordReveal).type).toBe("question_end");

    const hostChoice = waitForMessage(host, "question_start");
    const playerChoice = waitForMessage(player, "question_start");
    broadcastQuestionStart(sessionId, {
      id: 46, interactionType: "multiple_choice", slideTitle: "Valve anatomy", question: "Which valve is left-sided?",
      options: ["Mitral", "Tricuspid"], points: 100,
    }, 2, 4, 15);
    expect((await hostChoice).question).toMatchObject({ interactionType: "multiple_choice", options: ["Mitral", "Tricuspid"] });
    expect((await playerChoice).question).not.toHaveProperty("correctAnswer");
    const hostChoiceCount = waitForMessage(host, "answer_count");
    const playerChoiceCount = waitForMessage(player, "answer_count");
    recordAnswer(sessionId);
    expect(await hostChoiceCount).toMatchObject({ count: 1, total: 1 });
    expect(await playerChoiceCount).toMatchObject({ count: 1, total: 1 });
    const hostChoiceReveal = waitForMessage(host, "question_end");
    const playerChoiceReveal = waitForMessage(player, "question_end");
    broadcastQuestionEnd(sessionId, 0, "The mitral valve is left-sided.", []);
    expect((await hostChoiceReveal).correctAnswer).toBe(0);
    expect((await playerChoiceReveal).explanation).toContain("mitral");

    const hostTrueFalse = waitForMessage(host, "question_start");
    const playerTrueFalse = waitForMessage(player, "question_start");
    broadcastQuestionStart(sessionId, {
      id: 47, interactionType: "true_false", slideTitle: "True or false", question: "The mitral valve has two leaflets.",
      options: ["True", "False"], points: 100,
    }, 3, 4, 15);
    expect((await hostTrueFalse).question).toMatchObject({ interactionType: "true_false", options: ["True", "False"] });
    expect((await playerTrueFalse).question).not.toHaveProperty("correctAnswer");
    const hostTrueFalseCount = waitForMessage(host, "answer_count");
    const playerTrueFalseCount = waitForMessage(player, "answer_count");
    recordAnswer(sessionId);
    expect(await hostTrueFalseCount).toMatchObject({ count: 1, total: 1 });
    expect(await playerTrueFalseCount).toMatchObject({ count: 1, total: 1 });
    const hostTrueFalseReveal = waitForMessage(host, "question_end");
    const playerTrueFalseReveal = waitForMessage(player, "question_end");
    broadcastQuestionEnd(sessionId, 0, "True: the mitral valve has two leaflets.", []);
    expect((await hostTrueFalseReveal).correctAnswer).toBe(0);
    expect((await playerTrueFalseReveal).explanation).toContain("two leaflets");

    const hostPuzzle = waitForMessage(host, "question_start");
    const playerPuzzle = waitForMessage(player, "question_start");
    broadcastQuestionStart(sessionId, {
      id: 48, interactionType: "puzzle", interactionConfig: { correctOrder: ["Assess", "Measure"] },
      slideTitle: "Order the workflow", question: "Arrange the valve-assessment steps.", options: [], points: 100,
    }, 4, 5, 15);
    expect((await hostPuzzle).question).toMatchObject({ interactionType: "puzzle", interactionConfig: { correctOrder: ["Assess", "Measure"] } });
    expect((await playerPuzzle).question.question).toContain("Arrange the valve-assessment steps");
    const hostPuzzleCount = waitForMessage(host, "answer_count");
    const playerPuzzleCount = waitForMessage(player, "answer_count");
    recordAnswer(sessionId);
    expect(await hostPuzzleCount).toMatchObject({ count: 1, total: 1 });
    expect(await playerPuzzleCount).toMatchObject({ count: 1, total: 1 });
    const hostPuzzleReveal = waitForMessage(host, "question_end");
    const playerPuzzleReveal = waitForMessage(player, "question_end");
    broadcastQuestionEnd(sessionId, -1, "Assess before measuring.", []);
    expect((await hostPuzzleReveal).explanation).toContain("Assess before");
    expect((await playerPuzzleReveal).type).toBe("question_end");
    host.close();
    player.close();
  });
});
