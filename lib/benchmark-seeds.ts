/**
 * Seeded industry benchmarks (ratios) based on Norwegian SMB statistics.
 * Used as fallback when the community materialized view has < 5 peers.
 *
 * All values are ratios of annual revenue (0–1 range).
 * Source: SSB næringsstatistikk, Virke bransjerapporter, NHO SMB-rapport 2023.
 */

export interface BenchmarkRatios {
  avg_profit_margin: number;   // (revenue − expenses) / revenue
  avg_cogs_ratio:    number;   // varekostnader / revenue
  avg_payroll_ratio: number;   // lønnskostnader / revenue
  avg_opex_ratio:    number;   // andre_kostnader / revenue
  avg_husleie_ratio: number;   // husleie / revenue
  avg_it_ratio:      number;   // it / revenue
  avg_marketing_ratio: number; // markedsføring / revenue
  avg_transport_ratio: number; // transport / revenue
  avg_forsikring_ratio: number;// forsikring / revenue
}

export const SEED_BENCHMARKS: Record<string, BenchmarkRatios> = {
  restaurant:    { avg_profit_margin: 0.07, avg_cogs_ratio: 0.30, avg_payroll_ratio: 0.35, avg_opex_ratio: 0.20, avg_husleie_ratio: 0.08, avg_it_ratio: 0.01, avg_marketing_ratio: 0.03, avg_transport_ratio: 0.01, avg_forsikring_ratio: 0.01 },
  retail:        { avg_profit_margin: 0.05, avg_cogs_ratio: 0.62, avg_payroll_ratio: 0.18, avg_opex_ratio: 0.12, avg_husleie_ratio: 0.06, avg_it_ratio: 0.01, avg_marketing_ratio: 0.02, avg_transport_ratio: 0.01, avg_forsikring_ratio: 0.01 },
  consulting:    { avg_profit_margin: 0.25, avg_cogs_ratio: 0.04, avg_payroll_ratio: 0.45, avg_opex_ratio: 0.18, avg_husleie_ratio: 0.04, avg_it_ratio: 0.04, avg_marketing_ratio: 0.04, avg_transport_ratio: 0.02, avg_forsikring_ratio: 0.01 },
  tech:          { avg_profit_margin: 0.20, avg_cogs_ratio: 0.08, avg_payroll_ratio: 0.48, avg_opex_ratio: 0.18, avg_husleie_ratio: 0.03, avg_it_ratio: 0.08, avg_marketing_ratio: 0.07, avg_transport_ratio: 0.01, avg_forsikring_ratio: 0.01 },
  construction:  { avg_profit_margin: 0.08, avg_cogs_ratio: 0.50, avg_payroll_ratio: 0.28, avg_opex_ratio: 0.11, avg_husleie_ratio: 0.03, avg_it_ratio: 0.01, avg_marketing_ratio: 0.02, avg_transport_ratio: 0.04, avg_forsikring_ratio: 0.02 },
  healthcare:    { avg_profit_margin: 0.15, avg_cogs_ratio: 0.10, avg_payroll_ratio: 0.50, avg_opex_ratio: 0.18, avg_husleie_ratio: 0.05, avg_it_ratio: 0.02, avg_marketing_ratio: 0.02, avg_transport_ratio: 0.01, avg_forsikring_ratio: 0.01 },
  education:     { avg_profit_margin: 0.12, avg_cogs_ratio: 0.05, avg_payroll_ratio: 0.55, avg_opex_ratio: 0.18, avg_husleie_ratio: 0.06, avg_it_ratio: 0.03, avg_marketing_ratio: 0.03, avg_transport_ratio: 0.01, avg_forsikring_ratio: 0.01 },
  manufacturing: { avg_profit_margin: 0.07, avg_cogs_ratio: 0.55, avg_payroll_ratio: 0.22, avg_opex_ratio: 0.12, avg_husleie_ratio: 0.04, avg_it_ratio: 0.02, avg_marketing_ratio: 0.02, avg_transport_ratio: 0.03, avg_forsikring_ratio: 0.02 },
  real_estate:   { avg_profit_margin: 0.30, avg_cogs_ratio: 0.08, avg_payroll_ratio: 0.20, avg_opex_ratio: 0.28, avg_husleie_ratio: 0.04, avg_it_ratio: 0.02, avg_marketing_ratio: 0.05, avg_transport_ratio: 0.01, avg_forsikring_ratio: 0.02 },
  services:      { avg_profit_margin: 0.18, avg_cogs_ratio: 0.10, avg_payroll_ratio: 0.44, avg_opex_ratio: 0.22, avg_husleie_ratio: 0.05, avg_it_ratio: 0.02, avg_marketing_ratio: 0.03, avg_transport_ratio: 0.02, avg_forsikring_ratio: 0.01 },
  wholesale:     { avg_profit_margin: 0.06, avg_cogs_ratio: 0.70, avg_payroll_ratio: 0.12, avg_opex_ratio: 0.09, avg_husleie_ratio: 0.03, avg_it_ratio: 0.01, avg_marketing_ratio: 0.02, avg_transport_ratio: 0.03, avg_forsikring_ratio: 0.01 },
  other:         { avg_profit_margin: 0.12, avg_cogs_ratio: 0.25, avg_payroll_ratio: 0.40, avg_opex_ratio: 0.20, avg_husleie_ratio: 0.05, avg_it_ratio: 0.02, avg_marketing_ratio: 0.03, avg_transport_ratio: 0.02, avg_forsikring_ratio: 0.01 },
};

/** Map existing bedriftstype IDs to benchmark industry keys */
export const BEDRIFTSTYPE_TO_INDUSTRY: Record<string, string> = {
  restaurant:     'restaurant',
  frisør:         'services',
  butikk:         'retail',
  håndverk:       'construction',
  konsulent:      'consulting',
  treningssenter: 'healthcare',
  transport:      'services',
  nettbutikk:     'retail',
  helse:          'healthcare',
  annet:          'other',
};

/** Map antall_ansatte string to company_size */
export const ANSATTE_TO_SIZE: Record<string, string> = {
  'Bare meg selv': 'solo',
  '2–9 ansatte':   'micro',
  '10–49 ansatte': 'small',
  '50+ ansatte':   'medium',
};

export const INDUSTRY_LABELS: Record<string, string> = {
  restaurant:    'Restaurant / Kafé',
  retail:        'Butikk / Handel',
  consulting:    'Konsulent',
  tech:          'IT / Teknologi',
  construction:  'Bygg / Håndverk',
  healthcare:    'Helse / Velvære',
  education:     'Utdanning / Kurs',
  manufacturing: 'Produksjon',
  real_estate:   'Eiendom',
  services:      'Tjenester',
  wholesale:     'Engros / Handel',
  other:         'Annet',
};

export const SIZE_LABELS: Record<string, string> = {
  solo:   '1 person',
  micro:  '2–9 ansatte',
  small:  '10–49 ansatte',
  medium: '50+ ansatte',
};
