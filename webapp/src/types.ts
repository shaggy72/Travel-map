/** Mirror of src/schema.ts — plain TypeScript, no Zod dependency. */
export interface Props {
  mode:           'directions' | 'gpx';
  gpxFile:        string;
  startAddress:   string;
  endAddress:     string;
  startLabel:     string;
  endLabel:       string;
  mapStyle:       string;
  zoomMode:       'auto' | 'manual';
  zoom:           number;
  lineColor:      string;
  lineWidth:      number;
  lineStyle:      'solid' | 'dashed' | 'dotted' | 'long-dash' | 'dash-dot' | 'pencil';
  pencilStrength: number;
  labelMode:      'animated' | 'on' | 'off';
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
}

export const DEFAULT_PROPS: Props = {
  mode:           'directions',
  gpxFile:        '',
  startAddress:   'Ghent, Belgium',
  endAddress:     'Lauris, France',
  startLabel:     'Ghent',
  endLabel:       'Lauris',
  mapStyle:       'shaggy72/cmpma5agg000101qr4tt68gad',
  zoomMode:       'auto',
  zoom:           5.5,
  lineColor:      '#e53935',
  lineWidth:      4,
  lineStyle:      'solid',
  pencilStrength: 5,
  labelMode:      'animated',
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
};
