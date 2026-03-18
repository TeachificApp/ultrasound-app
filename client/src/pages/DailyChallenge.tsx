import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, Clock, Target, Trophy, XCircle } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@shared/appConstants";

export default function DailyChallenge() {
  const { isAuthenticated } = useAuth();
  const [selectedAnswer, setSelectedAnswer] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const challengeQuery = trpc.challenge.today.useQuery();
  const myResponseQuery = trpc.challenge.myResponse.useQuery(undefined, { enabled: isAuthenticated });
  const submitMutation = trpc.challenge.submit.useMutation({
    onSuccess: () => { setSubmitted(true); },
    onError: (e: any) => toast.error(e.message),
  });

  const challenge = challengeQuery.data;
  const myResponse = myResponseQuery.data;
  const alreadyAnswered = !!myResponse;

  const options: { key: "A" | "B" | "C" | "D"; label: string }[] = challenge ? [
    { key: "A", label: challenge.optionA },
    { key: "B", label: challenge.optionB },
    { key: "C", label: challenge.optionC },
    { key: "D", label: challenge.optionD },
  ] : [];

  const effectiveAnswer = alreadyAnswered ? myResponse.selectedAnswer : selectedAnswer;
  const isCorrect = (alreadyAnswered || submitted) && effectiveAnswer === challenge?.correctAnswer;

  return (
    <div className="min-h-screen bg-background">
      <div className="aaus-gradient px-4 py-4 text-white">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Target size={18} />
            <h1 className="text-lg font-bold" style={{ fontFamily: "Merriweather, serif" }}>Daily Challenge</h1>
          </div>
          <p className="text-white/80 text-xs mt-0.5">One new question every day — test your knowledge</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {!isAuthenticated ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-6 text-center">
              <Target size={32} className="text-primary mx-auto mb-3" />
              <p className="font-semibold mb-1">Sign in to access Daily Challenge</p>
              <p className="text-sm text-muted-foreground mb-4">Track your streak and compete on the leaderboard</p>
              <a href={getLoginUrl()}><Button>Sign In</Button></a>
            </CardContent>
          </Card>
        ) : challengeQuery.isLoading ? (
          <Card className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
        ) : !challenge ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Clock size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No challenge available today. Check back soon!</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Question */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  {challenge.category && (
                    <Badge className={`text-[10px] ${CATEGORY_COLORS[challenge.category] ?? "bg-gray-100 text-gray-800"}`}>
                      {CATEGORY_LABELS[challenge.category] ?? challenge.category}
                    </Badge>
                  )}
                </div>
                <p className="font-medium text-sm mb-4">{challenge.question}</p>

                <div className="space-y-2">
                  {options.map(({ key, label }) => {
                    const isSelected = effectiveAnswer === key;
                    const showResult = alreadyAnswered || submitted;
                    const isCorrectOption = key === challenge.correctAnswer;
                    let className = "w-full text-left p-3 rounded-lg border text-sm transition-all ";
                    if (!showResult) {
                      className += isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/40";
                    } else if (isCorrectOption) {
                      className += "border-green-500 bg-green-50 text-green-700";
                    } else if (isSelected && !isCorrectOption) {
                      className += "border-red-400 bg-red-50 text-red-700";
                    } else {
                      className += "border-border opacity-60";
                    }
                    return (
                      <button key={key} className={className}
                        onClick={() => !showResult && setSelectedAnswer(key)}
                        disabled={showResult}>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs w-4">{key}.</span>
                          {showResult && isCorrectOption && <CheckCircle size={14} className="text-green-500 flex-shrink-0" />}
                          {showResult && isSelected && !isCorrectOption && <XCircle size={14} className="text-red-500 flex-shrink-0" />}
                          <span>{label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {!alreadyAnswered && !submitted ? (
                  <Button className="w-full mt-4" disabled={selectedAnswer === null || submitMutation.isPending}
                    onClick={() => submitMutation.mutate({ challengeId: challenge.id, selectedAnswer: selectedAnswer! })}>
                    {submitMutation.isPending ? "Submitting..." : "Submit Answer"}
                  </Button>
                ) : (
                  <div className={`mt-4 p-3 rounded-lg ${isCorrect ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                    <div className={`font-semibold text-sm mb-1 ${isCorrect ? "text-green-700" : "text-amber-700"}`}>
                      {isCorrect ? "Correct! 🎉" : "Incorrect — review the explanation"}
                    </div>
                    {challenge.explanation && (
                      <p className="text-xs text-foreground/80">{challenge.explanation}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="text-center">
              <Link href="/leaderboard">
                <Button variant="outline" size="sm" className="gap-1">
                  <Trophy size={14} /> View Leaderboard
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
