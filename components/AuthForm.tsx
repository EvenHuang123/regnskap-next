'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

const C = {
  navy: '#141414', navyL: '#1E1E1E', navyM: '#252525',
  border: '#2A2A2A', white: '#F5F5F5', gray: '#9CA3AF',
  grayD: '#6B7280', green: '#22C55E', red: '#E8445A', amber: '#E8E8E8',
};

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const supabase = createClient();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState('');

  const IStyle: React.CSSProperties = {
    width: '100%', background: C.navy, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: '12px 14px',
    fontSize: 14, color: C.white, outline: 'none', marginBottom: 12,
    transition: 'border-color 0.15s',
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      if (mode === 'register') {
        if (password !== confirm) { setError('Passordene stemmer ikke overens.'); return; }
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setSuccess('Konto opprettet! Sjekk e-posten din for bekreftelse, logg deretter inn.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.push('/app');
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Noe gikk galt.';
      setError(msg === 'Invalid login credentials' ? 'Feil e-post eller passord.' : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: C.navy, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: C.navyL,
        border: `1px solid ${C.border}`, borderRadius: 20, padding: 40,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, background: C.amber, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: C.navy,
          }}>F</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>FinanceIQ</div>
            <div style={{ fontSize: 11, color: C.grayD }}>Norsk regnskapsverktøy</div>
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
          {mode === 'login' ? 'Logg inn' : 'Opprett konto'}
        </h1>
        <p style={{ color: C.grayD, fontSize: 13, marginBottom: 28 }}>
          {mode === 'login' ? 'Skriv inn e-posten og passordet ditt.' : 'Opprett en gratis konto for å komme i gang.'}
        </p>

        {error && (
          <div style={{
            padding: '10px 14px', background: `${C.red}15`, border: `1px solid ${C.red}40`,
            borderRadius: 8, color: C.red, fontSize: 13, marginBottom: 16,
          }}>{error}</div>
        )}
        {success && (
          <div style={{
            padding: '10px 14px', background: `${C.green}15`, border: `1px solid ${C.green}40`,
            borderRadius: 8, color: C.green, fontSize: 13, marginBottom: 16,
          }}>{success}</div>
        )}

        <form onSubmit={submit}>
          <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.gray, marginBottom: 5 }}>E-post</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="deg@bedrift.no" style={IStyle}
            onFocus={e => e.target.style.borderColor = C.white}
            onBlur={e => e.target.style.borderColor = C.border} />

          <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.gray, marginBottom: 5 }}>Passord</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            placeholder="••••••••" style={IStyle}
            onFocus={e => e.target.style.borderColor = C.white}
            onBlur={e => e.target.style.borderColor = C.border} />

          {mode === 'register' && (
            <>
              <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.gray, marginBottom: 5 }}>Gjenta passord</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                placeholder="••••••••" style={IStyle}
                onFocus={e => e.target.style.borderColor = C.white}
                onBlur={e => e.target.style.borderColor = C.border} />
            </>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', marginTop: 8, padding: '13px',
            background: loading ? C.grayD : C.white, color: C.navy,
            border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}>
            {loading ? '…' : mode === 'login' ? 'Logg inn' : 'Opprett konto'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: C.grayD }}>
          {mode === 'login' ? (
            <>Har du ikke konto?{' '}
              <a href="/register" style={{ color: C.white, fontWeight: 600 }}>Registrer deg</a>
            </>
          ) : (
            <>Har du allerede konto?{' '}
              <a href="/login" style={{ color: C.white, fontWeight: 600 }}>Logg inn</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
