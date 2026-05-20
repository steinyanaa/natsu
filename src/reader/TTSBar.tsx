import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type * as React from "react";
import { splitSentences } from "./tts";

export function TTSBar({
  text,
  onClose,
}: {
  text: string;
  onClose: () => void;
}) {
  // SpeechSynthesis not available — bail out
  if (!window.speechSynthesis) {
    onClose();
    return null;
  }

  const [playing, setPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceIndex, setVoiceIndex] = useState(0);
  const sentences = useRef<string[]>([]);
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    sentences.current = splitSentences(text);
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      synthRef.current.cancel();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [text]);

  const speakFrom = (index: number) => {
    synthRef.current.cancel();
    if (index >= sentences.current.length) {
      setPlaying(false);
      return;
    }
    setCurrentIndex(index);
    const utterance = new SpeechSynthesisUtterance(sentences.current[index]);
    utterance.rate = rate;
    if (voices[voiceIndex]) utterance.voice = voices[voiceIndex];
    utterance.onend = () => speakFrom(index + 1);
    utterance.onerror = () => setPlaying(false);
    synthRef.current.speak(utterance);
    setPlaying(true);
  };

  const togglePlay = () => {
    if (playing) {
      synthRef.current.pause();
      setPlaying(false);
    } else {
      if (synthRef.current.paused) {
        synthRef.current.resume();
        setPlaying(true);
      } else {
        speakFrom(currentIndex);
      }
    }
  };

  return (
    <div className="tts-bar">
      <button className="icon-button pressable" onClick={() => speakFrom(Math.max(0, currentIndex - 1))}>
        <SkipBack size={16} />
      </button>
      <button className="tts-play-btn pressable" onClick={togglePlay}>
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button className="icon-button pressable" onClick={() => speakFrom(currentIndex + 1)}>
        <SkipForward size={16} />
      </button>

      <select
        className="tts-rate-select"
        value={rate}
        onChange={(e) => { setRate(Number(e.target.value)); synthRef.current.cancel(); setPlaying(false); }}
      >
        {[0.75, 1, 1.25, 1.5, 2].map((r) => (
          <option key={r} value={r}>{r}×</option>
        ))}
      </select>

      {voices.length > 1 && (
        <select
          className="tts-voice-select"
          value={voiceIndex}
          onChange={(e) => { setVoiceIndex(Number(e.target.value)); synthRef.current.cancel(); setPlaying(false); }}
        >
          {voices.map((v, i) => (
            <option key={v.name} value={i}>{v.name}</option>
          ))}
        </select>
      )}

      <span className="tts-progress">
        {sentences.current.length > 0 ? `${currentIndex + 1} / ${sentences.current.length}` : ""}
      </span>

      <button className="icon-button pressable" onClick={() => { synthRef.current.cancel(); onClose(); }}>
        <X size={16} />
      </button>
    </div>
  );
}
