import React from "react";
import { Composition } from "remotion";
import { MapComposition } from "./MapComposition";
import { CANVAS_W, CANVAS_H, FPS } from "./mapData";
import { schema } from "./schema";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EuropeMap"
        component={MapComposition}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        schema={schema}
        defaultProps={{"mode":"directions" as const,"startAddress":"Ghent, Belgium","endAddress":"paris, France","startLabel":"Ghent","endLabel":"Paris","zoomMode":"manual" as const,"zoom":7,"lineColor":"#e53935","lineWidth":10,"lineStyle":"dotted" as const,"pencilStrength":10,"labelBgColor":"#d9de4e","labelTextColor":"#000000","minPopulation":100000,"duration":5,"gpxFile":"Glenha-Bikerafting-Loop.gpx" as const}}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.round(props.duration * FPS),
        })}
      />
    </>
  );
};
