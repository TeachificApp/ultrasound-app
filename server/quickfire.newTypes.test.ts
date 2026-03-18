import { describe, it, expect } from "vitest";
import { z } from "zod";

// Test that the new question type schemas validate correctly
const questionTypeEnum = z.enum(["scenario", "image", "quickReview", "connect", "identifier", "order"]);

const connectPairSchema = z.object({ left: z.string(), right: z.string() });
const identifierMarkerSchema = z.object({ x: z.number(), y: z.number(), label: z.string() });
const orderItemSchema = z.object({ text: z.string() });

describe("New Daily Challenge Question Types", () => {
  it("accepts 'connect' as a valid question type", () => {
    expect(() => questionTypeEnum.parse("connect")).not.toThrow();
  });

  it("accepts 'identifier' as a valid question type", () => {
    expect(() => questionTypeEnum.parse("identifier")).not.toThrow();
  });

  it("accepts 'order' as a valid question type", () => {
    expect(() => questionTypeEnum.parse("order")).not.toThrow();
  });

  it("rejects unknown question types", () => {
    expect(() => questionTypeEnum.parse("flashcard")).toThrow();
  });

  it("validates connect pair structure", () => {
    const pair = { left: "E/e' > 14", right: "Elevated LAP" };
    expect(() => connectPairSchema.parse(pair)).not.toThrow();
    expect(() => connectPairSchema.parse({ left: "test" })).toThrow();
  });

  it("validates identifier marker structure", () => {
    const marker = { x: 45, y: 30, label: "Mitral Valve" };
    expect(() => identifierMarkerSchema.parse(marker)).not.toThrow();
    expect(() => identifierMarkerSchema.parse({ x: 45, label: "test" })).toThrow();
  });

  it("validates order item structure", () => {
    const item = { text: "Assess LV size" };
    expect(() => orderItemSchema.parse(item)).not.toThrow();
    expect(() => orderItemSchema.parse({})).toThrow();
  });

  it("validates a full connect game question payload", () => {
    const schema = z.object({
      type: questionTypeEnum,
      question: z.string().min(5),
      pairs: z.array(connectPairSchema).min(2),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    });
    const payload = {
      type: "connect",
      question: "Match each echo finding to its clinical significance",
      pairs: [
        { left: "E/e' > 14", right: "Elevated LAP" },
        { left: "LVEF < 40%", right: "Reduced systolic function" },
        { left: "TR Vmax > 2.8 m/s", right: "Pulmonary hypertension" },
      ],
      difficulty: "intermediate",
    };
    expect(() => schema.parse(payload)).not.toThrow();
  });

  it("validates a full order game question payload", () => {
    const schema = z.object({
      type: questionTypeEnum,
      question: z.string().min(5),
      orderedItems: z.array(orderItemSchema).min(2),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    });
    const payload = {
      type: "order",
      question: "Place the following steps of a TTE protocol in the correct order",
      orderedItems: [
        { text: "Parasternal long axis" },
        { text: "Parasternal short axis" },
        { text: "Apical 4-chamber" },
        { text: "Apical 2-chamber" },
      ],
      difficulty: "beginner",
    };
    expect(() => schema.parse(payload)).not.toThrow();
  });

  it("validates a full identifier game question payload", () => {
    const schema = z.object({
      type: questionTypeEnum,
      question: z.string().min(5),
      imageUrl: z.string().url(),
      markers: z.array(identifierMarkerSchema).min(1),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    });
    const payload = {
      type: "identifier",
      question: "Click on the mitral valve in this echo image",
      imageUrl: "https://example.com/echo-image.jpg",
      markers: [{ x: 45, y: 60, label: "Mitral Valve" }],
      difficulty: "intermediate",
    };
    expect(() => schema.parse(payload)).not.toThrow();
  });
});
