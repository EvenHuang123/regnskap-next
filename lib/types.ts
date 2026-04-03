export interface Profil {
  bedriftsnavn: string;
  eierNavn: string;
  bedriftstype: string;
  selskapsform: 'AS' | 'ENK';
  antallAnsatte: string;
  opprettet?: string;
}

export interface MonthData {
  month: string;
  inntekter: number;
  varekostnader: number;
  lønnskostnader: number;
  andreKostnader: number;
  mvaInnbetalt: number;
  savedAt?: string;
}

export interface FasteKostnader {
  husleie: number;
  strøm: number;
  internett: number;
  betalingsterminal: number;
  forsikring: number;
  andreFasteNavn?: string;
  andreFasteBeløp: number;
}

export interface Ansatt {
  id: string;
  navn: string;
  lønnstype: 'måned' | 'time';
  månedslønn: number;
  timelønn: number;
  estimerteTimer: number;
  stillingsprosent: number;
  ansatttype: 'Fast' | 'Deltid' | 'Tilkalling';
}

export interface DerivedData {
  bruttofortjeneste: number;
  totaleKostnader: number;
  driftsresultat: number;
  netteMva: number;
  lønnsandel: number;
  bruttomargin: number;
}
