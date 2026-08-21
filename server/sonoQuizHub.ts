/**
 * sonoQuizHub.ts — Real-time WebSocket hub for SonoQuiz live sessions
 *
 * Protocol (JSON messages):
 *
 * Client → Server:
 *   { type: "join",        sessionId, participantId }
 *   { type: "answer",      sessionId, participantId, questionId, selectedAnswer, responseTimeMs }
 *   { type: "ping" }
 *
 * Server → Client:
 *   { type: "lobby_update",    participants: ParticipantInfo[] }
 *   { type: "question_start",  question: QuestionPayload, questionIndex, totalQuestions, timeLimitSeconds }
 *   { type: "answer_count",    count, total }
 *   { type: "question_end",    correctAnswer, explanation, scores: ScoreEntry[] }
 *   { type: "leaderboard",     rankings: RankEntry[] }
 *   { type: "session_ended",   finalRankings: RankEntry[] }
 *   { type: "host_event",      event: string, data?: unknown }
 *   { type: "pong" }
 *   { type: "error",           message: string }
 */

import { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "http";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParticipantInfo {
  participantId: number;
  displayName: string;
  avatarSeed: string;
  totalScore: number;
}

export interface QuestionPayload {
  id: number;
  interactionType?: "multiple_choice" | "true_false" | "word_cloud" | "hotspot" | "puzzle";
  interactionConfig?: Record<string, unknown> | null;
  slideTitle?: string | null;
  question: string;
  options: string[];
  mediaUrl?: string;
  mediaType?: string;
  points: number;
}

export interface ScoreEntry {
  participantId: number;
  displayName: string;
  pointsEarned: number;
  totalScore: number;
  isCorrect: boolean;
  responseTimeMs?: number;
}

export interface RankEntry {
  rank: number;
  participantId: number;
  displayName: string;
  avatarSeed: string;
  totalScore: number;
}

// ─── Session Room ─────────────────────────────────────────────────────────────

interface SessionRoom {
  sessionId: number;
  /** participantId → WebSocket */
  participants: Map<number, WebSocket>;
  /** hostUserId → WebSocket (may be same as a participant) */
  hosts: Map<number, WebSocket>;
  answerCount: number;
  totalParticipants: number;
}

// ─── Hub State ────────────────────────────────────────────────────────────────

const rooms = new Map<number, SessionRoom>();

function getOrCreateRoom(sessionId: number): SessionRoom {
  if (!rooms.has(sessionId)) {
    rooms.set(sessionId, {
      sessionId,
      participants: new Map(),
      hosts: new Map(),
      answerCount: 0,
      totalParticipants: 0,
    });
  }
  return rooms.get(sessionId)!;
}

function broadcast(room: SessionRoom, message: object) {
  const payload = JSON.stringify(message);
  room.participants.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  });
  room.hosts.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  });
}

function send(ws: WebSocket, message: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// ─── Public API (called from sonoQuizRouter.ts) ───────────────────────────────

/** Broadcast lobby participant list to all room members */
export function broadcastLobbyUpdate(sessionId: number, participants: ParticipantInfo[]) {
  const room = rooms.get(sessionId);
  if (!room) return;
  broadcast(room, { type: "lobby_update", participants });
}

/** Broadcast question start to all participants */
export function broadcastQuestionStart(
  sessionId: number,
  question: QuestionPayload,
  questionIndex: number,
  totalQuestions: number,
  timeLimitSeconds: number
) {
  const room = rooms.get(sessionId);
  if (!room) return;
  room.answerCount = 0;
  broadcast(room, {
    type: "question_start",
    question,
    questionIndex,
    totalQuestions,
    timeLimitSeconds,
  });
}

/** Broadcast answer count update (without revealing correctness) */
export function broadcastAnswerCount(sessionId: number, count: number, total: number) {
  const room = rooms.get(sessionId);
  if (!room) return;
  broadcast(room, { type: "answer_count", count, total });
}

/** Broadcast question results after time expires or all answered */
export function broadcastQuestionEnd(
  sessionId: number,
  correctAnswer: number,
  explanation: string | null,
  scores: ScoreEntry[]
) {
  const room = rooms.get(sessionId);
  if (!room) return;
  broadcast(room, { type: "question_end", correctAnswer, explanation, scores });
}

/** Broadcast leaderboard between questions */
export function broadcastLeaderboard(sessionId: number, rankings: RankEntry[]) {
  const room = rooms.get(sessionId);
  if (!room) return;
  broadcast(room, { type: "leaderboard", rankings });
}

/** Broadcast session ended with final rankings */
export function broadcastSessionEnded(sessionId: number, finalRankings: RankEntry[]) {
  const room = rooms.get(sessionId);
  if (!room) return;
  broadcast(room, { type: "session_ended", finalRankings });
  // Clean up room after a delay
  setTimeout(() => rooms.delete(sessionId), 60_000);
}

/** Register a host WebSocket for a session */
export function registerHost(sessionId: number, hostUserId: number, ws: WebSocket) {
  const room = getOrCreateRoom(sessionId);
  room.hosts.set(hostUserId, ws);
}

/** Register a participant WebSocket for a session */
export function registerParticipant(sessionId: number, participantId: number, ws: WebSocket) {
  const room = getOrCreateRoom(sessionId);
  room.participants.set(participantId, ws);
  room.totalParticipants = room.participants.size;
}

/** Increment answer count and broadcast update */
export function recordAnswer(sessionId: number): { count: number; total: number } {
  const room = rooms.get(sessionId);
  if (!room) return { count: 0, total: 0 };
  room.answerCount++;
  const count = room.answerCount;
  const total = room.totalParticipants;
  broadcastAnswerCount(sessionId, count, total);
  return { count, total };
}

/** Remove a participant from the room */
export function removeParticipant(sessionId: number, participantId: number) {
  const room = rooms.get(sessionId);
  if (!room) return;
  room.participants.delete(participantId);
  room.totalParticipants = room.participants.size;
}

// ─── WebSocket Server Setup ───────────────────────────────────────────────────

let wss: WebSocketServer | null = null;

export function initSonoQuizHub(server: import("http").Server) {
  wss = new WebSocketServer({ server, path: "/ws/sonoquiz" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    let boundSessionId: number | null = null;
    let boundParticipantId: number | null = null;

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "ping") {
          send(ws, { type: "pong" });
          return;
        }

        if (msg.type === "join") {
          const sessionId = Number(msg.sessionId);
          const participantId = Number(msg.participantId);
          if (!sessionId || !participantId) {
            send(ws, { type: "error", message: "Invalid join payload" });
            return;
          }
          boundSessionId = sessionId;
          boundParticipantId = participantId;
          registerParticipant(sessionId, participantId, ws);
          send(ws, { type: "joined", sessionId, participantId });
          return;
        }

        if (msg.type === "join_host") {
          const sessionId = Number(msg.sessionId);
          const hostUserId = Number(msg.hostUserId);
          if (!sessionId || !hostUserId) {
            send(ws, { type: "error", message: "Invalid host join payload" });
            return;
          }
          boundSessionId = sessionId;
          registerHost(sessionId, hostUserId, ws);
          send(ws, { type: "host_joined", sessionId });
          return;
        }
      } catch {
        send(ws, { type: "error", message: "Invalid message format" });
      }
    });

    ws.on("close", () => {
      if (boundSessionId !== null && boundParticipantId !== null) {
        removeParticipant(boundSessionId, boundParticipantId);
      }
    });

    ws.on("error", () => {
      if (boundSessionId !== null && boundParticipantId !== null) {
        removeParticipant(boundSessionId, boundParticipantId);
      }
    });
  });

  console.log("[SonoQuizHub] WebSocket server initialized at /ws/sonoquiz");
  return wss;
}
