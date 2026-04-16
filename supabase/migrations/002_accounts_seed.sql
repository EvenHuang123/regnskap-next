-- ── Migration 002: Seed NS 4102 accounts ─────────────────────────────────────
-- Run AFTER 001_journal_tables.sql

insert into accounts (account_code, account_name, account_class, account_type, normal_balance) values

-- ── Klasse 1: Eiendeler ───────────────────────────────────────────────────────
('1000', 'Immaterielle eiendeler',          1, 'asset',     'debit'),
('1200', 'Maskiner og anlegg',              1, 'asset',     'debit'),
('1400', 'Varelager',                       1, 'asset',     'debit'),
('1500', 'Kundefordringer',                 1, 'asset',     'debit'),
('1900', 'Kontanter og bankinnskudd',       1, 'asset',     'debit'),
('1920', 'Bankinnskudd',                    1, 'asset',     'debit'),
('1940', 'Kontanter',                       1, 'asset',     'debit'),

-- ── Klasse 2: Gjeld og egenkapital ───────────────────────────────────────────
('2000', 'Aksjekapital',                    2, 'equity',    'credit'),
('2050', 'Annen egenkapital',               2, 'equity',    'credit'),
('2400', 'Leverandørgjeld',                 2, 'liability', 'credit'),
('2600', 'Skyldig skattetrekk',             2, 'liability', 'credit'),
('2610', 'Skyldig arbeidsgiveravgift',      2, 'liability', 'credit'),
('2700', 'Utgående MVA (høy sats 25%)',     2, 'liability', 'credit'),
('2710', 'Utgående MVA (middels 15%)',      2, 'liability', 'credit'),
('2720', 'Utgående MVA (lav sats 12%)',     2, 'liability', 'credit'),
('2740', 'Inngående MVA (fradragsberett.)', 2, 'liability', 'credit'),
('2770', 'Skyldig MVA',                     2, 'liability', 'credit'),

-- ── Klasse 3: Inntekter ───────────────────────────────────────────────────────
('3000', 'Salgsinntekt produkter',          3, 'income',    'credit'),
('3100', 'Salgsinntekt tjenester',          3, 'income',    'credit'),
('3200', 'Annen driftsinntekt',             3, 'income',    'credit'),

-- ── Klasse 4: Varekostnader ───────────────────────────────────────────────────
('4000', 'Varekjøp',                        4, 'expense',   'debit'),
('4300', 'Innkjøp handelsvarer',            4, 'expense',   'debit'),
('4500', 'Frakt og toll',                   4, 'expense',   'debit'),

-- ── Klasse 5: Lønnskostnader ──────────────────────────────────────────────────
('5000', 'Lønn og honorarer',               5, 'expense',   'debit'),
('5100', 'Fri bil / naturalytelser',        5, 'expense',   'debit'),
('5400', 'Arbeidsgiveravgift',              5, 'expense',   'debit'),
('5900', 'Andre personalkostnader',         5, 'expense',   'debit'),

-- ── Klasse 6: Andre driftskostnader ──────────────────────────────────────────
('6000', 'Avskrivninger',                   6, 'expense',   'debit'),
('6100', 'Frakt og toll (salg)',            6, 'expense',   'debit'),
('6300', 'Leie lokaler',                    6, 'expense',   'debit'),
('6340', 'Energi / strøm',                  6, 'expense',   'debit'),
('6360', 'Renhold og vedlikehold',          6, 'expense',   'debit'),
('6400', 'Leie maskiner / utstyr',          6, 'expense',   'debit'),
('6500', 'Verktøy og driftsmateriell',      6, 'expense',   'debit'),
('6540', 'IT-kostnader / programvare',      6, 'expense',   'debit'),
('6700', 'Regnskapstjenester',              6, 'expense',   'debit'),
('6800', 'Reise og transport',              6, 'expense',   'debit'),
('6860', 'Forsikring',                      6, 'expense',   'debit'),
('6900', 'Telefon og internett',            6, 'expense',   'debit'),
('6940', 'Porto og frakt',                  6, 'expense',   'debit'),

-- ── Klasse 7: Andre kostnader ─────────────────────────────────────────────────
('7000', 'Tap på fordringer',               7, 'expense',   'debit'),
('7140', 'Kontorkostnader',                 7, 'expense',   'debit'),
('7320', 'Revisjonshonorar',                7, 'expense',   'debit'),
('7500', 'Markedsføring og reklame',        7, 'expense',   'debit'),
('7700', 'Bank og finanskostnader',         7, 'expense',   'debit'),
('7770', 'Forsinkelsesrenter',              7, 'expense',   'debit'),
('7900', 'Andre driftskostnader',           7, 'expense',   'debit'),

-- ── Klasse 8: Finansposter ────────────────────────────────────────────────────
('8050', 'Renteinntekter',                  8, 'income',    'credit'),
('8150', 'Rentekostnader',                  8, 'expense',   'debit'),
('8800', 'Skattekostnad',                   8, 'expense',   'debit')

on conflict (account_code) do update set
  account_name    = excluded.account_name,
  account_class   = excluded.account_class,
  account_type    = excluded.account_type,
  normal_balance  = excluded.normal_balance;
