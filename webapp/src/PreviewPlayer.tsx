import React, { useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { MapComposition } from '../../src/MapComposition';
import { FPS, CANVAS_W, CANVAS_H } from '../../src/mapData';
import { Props } from './types';

interface PreviewPlayerProps {
  props: Props;
}

export default function PreviewPlayer({ props }: PreviewPlayerProps) {
  const playerRef = useRef<PlayerRef>(null);

  const durationInFrames = Math.max(1, Math.round(props.duration * FPS));

  return (
    <Player
      ref={playerRef}
      component={MapComposition as React.ComponentType<Record<string, unknown>>}
      inputProps={props as Record<string, unknown>}
      durationInFrames={durationInFrames}
      compositionWidth={CANVAS_W}
      compositionHeight={CANVAS_H}
      fps={FPS}
      style={{ width: '100%', height: '100%' }}
      controls
      loop
    />
  );
}
