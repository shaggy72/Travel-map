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
        defaultProps={{"mode":"directions" as const,"travelMode":"driving" as const,"startAddress":"Ghent, Belgium","endAddress":"paris, France","startLabel":"Ghent","endLabel":"Paris","mapStyle":"shaggy72/cmpma5agg000101qr4tt68gad","mapBgColor":"#ffffff","zoomMode":"manual" as const,"zoom":7,"lineColor":"#e53935","lineWidth":10,"lineStyle":"dotted" as const,"pencilStrength":10,"labelMode":"animated" as const,"labelAnimation":"left-to-right" as const,"labelBgColor":"#d9de4e","labelTextColor":"#000000","minPopulation":100000,"cityFont":"Helvetica" as const,"cityUppercase":false,"cityColorBig":"#333333","cityColorMedium":"#555555","cityColorSmall":"#999999","citySizeBig":44,"citySizeMedium":31,"citySizeSmall":22,"duration":5,"gpxFile":"Glenha-Bikerafting-Loop.gpx" as const}}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.round(props.duration * FPS),
        })}
      />
    </>
  );
};
