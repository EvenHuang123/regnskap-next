import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API-nøkkel ikke konfigurert' }, { status: 503 });
  }

  try {
    const form = await req.formData();
    const file = form.get('pdf') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Ingen fil mottatt' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Kun PDF-filer støttes' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const message = await client.beta.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      betas: ['pdfs-2024-09-25'],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Du er en regnskapsassistent. Les denne fakturaen og trekk ut følgende felt som JSON.

Returner KUN gyldig JSON — ingen forklaringer, ingen markdown, ingen kodeblokker.

Format:
{
  "leverandor": "leverandørens navn",
  "belop": 1234.56,
  "dato": "YYYY-MM-DD",
  "mva": 308.64,
  "kategori": "en av: Husleie, Strøm, Internett, Lønn, Varekjøp, Transport, Markedsføring, Forsikring, Utstyr, Annet"
}

Regler:
- belop er totalbeløp INKLUDERT MVA (det brukeren betaler)
- mva er MVA-beløpet alene (0 hvis ikke oppgitt)
- dato er fakturadatoen (ikke forfallsdato) i YYYY-MM-DD format
- Hvis et felt ikke finnes i dokumentet, bruk null
- kategori: velg den som passer best basert på leverandør og beskrivelse`,
            },
          ],
        },
      ],
    });

    const raw = (message.content[0] as { text: string }).text.trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Klarte ikke tolke svar fra AI', raw }, { status: 422 });
    }

    return NextResponse.json({ result: parsed, raw });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ukjent feil';
    console.error('parse-invoice error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
