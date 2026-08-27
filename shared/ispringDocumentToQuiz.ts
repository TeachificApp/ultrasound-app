/**
 * Convert iSpring document.json / SCORM quiz JSON blobs into native Quiz Creator QuizFile JSON.
 * Shared by browser importers and server batch import.
 */
export type NativeQuestionType =
  | "mcq"
  | "tf"
  | "matching"
  | "hotspot"
  | "fill_blank"
  | "short_answer"
  | "image_choice"
  | "ordering"
  | "drag_drop"
  | "drag_words"
  | "dropdown"
  | "numeric"
  | "likert"
  | "essay";

export interface NativeBranchRule {
  id: string;
  condition:
    | { type: "correct" }
    | { type: "incorrect" }
    | { type: "choice"; choiceId: string }
    | { type: "score_above"; threshold: number }
    | { type: "score_below"; threshold: number }
    | { type: "always" };
  target:
    | { type: "question"; questionId: string }
    | { type: "end" }
    | { type: "result" }
    | { type: "next" };
  priority: number;
}

export interface NativeQuizFile {
  meta: Record<string, unknown>;
  questions: Record<string, unknown>[];
}

function uid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Unwrap SCORM base64 blob `{ d: {...} }` and map iSpring field names. */
export function normalizeISpringDocument(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const root = (raw as { d?: unknown }).d && typeof (raw as { d?: unknown }).d === "object"
    ? ((raw as { d: Record<string, unknown> }).d)
    : (raw as Record<string, unknown>);

  const design = (root.design ?? root.theme ?? root.branding ?? root.appearance) as Record<string, unknown> | undefined;
  const settings = (root.settings ?? root.s ?? root.sl?.s) as Record<string, unknown> | undefined;

  return {
    ...root,
    title: root.title ?? root.T ?? root.nm ?? root.name ?? "Imported Quiz",
    description: root.description ?? root.desc ?? root.D,
    passingScore: root.passingScore ?? root.passScore ?? root.ps ?? settings?.ps ?? 70,
    timeLimit: root.timeLimit ?? root.tl ?? settings?.tl ?? null,
    shuffleQuestions: root.shuffleQuestions ?? root.rnd ?? settings?.rnd ?? false,
    shuffleAnswers: root.shuffleAnswers ?? root.rndAns ?? root.rndA ?? settings?.rndA ?? false,
    showFeedback: mapShowFeedback(root.showFeedback ?? root.sf ?? settings?.sf),
    allowRetry: root.allowRetry ?? settings?.allowRetry ?? true,
    maxAttempts: root.maxAttempts ?? root.maa ?? settings?.maa ?? 3,
    allowBackNavigation: root.allowBackNavigation ?? settings?.allowBackNavigation ?? true,
    showProgressBar: root.showProgressBar ?? settings?.showProgressBar ?? true,
    branchingEnabled: Boolean(root.branchingEnabled ?? settings?.branchingEnabled ?? root.br),
    branding: root.branding ?? root.theme ?? design,
    design,
    tags: Array.isArray(root.tags) ? root.tags : [],
    sl: root.sl,
    questions: root.questions,
    slides: root.slides,
  };
}

function mapShowFeedback(value: unknown): "immediate" | "deferred" | "never" {
  if (value === "deferred" || value === 1 || value === "1") return "deferred";
  if (value === "never" || value === 2 || value === "2" || value === false) return "never";
  return "immediate";
}

export function extractText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  const n = node as Record<string, unknown>;

  if (typeof n.h === "string" && n.h.trim()) {
    return stripHtml(String(n.h));
  }
  if (Array.isArray(n.d) && typeof n.d[0] === "string") {
    return String(n.d[0]);
  }
  if (n.d && Array.isArray(n.d)) {
    return (n.d as unknown[])
      .map((para) => {
        const p = para as Record<string, unknown>;
        if (p.c && Array.isArray(p.c)) {
          return (p.c as unknown[])
            .map((seg) => {
              const s = seg as Record<string, unknown>;
              return String(s.t ?? s.text ?? "");
            })
            .join("");
        }
        return String(p.t ?? p.text ?? "");
      })
      .join("\n");
  }
  if (typeof n.t === "string") return n.t;
  if (typeof n.text === "string") return n.text;
  return "";
}

export function extractHtml(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return `<p>${escapeHtml(node)}</p>`;
  const n = node as Record<string, unknown>;
  if (typeof n.h === "string" && n.h.trim()) return n.h;

  if (n.d && Array.isArray(n.d)) {
    return (n.d as unknown[])
      .map((para) => {
        const p = para as Record<string, unknown>;
        if (p.c && Array.isArray(p.c)) {
          const content = (p.c as unknown[])
            .map((seg) => {
              const s = seg as Record<string, unknown>;
              let text = String(s.t ?? s.text ?? "");
              if (s.b) text = `<strong>${text}</strong>`;
              if (s.i) text = `<em>${text}</em>`;
              if (s.u) text = `<u>${text}</u>`;
              return text;
            })
            .join("");
          return `<p>${content}</p>`;
        }
        return `<p>${escapeHtml(String(p.t ?? p.text ?? ""))}</p>`;
      })
      .join("");
  }

  return `<p>${escapeHtml(String(n.t ?? n.text ?? ""))}</p>`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function mapQuestionType(ispringType: string): NativeQuestionType {
  const key = String(ispringType ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  const typeMap: Record<string, NativeQuestionType> = {
    mc: "mcq",
    mr: "mcq",
    tf: "tf",
    sa: "short_answer",
    fib: "fill_blank",
    match: "matching",
    seq: "ordering",
    hs: "hotspot",
    dd: "drag_drop",
    dw: "drag_words",
    sl: "dropdown",
    num: "numeric",
    likert: "likert",
    essay: "essay",
    multiplechoice: "mcq",
    multipleresponse: "mcq",
    truefalse: "tf",
    shortanswer: "short_answer",
    fillintheblank: "fill_blank",
    fillinblank: "fill_blank",
    wordbank: "fill_blank",
    matching: "matching",
    sequence: "ordering",
    ordering: "ordering",
    hotspot: "hotspot",
    draganddrop: "drag_drop",
    dragthewords: "drag_words",
    selectfromlists: "dropdown",
    numeric: "numeric",
    likertscale: "likert",
    imagechoice: "image_choice",
  };
  return typeMap[key] ?? "mcq";
}

function resolveMedia(path: string | undefined, mediaUrlMap: Map<string, string>): string {
  if (!path) return "";
  if (mediaUrlMap.has(path)) return mediaUrlMap.get(path)!;
  for (const [key, url] of mediaUrlMap) {
    if (path.endsWith(key) || key.endsWith(path)) return url;
  }
  return path;
}

function extractChoiceMedia(ch: Record<string, unknown>, mediaUrlMap: Map<string, string>): string {
  const imageRef = (ch.t as { r?: string[] } | undefined)?.r?.[0];
  return resolveMedia(
    String(ch.img ?? ch.image ?? imageRef ?? ""),
    mediaUrlMap,
  );
}

function extractChoiceFeedback(ch: Record<string, unknown>): { feedback?: string; feedbackHtml?: string } {
  const fb = (ch.F ?? ch.fb ?? ch.feedback) as Record<string, unknown> | string | undefined;
  if (!fb) return {};
  if (typeof fb === "string") {
    return { feedback: fb, feedbackHtml: `<p>${escapeHtml(fb)}</p>` };
  }

  const simple =
    (typeof fb.correct === "string" ? fb.correct : undefined) ??
    (typeof fb.incorrect === "string" ? fb.incorrect : undefined) ??
    (typeof fb.c === "string" ? fb.c : undefined) ??
    (typeof fb.ic === "string" ? fb.ic : undefined);
  if (simple) {
    return { feedback: simple, feedbackHtml: `<p>${escapeHtml(simple)}</p>` };
  }

  const html = String((fb.v as { h?: string } | undefined)?.h ?? fb.h ?? extractHtml(fb));
  const text = extractText(fb.v ?? fb);
  return { feedback: text || undefined, feedbackHtml: html || undefined };
}

function extractQuestionFeedback(q: Record<string, unknown>): {
  feedback?: { correct?: string; incorrect?: string; partial?: string };
  feedbackHtml?: { correct?: string; incorrect?: string; partial?: string };
  feedbackMode?: "question" | "answer";
} {
  const settings = q.s as Record<string, unknown> | undefined;
  const fbRoot = (q.fb ?? q.feedback ?? settings?.F) as Record<string, unknown> | undefined;
  const correctNode = (fbRoot?.c ?? fbRoot?.correct ?? (settings?.F as { c?: unknown } | undefined)?.c) as Record<string, unknown> | undefined;
  const incorrectNode = (fbRoot?.ic ?? fbRoot?.incorrect ?? (settings?.F as { ic?: unknown } | undefined)?.ic) as Record<string, unknown> | undefined;
  const partialNode = fbRoot?.partial as Record<string, unknown> | undefined;

  const correctVal = correctNode?.v ?? correctNode;
  const incorrectVal = incorrectNode?.v ?? incorrectNode;

  const feedback = {
    correct: extractText(correctVal) || undefined,
    incorrect: extractText(incorrectVal) || undefined,
    partial: extractText(partialNode?.v ?? partialNode) || undefined,
  };
  const feedbackHtml = {
    correct: extractHtml(correctVal) || undefined,
    incorrect: extractHtml(incorrectVal) || undefined,
    partial: extractHtml(partialNode?.v ?? partialNode) || undefined,
  };

  const hasFeedback = Object.values(feedback).some(Boolean);
  const askFeedback = settings?.af ?? q.askFeedback;
  const feedbackMode =
    askFeedback === 1 || askFeedback === "answer" || settings?.fbm === 1 ? "answer" : "question";

  return {
    feedback: hasFeedback ? feedback : undefined,
    feedbackHtml: hasFeedback ? feedbackHtml : undefined,
    feedbackMode,
  };
}

function convertQuestionData(
  ispringQ: Record<string, unknown>,
  type: NativeQuestionType,
  mediaUrlMap: Map<string, string>,
): Record<string, unknown> {
  switch (type) {
    case "mcq": {
      const choices = ((ispringQ.C as { chs?: unknown[] } | undefined)?.chs ?? ispringQ.choices ?? []).map(
        (choice) => {
          const ch = choice as Record<string, unknown>;
          const choiceFeedback = extractChoiceFeedback(ch);
          return {
            id: uid(),
            text: extractText(ch.t ?? ch.text ?? ch),
            correct: Boolean(ch.c ?? ch.correct),
            imageUrl: extractChoiceMedia(ch, mediaUrlMap) || undefined,
            ...choiceFeedback,
          };
        },
      );
      const typeStr = String(ispringQ.tp ?? ispringQ.type ?? "").toLowerCase();
      const isMultiResponse =
        typeStr.includes("multipleresponse") ||
        typeStr === "mr" ||
        choices.filter((c) => c.correct).length > 1;
      return { choices, multiSelect: isMultiResponse };
    }
    case "tf": {
      const chs = (ispringQ.C as { chs?: unknown[]; ca?: number; correct?: boolean } | undefined);
      if (chs?.chs?.length) {
        const mapped = chs.chs.map((choice) => {
          const ch = choice as Record<string, unknown>;
          return { text: extractText(ch.t ?? ch.text ?? ch), correct: Boolean(ch.c ?? ch.correct) };
        });
        const correctChoice = mapped.find((c) => c.correct);
        return {
          correct: correctChoice?.text?.toLowerCase() === "true" || correctChoice?.text?.toLowerCase() !== "false",
          trueFeedback: mapped[0]?.text,
          falseFeedback: mapped[1]?.text,
        };
      }
      const correctIndex = chs?.ca ?? 0;
      const explicit = chs?.correct;
      return { correct: explicit != null ? Boolean(explicit) : correctIndex === 0 };
    }
    case "matching": {
      const pairs = ((ispringQ.C as { pairs?: unknown[] } | undefined)?.pairs ?? ispringQ.pairs ?? []).map(
        (pair) => {
          const p = pair as Record<string, unknown>;
          return {
            id: uid(),
            premise: extractText(p.l ?? p.left ?? p.premise),
            response: extractText(p.r ?? p.right ?? p.response),
            premiseImageUrl: resolveMedia(String(p.lImg ?? p.leftImage ?? ""), mediaUrlMap) || undefined,
            responseImageUrl: resolveMedia(String(p.rImg ?? p.rightImage ?? ""), mediaUrlMap) || undefined,
          };
        },
      );
      const distractors = ((ispringQ.C as { distractors?: unknown[] } | undefined)?.distractors ?? ispringQ.distractors ?? [])
        .map((d) => extractText(d));
      return { pairs, extraDistractors: distractors.length > 0 ? distractors : undefined };
    }
    case "ordering": {
      const items = ((ispringQ.C as { items?: unknown[] } | undefined)?.items ?? ispringQ.items ?? []).map(
        (item) => {
          const it = item as Record<string, unknown>;
          return {
            id: uid(),
            text: extractText(it.t ?? it.text ?? it),
            imageUrl: resolveMedia(String(it.img ?? it.image ?? ""), mediaUrlMap) || undefined,
          };
        },
      );
      return { items };
    }
    case "fill_blank": {
      const template = extractText(
        (ispringQ.C as { template?: unknown } | undefined)?.template ?? ispringQ.template ?? ispringQ.D,
      );
      const blanks = ((ispringQ.C as { blanks?: unknown[] } | undefined)?.blanks ?? ispringQ.blanks ?? []).map(
        (blank, idx) => {
          const b = blank as Record<string, unknown>;
          return {
            id: String(b.id ?? `blank${idx + 1}`),
            acceptedAnswers: Array.isArray(b.answers) ? b.answers : [String(b.answer ?? b.text ?? "")],
            caseSensitive: Boolean(b.caseSensitive ?? false),
          };
        },
      );
      return { template, blanks };
    }
    case "short_answer": {
      const config = (ispringQ.C ?? {}) as Record<string, unknown>;
      return {
        sampleAnswer: extractText(config.answer ?? ispringQ.answer ?? ""),
        keywords: Array.isArray(config.keywords) ? config.keywords : [],
        autoGrade: Boolean(config.autoGrade),
        acceptedVariants: Array.isArray(config.variants) ? config.variants : [],
      };
    }
    case "hotspot": {
      const config = (ispringQ.C ?? {}) as Record<string, unknown>;
      const regions = ((config.regions ?? ispringQ.regions ?? []) as unknown[]).map((region) => {
        const r = region as Record<string, unknown>;
        return {
          id: uid(),
          label: String(r.label ?? ""),
          correct: r.correct ?? true,
          shape: r.shape ?? "rect",
          x: Number(r.x ?? 0),
          y: Number(r.y ?? 0),
          width: r.width,
          height: r.height,
          radius: r.radius,
          points: r.points,
        };
      });
      return {
        imageUrl: resolveMedia(String(config.image ?? ispringQ.image ?? ""), mediaUrlMap),
        imageAlt: String(config.imageAlt ?? ""),
        regions,
        multiSelect: regions.filter((r) => r.correct).length > 1,
      };
    }
    case "drag_drop": {
      const config = (ispringQ.C ?? {}) as Record<string, unknown>;
      const targets = ((config.targets ?? ispringQ.targets ?? []) as unknown[]).map((target) => {
        const t = target as Record<string, unknown>;
        return {
          id: uid(),
          label: String(t.label ?? ""),
          x: Number(t.x ?? 0),
          y: Number(t.y ?? 0),
          width: Number(t.width ?? 20),
          height: Number(t.height ?? 15),
        };
      });
      const items = ((config.items ?? ispringQ.items ?? []) as unknown[]).map((item, idx) => {
        const it = item as Record<string, unknown>;
        return {
          id: uid(),
          text: extractText(it.t ?? it.text ?? it),
          imageUrl: resolveMedia(String(it.img ?? it.image ?? ""), mediaUrlMap) || undefined,
          targetId: targets[(it.targetIndex as number | undefined) ?? idx]?.id ?? targets[0]?.id ?? "",
        };
      });
      return {
        backgroundImageUrl: resolveMedia(String(config.backgroundImage ?? ispringQ.backgroundImage ?? ""), mediaUrlMap),
        targets,
        items,
      };
    }
    case "drag_words": {
      const config = (ispringQ.C ?? {}) as Record<string, unknown>;
      const template = extractText(config.template ?? ispringQ.template ?? "");
      const blanks = ((config.blanks ?? ispringQ.blanks ?? []) as unknown[]).map((blank, idx) => {
        const b = blank as Record<string, unknown>;
        return { id: String(b.id ?? `blank${idx + 1}`), correctWord: String(b.word ?? b.correctWord ?? "") };
      });
      return { template, blanks, distractorWords: config.distractors ?? ispringQ.distractors ?? [] };
    }
    case "dropdown": {
      const config = (ispringQ.C ?? {}) as Record<string, unknown>;
      const template = extractText(config.template ?? ispringQ.template ?? "");
      const blanks = ((config.blanks ?? ispringQ.blanks ?? []) as unknown[]).map((blank, idx) => {
        const b = blank as Record<string, unknown>;
        return {
          id: String(b.id ?? `blank${idx + 1}`),
          options: (b.options as string[] | undefined) ?? ["Option 1", "Option 2"],
          correctIndex: Number(b.correctIndex ?? 0),
        };
      });
      return { template, blanks };
    }
    case "numeric": {
      const config = (ispringQ.C ?? {}) as Record<string, unknown>;
      return {
        correctValue: Number(config.value ?? ispringQ.value ?? 0),
        tolerance: Number(config.tolerance ?? ispringQ.tolerance ?? 0),
        allowRange: Boolean(config.rangeMin ?? ispringQ.rangeMin),
        rangeMin: config.rangeMin ?? ispringQ.rangeMin,
        rangeMax: config.rangeMax ?? ispringQ.rangeMax,
        unit: config.unit ?? ispringQ.unit,
      };
    }
    case "likert": {
      const config = (ispringQ.C ?? {}) as Record<string, unknown>;
      const statements = ((config.statements ?? ispringQ.statements ?? []) as unknown[]).map((statement) => {
        const s = statement as Record<string, unknown>;
        return { id: uid(), text: extractText(s.t ?? s.text ?? s) };
      });
      const scaleLabels = (config.scaleLabels as string[] | undefined) ?? [
        "Strongly Disagree",
        "Disagree",
        "Neutral",
        "Agree",
        "Strongly Agree",
      ];
      return { statements, scaleLabels, scaleSize: scaleLabels.length };
    }
    case "essay": {
      const config = (ispringQ.C ?? {}) as Record<string, unknown>;
      return {
        minWords: config.minWords,
        maxWords: config.maxWords,
        placeholder: String(config.placeholder ?? "Write your answer here..."),
        rubric: String(config.rubric ?? ""),
      };
    }
    default:
      return { choices: [{ id: uid(), text: "Option A", correct: true }], multiSelect: false };
  }
}

function resolveBranchTarget(
  branchSpec: unknown,
  idByISpringId: Map<string, string>,
  idByOrder: Map<number, string>,
): NativeBranchRule["target"] | null {
  if (branchSpec == null) return null;
  if (typeof branchSpec === "number") {
    const qid = idByOrder.get(branchSpec);
    return qid ? { type: "question", questionId: qid } : null;
  }
  if (typeof branchSpec === "string") {
    const qid = idByISpringId.get(branchSpec);
    return qid ? { type: "question", questionId: qid } : null;
  }
  const spec = branchSpec as Record<string, unknown>;
  const action = spec.t ?? spec.type ?? spec.action;
  const value = spec.v ?? spec.value ?? spec.target ?? spec.i ?? spec.id;
  if (action === 0 || action === "next") return { type: "next" };
  if (action === 1 || action === "finish" || action === "end") return { type: "end" };
  if (action === 2 || action === "result") return { type: "result" };
  if (typeof value === "number") {
    const qid = idByOrder.get(value);
    return qid ? { type: "question", questionId: qid } : null;
  }
  if (typeof value === "string") {
    const qid = idByISpringId.get(value) ?? idByOrder.get(Number(value)) ? idByOrder.get(Number(value)) : undefined;
    if (qid) return { type: "question", questionId: qid };
    const byOrder = idByOrder.get(Number.parseInt(value, 10));
    return byOrder ? { type: "question", questionId: byOrder } : null;
  }
  return null;
}

function applyBranchRules(
  questions: Record<string, unknown>[],
  rawQuestions: Array<{ question: Record<string, unknown>; groupId?: string }>,
  meta: Record<string, unknown>,
): void {
  const idByISpringId = new Map<string, string>();
  const idByOrder = new Map<number, string>();
  questions.forEach((q, idx) => {
    idByOrder.set(idx, String(q.id));
    idByOrder.set(idx + 1, String(q.id));
    const rawId = rawQuestions[idx]?.question?.i;
    if (rawId != null) idByISpringId.set(String(rawId), String(q.id));
  });

  let branchingEnabled = Boolean(meta.branchingEnabled);
  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    const raw = rawQuestions[idx]?.question ?? {};
    const rules: NativeBranchRule[] = [];

    const correctTarget = resolveBranchTarget(
      raw.br?.c ?? raw.cbr ?? raw.branchCorrect ?? raw.branchOnCorrect ?? (raw.s as { br?: { c?: unknown } } | undefined)?.br?.c,
      idByISpringId,
      idByOrder,
    );
    if (correctTarget && correctTarget.type !== "next") {
      rules.push({ id: uid(), condition: { type: "correct" }, target: correctTarget, priority: 1 });
    }

    const incorrectTarget = resolveBranchTarget(
      raw.br?.ic ?? raw.icbr ?? raw.branchIncorrect ?? raw.branchOnIncorrect ?? (raw.s as { br?: { ic?: unknown } } | undefined)?.br?.ic,
      idByISpringId,
      idByOrder,
    );
    if (incorrectTarget && incorrectTarget.type !== "next") {
      rules.push({ id: uid(), condition: { type: "incorrect" }, target: incorrectTarget, priority: 2 });
    }

    const navTarget = resolveBranchTarget(raw.nv ?? raw.navigation, idByISpringId, idByOrder);
    if (navTarget && navTarget.type !== "next") {
      rules.push({ id: uid(), condition: { type: "always" }, target: navTarget, priority: 0 });
    }

    const choices = ((q.data as { choices?: Array<Record<string, unknown>> } | undefined)?.choices ?? []);
    const rawChoices = ((raw.C as { chs?: unknown[] } | undefined)?.chs ?? []) as Record<string, unknown>[];
    rawChoices.forEach((rawChoice, choiceIdx) => {
      const choiceTarget = resolveBranchTarget(rawChoice.br ?? rawChoice.nv ?? rawChoice.jmp, idByISpringId, idByOrder);
      const choiceId = choices[choiceIdx]?.id;
      if (choiceTarget && choiceId && choiceTarget.type !== "next") {
        rules.push({
          id: uid(),
          condition: { type: "choice", choiceId: String(choiceId) },
          target: choiceTarget,
          priority: 10 + choiceIdx,
        });
      }
    });

    if (rules.length > 0) {
      q.branchRules = rules;
      branchingEnabled = true;
    }
  }

  if (branchingEnabled) meta.branchingEnabled = true;
}

export function convertDocumentToQuiz(
  rawDoc: unknown,
  mediaUrlMap: Map<string, string>,
  warnings: string[] = [],
  options?: { sourceMediaAssetId?: number; sourceMediaAssetSlug?: string },
): NativeQuizFile {
  const doc = normalizeISpringDocument(rawDoc);
  const now = new Date().toISOString();

  const meta: Record<string, unknown> = {
    id: uid(),
    title: String(doc.title ?? "Imported Quiz"),
    description: extractText(doc.description),
    author: String(doc.author ?? doc.authorName ?? ""),
    authorEmail: String(doc.authorEmail ?? ""),
    createdAt: String(doc.createdAt ?? now),
    updatedAt: now,
    version: 1,
    licenseKey: null,
    teachificOrgId: null,
    tags: [
      ...(Array.isArray(doc.tags) ? doc.tags.map(String) : []),
      ...(options?.sourceMediaAssetId ? [`scorm-import:${options.sourceMediaAssetId}`] : []),
    ],
    passingScore: Number(doc.passingScore ?? 70),
    timeLimit: doc.timeLimit != null ? Number(doc.timeLimit) : null,
    shuffleQuestions: Boolean(doc.shuffleQuestions),
    shuffleAnswers: Boolean(doc.shuffleAnswers),
    showFeedback: doc.showFeedback ?? "immediate",
    allowRetry: Boolean(doc.allowRetry ?? true),
    maxAttempts: Number(doc.maxAttempts ?? 3),
    allowBackNavigation: Boolean(doc.allowBackNavigation ?? true),
    showProgressBar: Boolean(doc.showProgressBar ?? true),
    branchingEnabled: Boolean(doc.branchingEnabled ?? false),
    sourceMediaAssetId: options?.sourceMediaAssetId ?? null,
    sourceMediaAssetSlug: options?.sourceMediaAssetSlug ?? null,
  };

  const brandingSource = (doc.branding ?? doc.design ?? doc.theme) as Record<string, unknown> | undefined;
  if (brandingSource) {
    meta.branding = {
      primaryColor: brandingSource.primaryColor ?? brandingSource.accentColor ?? "#24abbc",
      backgroundColor: brandingSource.backgroundColor ?? brandingSource.bgColor ?? "#ffffff",
      textColor: brandingSource.textColor,
      fontFamily: brandingSource.fontFamily ?? brandingSource.font,
      logoUrl: resolveMedia(String(brandingSource.logoUrl ?? brandingSource.logo ?? ""), mediaUrlMap) || undefined,
      backgroundImageUrl: resolveMedia(String(brandingSource.backgroundImage ?? ""), mediaUrlMap) || undefined,
      backgroundOverlay: brandingSource.backgroundOverlay,
    };
  }

  let rawQuestions: Array<{ question: Record<string, unknown>; groupId?: string }> = [];
  const sl = doc.sl as { g?: unknown[] } | undefined;

  if (sl?.g && Array.isArray(sl.g)) {
    const groups: Array<{ id: string; name: string; color: string }> = [];
    for (const [groupIndex, groupRaw] of sl.g.entries()) {
      const group = groupRaw as Record<string, unknown>;
      const slides = group.S as unknown[] | undefined;
      if (!Array.isArray(slides)) continue;
      const groupId = `ispring-group-${group.id ?? group.i ?? groupIndex + 1}`;
      groups.push({
        id: groupId,
        name: extractText(group.nm ?? group.name ?? group.title ?? group.T ?? `Group ${groupIndex + 1}`),
        color: ["#189aa1", "#4ad9e0", "#0f766e", "#0ea5e9", "#14b8a6"][groupIndex % 5],
      });
      rawQuestions.push(
        ...slides
          .filter((slide) => {
            const s = slide as Record<string, unknown>;
            return Boolean(s.tp || s.type);
          })
          .map((slide) => ({ question: slide as Record<string, unknown>, groupId })),
      );
    }
    if (groups.length > 0) meta.groups = groups;
  } else if (Array.isArray(doc.questions)) {
    rawQuestions = (doc.questions as unknown[]).map((question) => ({ question: question as Record<string, unknown> }));
  } else if (Array.isArray(doc.slides)) {
    rawQuestions = (doc.slides as unknown[])
      .filter((slide) => {
        const s = slide as Record<string, unknown>;
        return Boolean(s.tp || s.type);
      })
      .map((slide) => ({ question: slide as Record<string, unknown> }));
  } else if (Array.isArray(rawDoc)) {
    rawQuestions = (rawDoc as unknown[]).map((question) => ({ question: question as Record<string, unknown> }));
  }

  const questions: Record<string, unknown>[] = rawQuestions.map(({ question: q, groupId }, idx) => {
    const typeStr = String(q.tp ?? q.type ?? "mc");
    const type = mapQuestionType(typeStr);
    const stem = extractText(q.D ?? q.question ?? q.stem ?? q.text ?? "");
    const stemHtmlRaw = extractHtml(q.D ?? q.question ?? q.stem ?? "");
    const stemHtml = stemHtmlRaw !== `<p>${escapeHtml(stem)}</p>` ? stemHtmlRaw : undefined;
    const { feedback, feedbackMode } = extractQuestionFeedback(q);

    let image: { url: string; alt: string } | null = null;
    let audio: { url: string; label?: string } | null = null;
    let video: { url: string; type?: string } | null = null;

    if (q.img || q.image) {
      const imgPath = String(q.img ?? q.image);
      image = { url: resolveMedia(imgPath, mediaUrlMap), alt: String(q.imgAlt ?? "") };
    }
    if (q.audio) {
      const audioPath = typeof q.audio === "string" ? q.audio : String((q.audio as { src?: string }).src ?? "");
      audio = { url: resolveMedia(audioPath, mediaUrlMap), label: (q.audio as { label?: string }).label };
    }
    if (q.video) {
      const videoPath = typeof q.video === "string" ? q.video : String((q.video as { src?: string }).src ?? "");
      video = { url: resolveMedia(videoPath, mediaUrlMap), type: (q.video as { type?: string }).type };
    }

    let data: Record<string, unknown>;
    try {
      data = convertQuestionData(q, type, mediaUrlMap);
    } catch {
      warnings.push(`Question ${idx + 1}: Failed to convert data for type "${typeStr}". Using default.`);
      data = { choices: [{ id: uid(), text: "Option A", correct: true }], multiSelect: false };
    }

    const explanationHtml = extractHtml(q.explanation ?? q.exp ?? (q.s as { F?: { c?: unknown } } | undefined)?.F?.c);
    return {
      id: uid(),
      type,
      order: idx + 1,
      points: Number(q.points ?? q.score ?? 1),
      required: q.required ?? true,
      stem,
      stemHtml,
      image,
      audio,
      video,
      explanation: extractText(q.explanation ?? q.exp ?? feedback?.correct ?? ""),
      explanationHtml: explanationHtml || undefined,
      feedback,
      feedbackMode,
      backgroundImageUrl: q.bgImage ? resolveMedia(String(q.bgImage), mediaUrlMap) : undefined,
      backgroundColor: q.bgColor,
      groupId,
      shuffleAnswerOptions: !(q.lockAnswerOrder ?? q.s?.lao ?? false),
      lockAnswerOrder: Boolean(q.lockAnswerOrder ?? false),
      data,
    };
  });

  applyBranchRules(questions, rawQuestions, meta);

  if (questions.length === 0) warnings.push("No questions could be extracted from the file.");

  return { meta, questions };
}

/** Serialize QuizFile to plain `.aausquiz` export (unencrypted). */
export function serializeNativeQuizFile(quiz: NativeQuizFile): string {
  const json = JSON.stringify(quiz);
  const payload = Buffer.from(json, "utf8").toString("base64");
  return `TEACHIFIC_QUIZ_V1\n${payload}`;
}
