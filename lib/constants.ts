import { FasteKostnader } from './types';

export const C = {
  navy:    '#141414', navyL: '#1E1E1E', navyM: '#252525',
  navyB:   '#2E2E2E', navyHL: '#383838',
  amber:   '#E8E8E8', amberL: '#FFFFFF',
  red:     '#E8445A', redL:   '#FF6B7A',
  green:   '#22C55E', greenL: '#4ADE80',
  indigo:  '#9CA3AF',
  white:   '#F5F5F5', gray: '#9CA3AF', grayD: '#6B7280',
  border:  '#2A2A2A',
};

export const MONTHS_NO = ['Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember'];

export const BEDRIFTSTYPER = [
  { id:'restaurant',    icon:'🍽️',  label:'Restaurant / Kafé'         },
  { id:'frisør',        icon:'✂️',   label:'Frisør / Skjønnhet'        },
  { id:'butikk',        icon:'🛒',   label:'Butikk / Dagligvare'       },
  { id:'håndverk',      icon:'🏗️',  label:'Håndverk / Bygg'           },
  { id:'konsulent',     icon:'💻',   label:'Konsulent / Markedsføring' },
  { id:'treningssenter',icon:'🏋️', label:'Treningssenter / Studio'   },
  { id:'transport',     icon:'🚗',   label:'Transport / Logistikk'     },
  { id:'nettbutikk',    icon:'📦',   label:'Nettbutikk / E-handel'     },
  { id:'helse',         icon:'🏥',   label:'Helse / Velvære'           },
  { id:'annet',         icon:'⚙️',   label:'Annet'                     },
];

export const FASTE_DEFAULTS: Record<string, Partial<FasteKostnader>> = {
  restaurant:    { husleie:20000, strøm:3000, betalingsterminal:500, forsikring:2000 },
  frisør:        { husleie:12000, strøm:1500, betalingsterminal:300, forsikring:1200 },
  butikk:        { husleie:25000, strøm:2500, betalingsterminal:800, forsikring:3000 },
  håndverk:      { husleie:8000,  strøm:1000, forsikring:5000 },
  konsulent:     { internett:600, strøm:500,  forsikring:800 },
  treningssenter:{ husleie:30000, strøm:5000, betalingsterminal:500, forsikring:2500 },
  transport:     { husleie:5000,  forsikring:8000 },
  nettbutikk:    { internett:800, betalingsterminal:300, forsikring:500 },
  helse:         { husleie:15000, strøm:2000, betalingsterminal:300, forsikring:3000 },
  annet:         {},
};
