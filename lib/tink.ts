// ─── Tink API helpers ─────────────────────────────────────────────────────────
// All server-side only. Never import this from a Client Component.

const TINK_API = 'https://api.tink.com';

export interface TinkTransaction {
  id: string;
  date: string;        // YYYY-MM-DD
  amount: number;      // negative = payment/expense, positive = income
  description: string;
  merchant: string;
}

/** Exchange OAuth authorization code for an access token. */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  tink_id?: string;
}> {
  const res = await fetch(`${TINK_API}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.TINK_CLIENT_ID!,
      client_secret: process.env.TINK_CLIENT_SECRET!,
      redirect_uri: process.env.TINK_REDIRECT_URI!,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tink token exchange failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<{ access_token: string; tink_id?: string }>;
}

/** Fetch the first account tied to an access token. Returns bank name + account id. */
export async function fetchFirstAccount(accessToken: string): Promise<{
  bankName: string;
  accountId: string;
}> {
  const res = await fetch(`${TINK_API}/api/v1/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { bankName: 'Norsk bank', accountId: '' };

  const data = await res.json() as { accounts?: Record<string, unknown>[] };
  const accounts = data.accounts ?? [];
  if (!accounts.length) return { bankName: 'Norsk bank', accountId: '' };

  const first = accounts[0];
  const bankName =
    (first.financialInstitutionId as string) ||
    (first.name as string) ||
    'Norsk bank';
  return { bankName, accountId: (first.id as string) ?? '' };
}

/** Fetch transactions for the last N days. */
export async function fetchTransactions(
  accessToken: string,
  days = 30,
): Promise<TinkTransaction[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  // Tink v1 dateGte format: YYYYMMDD
  const dateGte = from.toISOString().slice(0, 10).replace(/-/g, '');

  const res = await fetch(
    `${TINK_API}/api/v1/transactions?pageSize=200&dateGte=${dateGte}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Tink transactions failed (${res.status})`);

  const data = await res.json() as { results?: unknown[]; transactions?: unknown[] };
  const raw = (data.results ?? data.transactions ?? []) as Record<string, unknown>[];

  return raw.map(tx => {
    // Tink v1 date field is like "2026-03-15 00:00:00"
    const rawDate = (tx.date ?? '') as string;
    const date = rawDate.length >= 10 ? rawDate.slice(0, 10) : rawDate;

    const rawAmount = tx.originalAmount ?? tx.amount;
    const amount =
      typeof rawAmount === 'object' && rawAmount !== null
        ? Number((rawAmount as Record<string, unknown>).value ?? 0)
        : Number(rawAmount ?? 0);

    const descriptions = tx.descriptions as Record<string, unknown> | undefined;
    const description = descriptions
      ? String(descriptions.display ?? descriptions.original ?? '')
      : String(tx.description ?? '');

    const merchantInfo = tx.merchantInformation as Record<string, unknown> | undefined;
    const merchant = merchantInfo
      ? String(merchantInfo.merchantName ?? '')
      : '';

    return { id: String(tx.id ?? ''), date, amount, description, merchant };
  });
}

// ─── Matching logic ───────────────────────────────────────────────────────────

/** Normalise a string for fuzzy name matching (lowercase, strip punctuation). */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9æøå\s]/g, '').trim();
}

/** True if two ISO date strings are within `days` calendar days of each other. */
export function datesWithin(a: string, b: string, days: number): boolean {
  const diff = Math.abs(
    new Date(a).getTime() - new Date(b).getTime(),
  );
  return diff <= days * 86_400_000;
}

export interface Faktura {
  id: string;
  leverandor: string;
  belop: number;
  mva: number;
  dato: string; // YYYY-MM-DD
}

export interface MatchResult {
  fakturaId: string;
  transactionId: string;
  transactionDate: string;
}

/**
 * Match unpaid invoices against bank transactions.
 *
 * Rules (all must hold):
 *   1. |tx.amount| matches faktura total (belop + mva) within ±1 kr
 *   2. Supplier name appears anywhere in the transaction description OR merchant
 *   3. Transaction date is within ±7 days of faktura date
 */
export function matchTransactions(
  fakturaer: Faktura[],
  transactions: TinkTransaction[],
): MatchResult[] {
  const results: MatchResult[] = [];
  const usedTxIds = new Set<string>();

  for (const f of fakturaer) {
    const total = f.belop + (f.mva ?? 0);
    const supplierNorm = normalizeName(f.leverandor);

    for (const tx of transactions) {
      if (usedTxIds.has(tx.id)) continue;

      // 1. Amount: Tink payments are negative, so use absolute value
      const txAmt = Math.abs(tx.amount);
      if (Math.abs(txAmt - total) > 1) continue;

      // 2. Name: supplier appears in description or merchant
      const descNorm = normalizeName(tx.description);
      const merchantNorm = normalizeName(tx.merchant);
      if (
        !descNorm.includes(supplierNorm) &&
        !merchantNorm.includes(supplierNorm) &&
        supplierNorm.length > 2 // skip very short names (e.g. "AS")
      ) continue;

      // 3. Date: within 7 days
      if (!datesWithin(f.dato, tx.date, 7)) continue;

      results.push({
        fakturaId: f.id,
        transactionId: tx.id,
        transactionDate: tx.date,
      });
      usedTxIds.add(tx.id);
      break; // one match per faktura
    }
  }

  return results;
}
