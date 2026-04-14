import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { exchangeCodeForToken, fetchFirstAccount } from '@/lib/tink';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  const base = new URL(request.url).origin;

  if (error || !code) {
    console.error('Tink callback error:', error);
    return NextResponse.redirect(`${base}/app/settings?tink=error`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${base}/login`);

  try {
    const tokenData = await exchangeCodeForToken(code);
    const { bankName, accountId } = await fetchFirstAccount(tokenData.access_token);

    await supabase.from('user_bank_connections').upsert(
      {
        user_id:            user.id,
        tink_user_id:       tokenData.tink_id ?? user.id,
        tink_access_token:  tokenData.access_token,
        bank_name:          bankName,
        account_id:         accountId,
        connected_at:       new Date().toISOString(),
        is_active:          true,
      },
      { onConflict: 'user_id' },
    );

    return NextResponse.redirect(`${base}/app/settings?tink=success`);
  } catch (e) {
    console.error('Tink callback failed:', e);
    return NextResponse.redirect(`${base}/app/settings?tink=error`);
  }
}
