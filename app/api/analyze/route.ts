import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'din_nøkkel_her') {
    return NextResponse.json(
      { error: 'AI-analyse er ikke tilgjengelig for øyeblikket' },
      { status: 503 }
    );
  }

  const { system, prompt, max_tokens = 1200 } = await req.json() as {
    system: string;
    prompt: string;
    max_tokens?: number;
  };

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!r.ok) {
    const e = await r.json().catch(() => ({})) as { error?: { message?: string } };
    return NextResponse.json(
      { error: e.error?.message || `HTTP ${r.status}` },
      { status: r.status }
    );
  }

  const res = await r.json() as { content: Array<{ text: string }> };
  return NextResponse.json({ text: res.content[0].text });
}
