/**
 * Client-side delivery analytics for spoken answers (no AI cost).
 * Tracks when speech-recognition results arrive to estimate speaking time, pace and pauses,
 * and counts filler words in the final text.
 */

export interface DeliveryMetrics {
  mode: "voice" | "typed";
  words: number;
  durationSec: number;
  wpm: number;
  fillers: number;
  longPauses: number;
}

const FILLER_RE = /\b(um+|uh+|erm|you know|basically|actually|sort of|kind of|i mean)\b/gi;
const LONG_PAUSE_MS = 3000;

export const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
export const countFillers = (text: string) => (text.match(FILLER_RE) || []).length;

export class DeliveryTracker {
  private segmentStart: number | null = null;
  private lastEvent: number | null = null;
  private speakingMs = 0;
  private pauses = 0;
  private usedVoice = false;

  /** Call when recording starts. */
  start(now = Date.now()) {
    this.segmentStart = now;
    this.lastEvent = now;
    this.usedVoice = true;
  }

  /** Call on every speech-recognition result event. */
  onResult(now = Date.now()) {
    if (this.lastEvent !== null && now - this.lastEvent > LONG_PAUSE_MS) this.pauses += 1;
    this.lastEvent = now;
  }

  /** Call when recording stops. */
  stop() {
    if (this.segmentStart !== null && this.lastEvent !== null) {
      this.speakingMs += Math.max(0, this.lastEvent - this.segmentStart);
    }
    this.segmentStart = null;
    this.lastEvent = null;
  }

  reset() {
    this.segmentStart = null;
    this.lastEvent = null;
    this.speakingMs = 0;
    this.pauses = 0;
    this.usedVoice = false;
  }

  metrics(finalText: string): DeliveryMetrics {
    this.stop();
    const words = countWords(finalText);
    if (!this.usedVoice) return { mode: "typed", words, durationSec: 0, wpm: 0, fillers: 0, longPauses: 0 };
    const durationSec = Math.max(1, Math.round(this.speakingMs / 1000));
    return {
      mode: "voice",
      words,
      durationSec,
      wpm: Math.round((words / durationSec) * 60),
      fillers: countFillers(finalText),
      longPauses: this.pauses,
    };
  }
}
