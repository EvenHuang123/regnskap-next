import { NextResponse }  from 'next/server';
import { createClient }  from '@/lib/supabase-server';
import Anthropic          from '@anthropic-ai/sdk';
import type { BenchmarkResponse } from '../compare/route';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const fmtNOK = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 0 }) + ' kr';
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  let body: { comparison?: BenchmarkResponse };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 }); }

  const c = body.comparison;
  if (!c) return NextResponse.json({ error: 'Mangler sammenligningsdata' }, { status: 400 });

  const dataNote = c.data_source === 'community'
    ? `(basert på ${c.peer_count} sammenlignbare bedrifter i Norge)`
    : '(basert på norsk bransjestatistikk, SSB/Virke)';

  const prompt = `Du er en norsk regnskapskonsulent som analyserer benchmark-data for en SMB-eier.

BEDRIFT: ${c.industry_label} · ${c.size_label}
PERIODE: ${c.period}
DATAGRUNNLAG: ${dataNote}

NØKKELTALL:
Inntekter:       ${fmtNOK(c.revenue.yours)} (bransje: ${fmtNOK(c.revenue.industry_avg)}, posisjon: ${c.revenue.percentile}. persentil)
Profittmargin:   ${fmtPct(c.profit_margin.yours_pct)} (bransje: ${fmtPct(c.profit_margin.industry_pct)}, avvik: ${c.profit_margin.deviation_pp > 0 ? '+' : ''}${fmtPct(c.profit_margin.deviation_pp)})

UTGIFTSFORDELING (% av inntekt):
Varekostnad:     ${fmtPct(c.categories.cogs.your_pct)} (bransje: ${fmtPct(c.categories.cogs.industry_pct)})
Lønnskostnader:  ${fmtPct(c.categories.payroll.your_pct)} (bransje: ${fmtPct(c.categories.payroll.industry_pct)})
Driftskostnader: ${fmtPct(c.categories.operating.your_pct)} (bransje: ${fmtPct(c.categories.operating.industry_pct)})

SPESIFIKKE UTGIFTER (% av inntekt):
Husleie:         ${fmtPct(c.expenses.husleie.your_pct)} (bransje: ${fmtPct(c.expenses.husleie.industry_pct)})
IT/internett:    ${fmtPct(c.expenses.it.your_pct)} (bransje: ${fmtPct(c.expenses.it.industry_pct)})
Markedsføring:   ${fmtPct(c.expenses.marketing.your_pct)} (bransje: ${fmtPct(c.expenses.marketing.industry_pct)})
Transport:       ${fmtPct(c.expenses.transport.your_pct)} (bransje: ${fmtPct(c.expenses.transport.industry_pct)})
Forsikring:      ${fmtPct(c.expenses.forsikring.your_pct)} (bransje: ${fmtPct(c.expenses.forsikring.industry_pct)})

OPPGAVE:
Skriv en kort, handlingsrettet norsk analyse med disse 4 delene:

**Hovedobservasjon:** 1–2 setninger om det viktigste funnet.

**Styrker (2–3 punkter):** Hva gjør de bedre enn bransjen?

**Forbedringsområder (2–3 punkter):** Hva bør de fokusere på?

**Anbefalinger (3 punkter):** Konkrete tiltak de kan gjøre NÅ.

Bruk enkelt, direkte norsk. Nevn spesifikke tall og prosenter. Maks 350 ord.`;

  try {
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 900,
      messages:   [{ role: 'user', content: prompt }],
    });

    const insights = (message.content[0] as { text: string }).text.trim();
    return NextResponse.json({ insights });
  } catch (e) {
    console.error('Claude API error:', e);
    return NextResponse.json({ error: 'AI midlertidig utilgjengelig' }, { status: 500 });
  }
}
