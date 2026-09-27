import React, { useRef, useEffect } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { MapComposition } from '../../src/MapComposition';
import { FPS, getDimensions } from '../../src/mapData';
import { Props } from './types';

interface PreviewPlayerProps {
  props: Props;
  // Hands the Player instance to App so the custom ruler timeline (Timeline.tsx)
  // can drive play/pause/seek — Remotion's own controls are hidden.
  onReady: (player: PlayerRef | null) => void;
}

export default function PreviewPlayer({ props, onReady }: PreviewPlayerProps) {
  const playerRef = useRef<PlayerRef>(null);

  const durationInFrames = Math.max(1, Math.round(props.duration * FPS));
  // Resolve canvas dimensions from the selected output format so the preview
  // aspect ratio matches what the final render will produce.
  const { w, h } = getDimensions(props.outputFormat ?? 'portrait');

  // The `autoPlay` prop sets internal state to "playing" on mount but fires
  // before the Player finishes initialising — on page refresh this leaves the
  // player "playing" while frames don't actually advance.
  // Calling play() imperatively after a short defer is more reliable.
  useEffect(() => {
    onReady(playerRef.current);
    const timer = setTimeout(() => {
      playerRef.current?.play();
    }, 100);
    return () => { clearTimeout(timer); onReady(null); };
  }, []);

  return (
    <Player
      ref={playerRef}
      component={MapComposition as React.ComponentType<Record<string, unknown>>}
      inputProps={props as unknown as Record<string, unknown>}
      durationInFrames={durationInFrames}
      compositionWidth={w}
      compositionHeight={h}
      fps={FPS}
      style={{ width: '100%', height: '100%' }}
      clickToPlay
      loop
    />
  );
}
