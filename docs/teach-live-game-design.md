# Teach Live Game Design

## Foundation

Teach Live Games extend the existing live SonoQuiz session model rather than creating a competing real-time stack. A game retains the established reusable quiz, session snapshot, participant, answer, QR/PIN join, WebSocket room, leaderboard, and presenter flow while adding Teach ownership and richer interaction semantics.

## Persistent Model

| Entity | New fields | Purpose |
|---|---|---|
| `sonoQuizzes` | `isTeachGame`, `ownerContext`, `educatorOrgId`, `importSource` | Distinguishes Teach-authored games, controls teacher ownership, and records user-owned Kahoot spreadsheet imports. |
| `sonoQuizQuestions` | `interactionType`, `interactionConfig`, `slideTitle` | Supports multiple choice, true/false, word cloud, hotspot, and puzzle slides with a flexible JSON configuration. |
| `sonoQuizAnswers` | `responsePayload` | Stores structured non-choice responses, including word entries, hotspot coordinates, and puzzle order. |

## Interaction Configuration

The game snapshot captures complete slide configuration when a teacher opens a live session. This ensures that a running group game does not change if the source game is edited. `interactionConfig` is typed and validated by the game router: word-cloud slides define response length and moderation behaviour; hotspot slides define image dimensions and valid target regions; puzzle slides define item IDs and the expected arrangement.

## Kahoot Spreadsheet Import

The importer accepts a teacher-provided `.xlsx` workbook matching Kahoot’s published quiz template. It converts supported quiz rows into multiple-choice Teach game slides and preserves prompt, answer options, correct-answer indexes, and time limit. Imported games can subsequently be enriched in Teach with the platform’s media and interactive slide types.
