/**
 * Timeline.tsx — ruler-style scrubber + play button + big time counter under
 * the preview (2026-09-27 "Color Stack" redesign). Drives the Remotion Player
 * through its imperative API (play/pause/seekTo + frameupdate/play/pause
 * events) — the Player's own control bar is hidden.
 */
import React, { useState, useEffect } from 'react';
import type { PlayerRef } from '@remotion/player';
import { PlayIcon, PauseIcon } from './icons';

const TICKS = 50;

function fmt(seconds: number): string {
  const s = seconds.toFixed(1);
  return seconds < 10 ? `0${s}` : s;
}

export default function Timeline({
  player, durationInFrames, fps, compact = false,
}: {
  player: PlayerRef | null;
  durationInFrames: number;
  fps: number;
  compact?: boolean;
}) {
  const [frame,   setFrame]   = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!player) return;
    setFrame(player.getCurrentFrame());
    setPlaying(player.isPlaying());
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('seeked', onFrame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('seeked', onFrame);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, [player]);

  const last = Math.max(1, durationInFrames - 1);
  const pct  = Math.min(100, (frame / last) * 100);

  return (
    <div className={`timeline${compact ? ' timeline--compact' : ''}`}>
      <div className="ruler" style={{ '--played': `${pct}%` } as React.CSSProperties}>
        <div className="ruler-ticks" aria-hidden="true">
          {Array.from({ length: TICKS + 1 }, (_, i) => (
            <span key={i} className={i % 10 === 0 ? 'tick tick--major' : i % 5 === 0 ? 'tick tick--mid' : 'tick'} />
          ))}
        </div>
        <span className="ruler-head" aria-hidden="true" />
        <input
          type="range"
          className="ruler-input"
          min={0}
          max={last}
          value={Math.min(frame, last)}
          aria-label="Scrub timeline"
          aria-valuetext={`${(frame / fps).toFixed(1)} seconds`}
          onChange={e => {
            const f = Number(e.target.value);
            setFrame(f);
            player?.seekTo(f);
          }}
        />
      </div>
      <div className="timeline-controls">
        <button
          type="button"
          className="play-btn"
          aria-label={playing ? 'Pause preview' : 'Play preview'}
          onClick={() => player?.toggle()}
          disabled={!player}
        >
          {playing ? <PauseIcon size={compact ? 24 : 28} /> : <PlayIcon size={compact ? 26 : 32} />}
        </button>
        <span className="time-counter">
          <span className="time-now">{fmt(frame / fps)}</span>
          <span className="time-total">/ {(durationInFrames / fps).toFixed(1)} s</span>
        </span>
      </div>
    </div>
  );
}
