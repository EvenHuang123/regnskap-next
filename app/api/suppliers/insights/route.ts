import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import Anthropic        from '@anthropic-ai/sdk';
import type { SupplierStat, Period } from '../analytics/route';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface RequestBody {
  suppliers: SupplierStat[];
  period:    Period;
}

const PERIOD_LABELS: Record<Period, string> = {
  '3months': 'siste 3 måneder',
  '6months': 'siste 6 måneder',
  '1year':   'siste 12 måneder',
  'all':     'hele perioden',
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const { suppliers, period } = body;
  if (!suppliers?.length) {
    return NextResponse.json({ insights: 'Ingen leverandørdata tilgjengelig for analyse.' });
  }

  const top = suppliers.slice(0, 10);
  const fmtNOK = (n: number) => n.toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const supplierLines = top.map((s, i) =>
    `${i + 1}. ${s.supplier}: ${fmtNOK(s.total_amount)} kr` +
    ` (${s.invoice_count} faktura${s.invoice_count !== 1 ? 'er' : ''}` +
    `, gj.snitt ${fmtNOK(s.avg_amount)} kr` +
    `, konto: ${s.primary_account_code} ${s.primary_account_name})`
  ).join('\n');

  const totalAmount = top.reduce((s, x) => s + x.total_amount, 0);
  const topShare    = top.length > 0 ? top[0].total_amount / totalAmount * 100 : 0;

  const prompt = `Du er en norsk regnskapskonsulent som analyserer leverandørdata for en SMB-eier.

LEVERANDØRDATA (${PERIOD_LABELS[period]}):
${supplierLines}

Totalt analysert: ${fmtNOK(totalAmount)} kr fordelt på ${top.length} leverandører.
Største leverandør utgjør ${topShare.toFixed(1)}% av totalen.

OPPGAVE:
Gi 4–5 korte, konkrete og handlingsrettede innsikter på norsk. Fokuser på:
1. Forhandlingsmuligheter (volum-rabatter hos store leverandører)
2. Kostnadskonsolidering (slå sammen leverandører i samme kategori)
3. Risiko (avhengighet av enkeltleverandør)
4. Uvanlige mønstre eller høye gjennomsnittsfakturaer
5. Budsjett- og planleggingstips

Format: nummerert liste. Hver innsikt maks 2 setninger. Bruk norske kroner (kr).`;

  try {
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    });

    const insights = (message.content[0] as { text: string }).text.trim();
    return NextResponse.json({ insights });
  } catch (e) {
    console.error('Claude API error:', e);
    return NextResponse.json({ error: 'AI midlertidig utilgjengelig' }, { status: 500 });
  }
}
