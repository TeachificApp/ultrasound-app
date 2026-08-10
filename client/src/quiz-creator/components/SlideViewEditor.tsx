import { useQuizStore } from "../store/quizStore";
import type { McqData, QuizQuestion } from "../types/quiz";

function SlideFrame({ children, question }: { children: React.ReactNode; question?: QuizQuestion }) {
  const { quiz } = useQuizStore();
  const branding = quiz.meta.branding;
  const bg = question?.backgroundColor ?? branding?.backgroundColor ?? "#0d1f3c";
  const bgImage = question?.backgroundImageUrl ?? branding?.backgroundImageUrl;
  const textColor = branding?.textColor ?? "#ffffff";
  const primary = branding?.primaryColor ?? "#24abbc";

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-200 overflow-auto">
      <div className="text-xs text-gray-500 mb-3">Slide preview — WYSIWYG layout</div>
      <div className="relative w-full max-w-4xl">
      <div
        className="relative w-full aspect-[16/10] rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{
          background: bgImage
            ? `linear-gradient(rgba(0,0,0,${branding?.backgroundOverlay ?? 0.3}), rgba(0,0,0,${branding?.backgroundOverlay ?? 0.3})), url(${bgImage}) center/cover`
            : `radial-gradient(ellipse at center, ${bg} 0%, #000 100%)`,
          color: textColor,
          fontFamily: branding?.fontFamily,
        }}
      >
        {branding?.logoUrl && (
          <img src={branding.logoUrl} alt="" className="absolute bottom-4 left-4 h-10 object-contain opacity-90" />
        )}
        <div className="flex-1 p-8 flex flex-col" style={{ color: textColor }}>
          {children}
        </div>
        <div className="px-8 pb-6 flex justify-end">
          <button
            type="button"
            className="px-6 py-2 rounded border text-sm font-semibold"
            style={{ borderColor: textColor, color: textColor, background: "transparent" }}
          >
            Submit
          </button>
        </div>
      </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">Theme: {primary} · Switch to Form View to edit question data</p>
    </div>
  );
}

function McqSlideContent({ question }: { question: QuizQuestion }) {
  const data = question.data as McqData;
  return (
  <>
    <p className="text-lg font-medium mb-6 max-w-xl leading-relaxed">{question.stem || "Question text"}</p>
    <div className="flex gap-8 flex-1">
      <div className="flex-1 space-y-3">
        {data.choices.map((c) => (
          <label key={c.id} className="flex items-center gap-3 cursor-pointer">
            <span className="w-5 h-5 rounded-full border-2 border-current shrink-0" />
            <span className="text-sm">{c.text}</span>
          </label>
        ))}
      </div>
      {question.image?.url && (
        <div className="w-1/2 flex items-center justify-center">
          <img src={question.image.url} alt="" className="max-h-64 rounded-lg object-contain" />
        </div>
      )}
      {question.video?.url && !question.image?.url && (
        <div className="w-1/2 flex items-center justify-center bg-black/30 rounded-lg">
          <video src={question.video.url} controls className="max-h-64 w-full rounded-lg" />
        </div>
      )}
    </div>
  </>
  );
}

function IntroSlideEditor() {
  const { quiz, updateMeta } = useQuizStore();
  const intro = quiz.meta.introSlide ?? { enabled: true, title: quiz.meta.title, description: quiz.meta.description };
  const branding = quiz.meta.branding;

  return (
    <SlideFrame>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {intro.imageUrl && <img src={intro.imageUrl} alt="" className="max-h-32 mb-6 rounded-lg" />}
        <h1 className="text-3xl font-bold mb-4">{intro.title || quiz.meta.title}</h1>
        <p className="text-base opacity-80 max-w-lg mb-8">{intro.description || quiz.meta.description}</p>
        <button type="button" className="px-8 py-3 rounded-lg font-semibold text-white" style={{ background: branding?.primaryColor ?? "#24abbc" }}>
          {intro.buttonText || "Start Quiz"}
        </button>
      </div>
      <div className="absolute top-4 right-4 w-72 bg-white/95 rounded-xl p-4 text-gray-800 shadow-lg text-sm space-y-3">
        <p className="font-semibold text-xs uppercase text-gray-500">Edit Intro Slide</p>
        <input
          className="w-full px-2 py-1.5 border rounded text-sm"
          value={intro.title ?? ""}
          onChange={(e) => updateMeta({ introSlide: { ...intro, enabled: true, title: e.target.value } })}
          placeholder="Title"
        />
        <textarea
          className="w-full px-2 py-1.5 border rounded text-sm resize-none"
          rows={3}
          value={intro.description ?? ""}
          onChange={(e) => updateMeta({ introSlide: { ...intro, enabled: true, description: e.target.value } })}
          placeholder="Description"
        />
        <input
          className="w-full px-2 py-1.5 border rounded text-sm"
          value={intro.buttonText ?? ""}
          onChange={(e) => updateMeta({ introSlide: { ...intro, enabled: true, buttonText: e.target.value } })}
          placeholder="Button text"
        />
      </div>
    </SlideFrame>
  );
}

function ResultSlideEditor({ type }: { type: "pass" | "fail" }) {
  const { quiz, updateMeta } = useQuizStore();
  const result = quiz.meta.resultSlide ?? { enabled: true };
  const isPass = type === "pass";
  const title = isPass ? (result.passTitle ?? "Congratulations!") : (result.failTitle ?? "Not Quite");
  const message = isPass ? (result.passMessage ?? "You passed!") : (result.failMessage ?? "Review and try again.");

  return (
    <SlideFrame>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 text-2xl ${isPass ? "bg-green-500/20" : "bg-red-500/20"}`}>
          {isPass ? "✓" : "✗"}
        </div>
        <h1 className="text-3xl font-bold mb-4">{title}</h1>
        <p className="text-base opacity-80 max-w-lg">{message}</p>
        {result.showScore && <p className="mt-4 text-sm opacity-60">Score: 85%</p>}
      </div>
      <div className="absolute top-4 right-4 w-72 bg-white/95 rounded-xl p-4 text-gray-800 shadow-lg text-sm space-y-3">
        <p className="font-semibold text-xs uppercase text-gray-500">{isPass ? "Passing Result" : "Failing Result"}</p>
        <input
          className="w-full px-2 py-1.5 border rounded text-sm"
          value={isPass ? (result.passTitle ?? "") : (result.failTitle ?? "")}
          onChange={(e) =>
            updateMeta({
              resultSlide: {
                ...result,
                enabled: true,
                ...(isPass ? { passTitle: e.target.value } : { failTitle: e.target.value }),
              },
            })
          }
          placeholder="Title"
        />
        <textarea
          className="w-full px-2 py-1.5 border rounded text-sm resize-none"
          rows={3}
          value={isPass ? (result.passMessage ?? "") : (result.failMessage ?? "")}
          onChange={(e) =>
            updateMeta({
              resultSlide: {
                ...result,
                enabled: true,
                ...(isPass ? { passMessage: e.target.value } : { failMessage: e.target.value }),
              },
            })
          }
          placeholder="Message"
        />
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={result.showScore ?? true}
            onChange={(e) => updateMeta({ resultSlide: { ...result, enabled: true, showScore: e.target.checked } })}
          />
          Show score
        </label>
      </div>
    </SlideFrame>
  );
}

export function SlideViewEditor() {
  const { quiz, activeQuestionId, activeSlide } = useQuizStore();
  const question = quiz.questions.find((q) => q.id === activeQuestionId);

  if (activeSlide === "intro") return <IntroSlideEditor />;
  if (activeSlide === "pass") return <ResultSlideEditor type="pass" />;
  if (activeSlide === "fail") return <ResultSlideEditor type="fail" />;

  if (!question) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-5xl mb-3">🎨</div>
          <p className="text-sm">Select a question or slide to preview</p>
        </div>
      </div>
    );
  }

  return (
    <SlideFrame question={question}>
      {question.type === "mcq" || question.type === "image_choice" ? (
        <McqSlideContent question={question} />
      ) : question.type === "tf" ? (
        <>
          <p className="text-lg font-medium mb-6">{question.stem || "Question text"}</p>
          <div className="flex gap-4">
            {["TRUE", "FALSE"].map((label) => (
              <label key={label} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full border-2 border-current" />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-lg font-medium mb-4">{question.stem || "Question text"}</p>
          <p className="text-sm opacity-60">Slide preview for {question.type} — use Form View for full editing</p>
        </>
      )}
    </SlideFrame>
  );
}
