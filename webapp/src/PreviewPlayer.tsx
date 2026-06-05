import React, { useRef, useEffect } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { MapComposition } from '../../src/MapComposition';
import { FPS, getDimensions } from '../../src/mapData';
import { Props } from './types';

interface PreviewPlayerProps {
  props: Props;
}

export default function PreviewPlayer({ props }: PreviewPlayerProps) {
  const playerRef = useRef<PlayerRef>(null);

  const durationInFrames = Math.max(1, Math.round(props.duration * FPS));
  // Resolve canvas dimensions from the selected output format so the preview
  // aspect ratio matches what the final render will produce.
  const { w, h } = getDimensions(props.outputFormat ?? 'portrait');

  // The `autoPlay` prop sets internal state to "playing" on mount but fires
  // before the Player finishes initialising — on page refresh this leaves the
  // button showing "Pause" while frames don't actually advance.
  // Calling play() imperatively after a short defer is more reliable.
  useEffect(() => {
    const timer = setTimeout(() => {
      playerRef.current?.play();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Player
      ref={playerRef}
      component={MapComposition as React.ComponentType<Record<string, unknown>>}
      inputProps={props as Record<string, unknown>}
      durationInFrames={durationInFrames}
      compositionWidth={w}
      compositionHeight={h}
      fps={FPS}
      style={{ width: '100%', height: '100%' }}
      controls
      loop
    />
  );
}
