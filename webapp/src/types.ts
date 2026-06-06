/** Mirror of src/schema.ts — plain TypeScript, no Zod dependency. */
export interface Props {
  mode:           'directions' | 'gpx';
  travelMode:     'driving' | 'cycling' | 'walking' | 'flight';
  gpxFile:        string;
  startAddress:   string;
  endAddress:     string;
  startLabel:     string;
  endLabel:       string;
  mapStyle:       string;
  mapBgColor:     string;
  zoomMode:       'auto' | 'manual';
  zoom:           number;
  lineColor:      string;
  lineWidth:      number;
  /** Radius of the start/end pin dots in canvas pixels. Fill = lineColor. */
  pinSize:        number;
  lineStyle:       'solid' | 'dashed' | 'dotted' | 'long-dash' | 'dash-dot' | 'pencil';
  pencilStrength:  number;
  /** Icon at the tip of the route line. 'none' = disabled. */
  routeMarker:     'none' | 'car' | 'camper' | 'plane' | 'bike' | 'walk';
  /** Diameter of the circular marker badge in canvas pixels. */
  routeMarkerSize: number;
  labelMode:      'animated' | 'on' | 'off';
  labelAnimation: string;
  labelBgColor:   string;
  labelTextColor: string;
  minPopulation:  number;
  cityFont:       string;
  cityUppercase:  boolean;
  cityColorBig:   string;
  cityColorMedium:string;
  cityColorSmall: string;
  citySizeBig:    number;
  citySizeMedium: number;
  citySizeSmall:  number;
  duration:       number;
  /** Output canvas format — controls width × height of the rendered video.
   *  portrait = 1080×1920 (9:16), landscape = 1920×1080 (16:9), square = 1080×1080 */
  outputFormat:   'portrait' | 'landscape' | 'square';
}

export const DEFAULT_PROPS: Props = {
  mode:           'directions',
  travelMode:     'driving',
  gpxFile:        '',
  startAddress:   'Ghent, Belgium',
  endAddress:     'Lauris, France',
  startLabel:     'Ghent',
  endLabel:       'Lauris',
  mapStyle:       process.env.MAPBOX_STYLE || 'mapbox/light-v11',
  mapBgColor:     '#ffffff',
  zoomMode:       'auto',
  zoom:           5.5,
  lineColor:      '#e53935',
  lineWidth:      10,
  pinSize:        6,
  lineStyle:       'solid',
  pencilStrength:  5,
  routeMarker:     'none',
  routeMarkerSize: 60,
  labelMode:      'animated',
  labelAnimation: 'left-to-right',
  labelBgColor:   '#555555',
  labelTextColor: '#ffffff',
  minPopulation:  100000,
  cityFont:       'Helvetica',
  cityUppercase:  false,
  cityColorBig:   '#333333',
  cityColorMedium:'#555555',
  cityColorSmall: '#999999',
  citySizeBig:    44,
  citySizeMedium: 31,
  citySizeSmall:  22,
  duration:       5,
  outputFormat:   'portrait',
};
