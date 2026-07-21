"use client";

import { useRef, useState } from "react";
import { Play, Pause, Mic } from "lucide-react";

interface Props {
  user: string;
  audioUrl: string;
  timestamp: string;
}

export function VoiceNotePlayer({ user, audioUrl, timestamp }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setProgress(isFinite(pct) ? pct : 0);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2.5 rounded border border-border bg-canvas px-3 py-2">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      <button
        onClick={togglePlay}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber/10 text-amber transition-colors hover:bg-amber/20"
      >
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Mic className="h-2.5 w-2.5 text-amber" />
          <span className="text-[8px] font-bold uppercase tracking-wider text-amber">Voice Note</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-elevated">
          <div
            className="h-full rounded-full bg-amber transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="font-mono text-[8px] text-fg-muted">{formatTime(duration * progress / 100)}</span>
          <span className="font-mono text-[8px] text-fg-muted">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
