import React from "react";

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
      {questionImageUrl && <img src={questionImageUrl} alt="Question" className="w-full max-h-64 object-contain rounded-lg mb-4 bg-gray-50" />}
      {questionVideoUrl && <video src={questionVideoUrl} controls className="w-full max-h-64 rounded-lg mb-4 bg-black" />}
      {showFeedback && feedbackImageUrl && <img src={feedbackImageUrl} alt="Explanation" className="mt-3 w-full max-h-48 object-contain rounded-lg bg-gray-50" />}
      {showFeedback && feedbackVideoUrl && <video src={feedbackVideoUrl} controls className="mt-3 w-full max-h-48 rounded-lg bg-black" />}
    </>
  );
}
