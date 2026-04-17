/**
 * Income Statement (Resultatregnskap) API
 *
 * Combines two data sources:
 *   1. maaneder  — manually entered revenue, payroll, COGS, opex totals
 *   2. journal_entry_lines — detailed account-level breakdown (when available)
 *
 * Query params:
 *   year  (default: current year)
 *   month (optional, 1-12 — returns single month if provided)
 */

import { NextResponse }  from 'next/server';
import { createClient }  from '@/lib/supabase-server';
import { ACCOUNT_NAMES } from '@/lib/accounting';

export interface AccountLine {
  account_code: string;
  account_name: string;
  amount:       number;
}

export interface IncomeStatementResponse {
  period:           string;
  year:             number;
  month:            number | null;
  // Revenue
  revenue:          number;
  // Cost of goods
  cogs:             number;
  gross_profit:     number;
  gross_margin_pct: number;
  // Payroll
  payroll:          number;
  // Operating expenses
  opex:             number;
  opex_breakdown:   AccountLine[];   // per-account breakdown from journal entries
  // Net
  net_profit:       number;
  net_margin_pct:   number;
  // Meta
  has_journal_data: boolean;
  months_with_data: number;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  const url      = new URL(req.url);
  const year     = parseInt(url.searchParams.get('year')  ?? String(new Date().getFullYear()), 10);
  const monthParam = url.searchParams.get('month');
  const month    = monthParam ? parseInt(monthParam, 10) : null;

  // Build YYYY-MM range
  const startMonth = month
    ? `${year}-${String(month).padStart(2, '0')}`
    : `${year}-01`;
  const endMonth = month
    ? `${year}-${String(month).padStart(2, '0')}`
    : `${year}-12`;

  // ── 1. Totals from maaneder ───────────────────────────────────────────────
  const { data: maaneder } = await supabase
    .from('maaneder')
    .select('inntekter, varekostnader, lonnskostnader, andre_kostnader')
    .eq('user_id', user.id)
    .gte('month', startMonth)
    .lte('month', endMonth);

  const rows = maaneder ?? [];
  const revenue = rows.reduce((s, r) => s + (Number(r.inntekter)       || 0), 0);
  const cogs    = rows.reduce((s, r) => s + (Number(r.varekostnader)   || 0), 0);
  const payroll = rows.reduce((s, r) => s + (Number(r.lonnskostnader)  || 0), 0);
  const opex    = rows.reduce((s, r) => s + (Number(r.andre_kostnader) || 0), 0);

  // ── 2. Detailed breakdown from journal entry lines ────────────────────────
  // journal_entries → journal_entry_lines filtered by user + date range
  const startDate = `${year}-${String(month ?? 1).padStart(2, '0')}-01`;
  const endDate   = month
    ? `${year}-${String(month).padStart(2, '0')}-31`
    : `${year}-12-31`;

  const { data: jeData } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('user_id', user.id)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate);

  const entryIds = (jeData ?? []).map(je => je.id as string);
  const hasJournalData = entryIds.length > 0;

  const opexBreakdown: AccountLine[] = [];

  if (hasJournalData) {
    const { data: linesData } = await supabase
      .from('journal_entry_lines')
      .select('account_code, debit_amount, credit_amount')
      .in('journal_entry_id', entryIds);

    // Aggregate by account code (expense accounts: debit > credit = positive expense)
    const accountMap = new Map<string, number>();
    for (const line of (linesData ?? [])) {
      const code  = line.account_code as string;
      const net   = (Number(line.debit_amount) || 0) - (Number(line.credit_amount) || 0);
      if (net > 0) {
        accountMap.set(code, (accountMap.get(code) ?? 0) + net);
      }
    }

    for (const [code, amount] of accountMap.entries()) {
      // Only include operating expense accounts (class 6 and 7)
      const firstDigit = parseInt(code[0], 10);
      if (firstDigit === 6 || firstDigit === 7) {
        opexBreakdown.push({
          account_code: code,
          account_name: ACCOUNT_NAMES[code] ?? code,
          amount:       Math.round(amount * 100) / 100,
        });
      }
    }

    opexBreakdown.sort((a, b) => b.amount - a.amount);
  }

  // ── 3. Build response ─────────────────────────────────────────────────────
  const grossProfit  = revenue - cogs;
  const netProfit    = grossProfit - payroll - opex;

  const period = month
    ? `${String(month).padStart(2, '0')}/${year}`
    : `${year}`;

  const result: IncomeStatementResponse = {
    period,
    year,
    month,
    revenue:          Math.round(revenue),
    cogs:             Math.round(cogs),
    gross_profit:     Math.round(grossProfit),
    gross_margin_pct: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0,
    payroll:          Math.round(payroll),
    opex:             Math.round(opex),
    opex_breakdown:   opexBreakdown,
    net_profit:       Math.round(netProfit),
    net_margin_pct:   revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0,
    has_journal_data: hasJournalData,
    months_with_data: rows.length,
  };

  return NextResponse.json(result);
}
