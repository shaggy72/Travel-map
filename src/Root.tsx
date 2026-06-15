import React from "react";
import { Composition } from "remotion";
import { MapComposition } from "./MapComposition";
import { CANVAS_W, CANVAS_H, FPS, getDimensions, MAPBOX_STYLE } from "./mapData";
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
        defaultProps={{"mode":"directions" as const,"travelMode":"driving" as const,"startAddress":"Ghent, Belgium","endAddress":"paris, France","startLabel":"Ghent","endLabel":"Paris","mapStyle":MAPBOX_STYLE,"mapBgColor":"#ffffff","zoomMode":"manual" as const,"zoom":7,"lineColor":"#e53935","lineWidth":10,"pinSize":6,"lineStyle":"dotted" as const,"pencilStrength":10,"routeMarker":"none" as const,"routeMarkerSize":60,"labelMode":"animated" as const,"labelAnimation":"left-to-right" as const,"labelFont":"Helvetica" as const,"labelBgColor":"#d9de4e","labelTextColor":"#000000","minPopulation":100000,"cityFont":"Helvetica" as const,"cityUppercase":false,"cityColorBig":"#333333","cityColorMedium":"#555555","cityColorSmall":"#999999","citySizeBig":44,"citySizeMedium":31,"citySizeSmall":22,"flightCurve":40,"duration":5,"gpxFile":"Glenha-Bikerafting-Loop.gpx" as const,"outputFormat":"portrait" as const,"showElevationProfile":false,"elevationColor":"#333333","elevationBgColor":"#ffffffcc"}}
        calculateMetadata={({ props }) => {
          // Resolve canvas dimensions from the chosen output format so Remotion
          // uses the correct width/height for every frame in the render.
          const { w, h } = getDimensions(props.outputFormat ?? 'portrait');
          return {
            durationInFrames: Math.round(props.duration * FPS),
            width:  w,
            height: h,
          };
        }}
      />
    </>
  );
};
