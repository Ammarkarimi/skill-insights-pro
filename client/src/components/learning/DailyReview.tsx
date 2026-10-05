import React, { useState } from "react";
import { CheckCircle2, Loader2, PartyPopper, Play, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage } from "@/lib/api";
import { ReviewCard, SOURCE_LABEL } from "@/lib/learning";
import { cn } from "@/lib/utils";

interface Graded {
  correct: boolean;
  answer: string;
  explanation: string;
  nextDue: string;
}

const inDays = (iso: string) => Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 86400000));

const DailyReview: React.FC<{ dueCount: number; totalCards: number; onProgress: () => void }> = ({ dueCount, totalCards, onProgress }) => {
  const { toast } = useToast();
  const [cards, setCards] = useState<ReviewCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [graded, setGraded] = useState<Graded | null>(null);
  const [score, setScore] = useState({ right: 0, done: 0 });
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const { data } = await api.get<{ cards: ReviewCard[] }>("/api/learning/review");
      setCards(data.cards);
      setIndex(0);
      setScore({ right: 0, done: 0 });
      setGraded(null);
      setPicked(null);
    } catch (err) {
      toast({ title: "Could not load your review", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const answer = async (letter: string) => {
    if (!cards || graded) return;
    setPicked(letter);
    setBusy(true);
    try {
      const { data } = await api.post<Graded>(`/api/learning/review/${cards[index].id}`, { answer: letter });
      setGraded(data);
      setScore((s) => ({ right: s.right + (data.correct ? 1 : 0), done: s.done + 1 }));
      onProgress();
    } catch (err) {
      toast({ title: "Could not save your answer", description: apiErrorMessage(err), variant: "destructive" });
      setPicked(null);
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    setGraded(null);
    setPicked(null);
    setIndex((i) => i + 1);
  };

  if (!cards) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily review</CardTitle>
          <CardDescription>
            {dueCount > 0
              ? `${dueCount} question${dueCount === 1 ? "" : "s"} you got wrong before ${dueCount === 1 ? "is" : "are"} due. About two minutes.`
              : totalCards > 0
                ? "All caught up. Missed questions come back at growing intervals until they stick."
                : "Questions you get wrong in skill assessments, skill proofs and aptitude tests will appear here for review."}
          </CardDescription>
        </CardHeader>
        {dueCount > 0 && (
          <CardContent>
            <Button onClick={start} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Start review
            </Button>
          </CardContent>
        )}
      </Card>
    );
  }

  if (index >= cards.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <PartyPopper className="h-10 w-10 mx-auto text-primary" />
          <p className="text-lg font-semibold">
            Review done: {score.right}/{score.done} correct
          </p>
          <p className="text-sm text-gray-600">Correct answers come back later; missed ones come back tomorrow.</p>
          <Button variant="outline" onClick={() => setCards(null)}>
            Close
          </Button>
        </CardContent>
      </Card>
    );
  }

  const card = cards[index];
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex flex-wrap items-center gap-2">
          Card {index + 1} of {cards.length}
          <Badge variant="outline">{SOURCE_LABEL[card.source]}</Badge>
          {card.skill && <Badge variant="secondary">{card.skill}</Badge>}
          {card.topic && <span className="text-xs">{card.topic}</span>}
        </CardDescription>
        {card.passage && <p className="rounded bg-gray-50 p-3 text-sm">{card.passage}</p>}
        <CardTitle className="text-lg leading-snug">{card.question}</CardTitle>
        {card.code && <pre className="overflow-x-auto rounded bg-gray-950 p-3 text-xs text-gray-100">{card.code}</pre>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          {Object.entries(card.options).map(([k, text]) => {
            const isAnswer = graded?.answer === k;
            const wrongPick = graded && picked === k && !graded.correct;
            return (
              <button
                key={k}
                onClick={() => answer(k)}
                disabled={!!graded || busy}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3 text-left text-sm transition-colors",
                  !graded && "hover:bg-gray-50",
                  isAnswer && "border-green-500 bg-green-50",
                  wrongPick && "border-red-400 bg-red-50",
                )}
              >
                <span className="font-semibold">{k}.</span>
                <span className="flex-1">{text}</span>
                {isAnswer && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                {wrongPick && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
              </button>
            );
          })}
        </div>
        {graded && (
          <div className="space-y-3">
            <p className={cn("text-sm", graded.correct ? "text-green-700" : "text-red-700")}>
              {graded.correct ? `Correct. You will see this again in ${inDays(graded.nextDue)} days.` : "Not quite. This one comes back tomorrow."}
            </p>
            <p className="text-sm text-gray-700">{graded.explanation}</p>
            <Button onClick={next}>{index + 1 < cards.length ? "Next card" : "Finish"}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyReview;
