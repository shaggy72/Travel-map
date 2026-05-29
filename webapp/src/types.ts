/** Mirror of src/schema.ts — plain TypeScript, no Zod dependency. */
export interface Props {
  mode:           'directions' | 'gpx';
  gpxFile:        string;
  startAddress:   string;
  endAddress:     string;
  startLabel:     string;
  endLabel:       string;
  zoomMode:       'auto' | 'manual';
  zoom:           number;
  lineColor:      string;
  lineWidth:      number;
  lineStyle:      'solid' | 'dashed' | 'dotted' | 'long-dash' | 'dash-dot' | 'pencil';
  pencilStrength: number;
  labelBgColor:   string;
  labelTextColor: string;
  minPopulation:  number;
  duration:       number;
}

export const DEFAULT_PROPS: Props = {
  mode:           'directions',
  gpxFile:        '',
  startAddress:   'Ghent, Belgium',
  endAddress:     'Lauris, France',
  startLabel:     'Ghent',
  endLabel:       'Lauris',
  zoomMode:       'auto',
  zoom:           5.5,
  lineColor:      '#e53935',
  lineWidth:      4,
  lineStyle:      'solid',
  pencilStrength: 5,
  labelBgColor:   '#555555',
  labelTextColor: '#ffffff',
  minPopulation:  100000,
  duration:       5,
};
