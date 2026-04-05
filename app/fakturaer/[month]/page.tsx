import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';

const C = {
  navy: '#141414', navyL: '#1E1E1E', navyM: '#252525',
  white: '#F5F5F5', gray: '#9CA3AF', grayD: '#6B7280',
  green: '#22C55E', red: '#E8445A', amber: '#E8E8E8',
  border: '#2A2A2A', navyB: '#2E2E2E', navyHL: '#383838',
};

const MONTHS_NO = ['Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember'];

const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  return `${MONTHS_NO[+mo - 1]} ${y}`;
};

const fmtNOK = (v: number) =>
  v.toLocaleString('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
};

const STATUS_LABEL: Record<string, string> = {
  ubetalt: 'Ubetalt',
  betalt:  'Betalt',
  forfalt: 'Forfalt',
};
const STATUS_COLOR: Record<string, string> = {
  ubetalt: '#F5A623',
  betalt:  '#22C55E',
  forfalt: '#E8445A',
};

interface Faktura {
  id: string;
  leverandor: string;
  belop: number;
  dato: string;
  mva: number;
  kategori: string;
  pdf_url: string;
  status: string;
}

export default async function FakturaerPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;

  // Validate YYYY-MM format
  if (!/^\d{4}-\d{2}$/.test(month)) redirect('/');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch invoices where dato starts with the month
  const { data: rows } = await supabase
    .from('fakturaer')
    .select('id, leverandor, belop, dato, mva, kategori, pdf_url, status')
    .eq('user_id', user.id)
    .gte('dato', `${month}-01`)
    .lte('dato', `${month}-31`)
    .order('dato', { ascending: false });

  const fakturaer: Faktura[] = (rows ?? []) as Faktura[];

  // Generate signed URLs for invoices that have a PDF stored
  const signedUrls: Record<string, string> = {};
  for (const f of fakturaer) {
    if (f.pdf_url) {
      const { data } = await supabase.storage
        .from('fakturaer-pdfs')
        .createSignedUrl(f.pdf_url, 3600);
      if (data?.signedUrl) signedUrls[f.id] = data.signedUrl;
    }
  }

  const totalBelop = fakturaer.reduce((s, f) => s + (f.belop ?? 0), 0);
  const totalMva   = fakturaer.reduce((s, f) => s + (f.mva   ?? 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: C.navy, padding: '40px 24px', fontFamily: "'Cabinet Grotesk', sans-serif" }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Back */}
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.grayD, fontSize: 13, textDecoration: 'none', marginBottom: 28 }}>
          ← Tilbake til Måneder
        </a>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: C.grayD, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
            Fakturaer
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, letterSpacing: '-0.02em' }}>
            {fmtMonth(month)}
          </h1>
          {fakturaer.length > 0 && (
            <p style={{ color: C.gray, fontSize: 14, marginTop: 6 }}>
              {fakturaer.length} faktura{fakturaer.length !== 1 ? 'er' : ''} — totalt {fmtNOK(totalBelop)} (herav MVA: {fmtNOK(totalMva)})
            </p>
          )}
        </div>

        {fakturaer.length === 0 ? (
          <div style={{ background: C.navyL, border: `1px dashed ${C.border}`, borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <div style={{ color: C.gray, fontSize: 14 }}>Ingen fakturaer registrert for {fmtMonth(month)}</div>
            <a href="/admin/test-parsing" style={{ display: 'inline-block', marginTop: 20, padding: '9px 20px', background: C.white, color: C.navy, borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              Last opp faktura
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {fakturaer.map(f => (
              <div key={f.id} style={{ background: C.navyL, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>

                  {/* Left: info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: C.white }}>
                        {f.leverandor}
                      </span>
                      <span style={{ fontSize: 11, color: STATUS_COLOR[f.status] ?? C.grayD, background: `${STATUS_COLOR[f.status] ?? C.grayD}18`, border: `1px solid ${STATUS_COLOR[f.status] ?? C.border}`, borderRadius: 5, padding: '2px 8px' }}>
                        {STATUS_LABEL[f.status] ?? f.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 10, color: C.grayD, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Beløp</div>
                        <div style={{ fontSize: 14, color: C.white, fontWeight: 600 }}>{fmtNOK(f.belop)}</div>
                      </div>
                      {f.mva > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: C.grayD, textTransform: 'uppercase', letterSpacing: '0.1em' }}>MVA</div>
                          <div style={{ fontSize: 14, color: C.gray }}>{fmtNOK(f.mva)}</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 10, color: C.grayD, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Dato</div>
                        <div style={{ fontSize: 14, color: C.gray }}>{fmtDate(f.dato)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: C.grayD, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Kategori</div>
                        <div style={{ fontSize: 14, color: C.gray }}>{f.kategori || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Right: PDF download */}
                  {signedUrls[f.id] ? (
                    <a href={signedUrls[f.id]} target="_blank" rel="noopener noreferrer" download
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.gray, fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      📥 Last ned PDF
                    </a>
                  ) : (
                    <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: `1px solid ${C.border}`, borderRadius: 8, color: C.grayD, fontSize: 12, opacity: 0.5 }}>
                      📄 Ingen PDF
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload more */}
        {fakturaer.length > 0 && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <a href="/admin/test-parsing" style={{ color: C.grayD, fontSize: 13, textDecoration: 'none' }}>
              + Last opp ny faktura
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
