import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  const clientId   = process.env.TINK_CLIENT_ID;
  const redirectUri = process.env.TINK_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Tink er ikke konfigurert' }, { status: 503 });
  }

  const params = new URLSearchParams({
    client_id:    clientId,
    redirect_uri: redirectUri,
    market:       'NO',
    locale:       'no_NO',
    scope:        'accounts:read,transactions:read,balances:read',
  });

  // In sandbox mode, force the demo bank so testers don't need real BankID
  if (process.env.TINK_ENVIRONMENT === 'sandbox') {
    params.set('test', 'true');
  }

  const url = `https://link.tink.com/1.0/transactions/connect-accounts?${params}`;
  return NextResponse.json({ url });
}
