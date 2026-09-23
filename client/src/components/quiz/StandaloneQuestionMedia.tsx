import React from "react";

function preventMediaContextMenu(event: React.MouseEvent<HTMLElement>) {
  event.preventDefault();
}

function NativeQuizVideo({ src, className }: { src: string; className: string }) {
  return (
    <video
      src={src}
      controls
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      onContextMenu={preventMediaContextMenu}
      className={`native-quiz-video ${className}`}
    />
  );
}

export function StandaloneQuestionMedia({
  questionImageUrl,
  questionVideoUrl,
  feedbackImageUrl,
  feedbackVideoUrl,
  showFeedback = false,
}: {
  questionImageUrl?: string | null;
  questionVideoUrl?: string | null;
  feedbackImageUrl?: string | null;
  feedbackVideoUrl?: string | null;
  showFeedback?: boolean;
}) {
  return (
    <>
      {questionImageUrl && (
        <img
          src={questionImageUrl}
          alt="Question"
          draggable={false}
          onContextMenu={preventMediaContextMenu}
          className="w-full max-h-64 object-contain rounded-lg mb-4 bg-gray-50 select-none"
        />
      )}
      {questionVideoUrl && <NativeQuizVideo src={questionVideoUrl} className="w-full max-h-64 rounded-lg mb-4" />}
      {showFeedback && feedbackImageUrl && (
        <img
          src={feedbackImageUrl}
          alt="Explanation"
          draggable={false}
          onContextMenu={preventMediaContextMenu}
          className="mt-3 w-full max-h-48 object-contain rounded-lg bg-gray-50 select-none"
        />
      )}
      {showFeedback && feedbackVideoUrl && <NativeQuizVideo src={feedbackVideoUrl} className="mt-3 w-full max-h-48 rounded-lg" />}
    </>
  );
}
