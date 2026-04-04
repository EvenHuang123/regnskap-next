import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  console.log('Key exists:', !!process.env.ANTHROPIC_API_KEY);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'AI-analyse er ikke tilgjengelig for øyeblikket' },
      { status: 503 }
    );
  }

  try {
    const { system, prompt, max_tokens = 1200 } = await req.json() as {
      system: string;
      prompt: string;
      max_tokens?: number;
    };

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (message.content[0] as { text: string }).text;
    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ukjent feil';
    console.error('AI route error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
