import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Paths that are always publicly accessible (no auth required, no redirects)
const PUBLIC_PATHS = ['/', '/api/email'];

// Paths that are public but redirect authenticated users to the app
const AUTH_ENTRY_PATHS = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Always-public paths: serve as-is for everyone
  if (PUBLIC_PATHS.includes(pathname)) {
    return supabaseResponse;
  }

  // Auth-entry paths: redirect authenticated users to the app
  if (AUTH_ENTRY_PATHS.includes(pathname)) {
    if (user) return NextResponse.redirect(new URL('/app', request.url));
    return supabaseResponse;
  }

  // Everything else requires auth
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
};