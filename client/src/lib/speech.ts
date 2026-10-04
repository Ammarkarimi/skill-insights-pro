/** Browser speech helpers shared by the interview modes (Web Speech API, Chrome/Edge). */

// Minimal typing for the Web Speech API (not in the TS DOM lib).
export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export const getRecognition = (): SpeechRecognitionLike | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
};

export const isSpeechSupported = (): boolean => getRecognition() !== null;

/** Read text aloud; returns false when speech synthesis is unavailable. */
export function speak(text: string, onStart?: () => void, onEnd?: () => void): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

export const READINESS_LABELS: Record<string, string> = {
  ready: "Interview ready",
  almost_ready: "Almost ready",
  needs_practice: "Needs more practice",
  not_ready: "Not ready yet",
};
