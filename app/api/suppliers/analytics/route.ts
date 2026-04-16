import { NextResponse }  from 'next/server';
import { createClient }  from '@/lib/supabase-server';
import { NORWEGIAN_ACCOUNTS, ACCOUNT_NAMES } from '@/lib/accounting';

export type Period = '3months' | '6months' | '1year' | 'all';

export interface SupplierStat {
  supplier:      string;
  total_amount:  number;
  invoice_count: number;
  avg_amount:    number;
  primary_account_code: string;
  primary_account_name: string;
  /** Monthly buckets for sparkline: { month: 'YYYY-MM', amount: number }[] */
  monthly:       { month: string; amount: number }[];
}

export interface AnalyticsResponse {
  suppliers:      SupplierStat[];
  period:         Period;
  total_suppliers: number;
  total_amount:   number;
}

function cutoffDate(period: Period): Date | null {
  const d = new Date();
  if (period === '3months') { d.setMonth(d.getMonth() - 3);     return d; }
  if (period === '6months') { d.setMonth(d.getMonth() - 6);     return d; }
  if (period === '1year')   { d.setFullYear(d.getFullYear() - 1); return d; }
  return null;   // 'all'
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  const url    = new URL(req.url);
  const period = (url.searchParams.get('period') ?? '3months') as Period;
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 50);

  // Fetch all invoices for this user (we aggregate in TS — simpler than complex SQL)
  const { data: rows, error } = await supabase
    .from('fakturaer')
    .select('id, leverandor, belop, dato, kategori, status')
    .eq('user_id', user.id)
    .order('dato', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cutoff = cutoffDate(period);

  // Aggregate
  type SupMap = Map<string, {
    total: number; count: number;
    accounts: Map<string, number>;
    monthly: Map<string, number>;
  }>;
  const map: SupMap = new Map();

  for (const r of rows ?? []) {
    const d = new Date(r.dato as string);
    if (cutoff && d < cutoff) continue;

    const sup = r.leverandor as string;
    if (!map.has(sup)) {
      map.set(sup, { total: 0, count: 0, accounts: new Map(), monthly: new Map() });
    }
    const s = map.get(sup)!;
    const belop = Number(r.belop) || 0;
    s.total += belop;
    s.count += 1;

    // Account code from kategori
    const code = NORWEGIAN_ACCOUNTS[r.kategori as string] ?? '7900';
    s.accounts.set(code, (s.accounts.get(code) ?? 0) + 1);

    // Monthly bucket
    const mKey = (r.dato as string).slice(0, 7);   // YYYY-MM
    s.monthly.set(mKey, (s.monthly.get(mKey) ?? 0) + belop);
  }

  const suppliers: SupplierStat[] = [...map.entries()]
    .map(([supplier, s]) => {
      // Primary account = most frequently used
      const topCode = [...s.accounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '7900';
      return {
        supplier,
        total_amount:  Math.round(s.total * 100) / 100,
        invoice_count: s.count,
        avg_amount:    Math.round(s.total / s.count * 100) / 100,
        primary_account_code: topCode,
        primary_account_name: ACCOUNT_NAMES[topCode] ?? topCode,
        monthly: [...s.monthly.entries()]
          .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }))
          .sort((a, b) => a.month.localeCompare(b.month)),
      };
    })
    .sort((a, b) => b.total_amount - a.total_amount)
    .slice(0, limit);

  const response: AnalyticsResponse = {
    suppliers,
    period,
    total_suppliers: map.size,
    total_amount: Math.round(suppliers.reduce((s, x) => s + x.total_amount, 0) * 100) / 100,
  };

  return NextResponse.json(response);
}
