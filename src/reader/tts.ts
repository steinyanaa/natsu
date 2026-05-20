export interface TTSState {
  playing: boolean;
  utterance: SpeechSynthesisUtterance | null;
  currentSentenceIndex: number;
  sentences: string[];
}

export function splitSentences(text: string): string[] {
  // 按中英文句末标点分割
  return text
    .split(/(?<=[。！？.!?\n])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function getVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices();
}
