'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { createClient } from '@/lib/supabase-browser';

const C = {
  navy: '#141414', navyL: '#1E1E1E', navyM: '#252525',
  white: '#F5F5F5', gray: '#9CA3AF', grayD: '#6B7280',
  green: '#22C55E', red: '#E8445A', amber: '#E8E8E8',
  border: '#2A2A2A', navyB: '#2E2E2E', navyHL: '#383838',
};

const MONTHS_NO = ['Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember'];
const fmtMonth = (m: string) => { const [y,mo] = m.split('-'); return `${MONTHS_NO[+mo-1]} ${y}`; };
const fmtNOK   = (v: number) => v.toLocaleString('nb-NO', { style:'currency', currency:'NOK', maximumFractionDigits:0 });
const fmtDate  = (d: string) => { const [y,m,day] = d.split('-'); return `${day}.${m}.${y}`; };
const slug     = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

const STATUS_COLOR: Record<string,string> = { ubetalt:'#F5A623', betalt:'#22C55E', forfalt:'#E8445A' };
const STATUS_LABEL: Record<string,string> = { ubetalt:'Ubetalt', betalt:'Betalt',  forfalt:'Forfalt'  };

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

const Spinner = () => (
  <span style={{ width:11, height:11, border:'2px solid currentColor', borderTopColor:'transparent', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }}/>
);

const Btn = ({ onClick, disabled, danger, active, children }: {
  onClick: () => void; disabled?: boolean; danger?: boolean; active?: boolean; children: React.ReactNode;
}) => {
  const [hov, setHov] = useState(false);
  const borderColor = disabled ? C.border : hov ? (danger ? C.red : C.white) : (active ? C.green : C.border);
  const textColor   = disabled ? C.grayD  : hov ? (danger ? C.red : C.white) : (active ? C.green : C.gray);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:7,
        border:`1px solid ${borderColor}`, background:'transparent', color:textColor,
        fontSize:12, cursor:disabled ? 'not-allowed' : 'pointer', transition:'all 0.15s', whiteSpace:'nowrap' }}>
      {children}
    </button>
  );
};

const ConfirmDialog = ({ leverandor, onConfirm, onCancel, loading }: {
  leverandor: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
    <div style={{ background:C.navyL, border:`1px solid ${C.border}`, borderRadius:14, padding:'28px 28px 24px', maxWidth:400, width:'100%' }}>
      <div style={{ fontSize:22, marginBottom:8 }}>🗑️</div>
      <h2 style={{ fontSize:17, fontWeight:700, color:C.white, marginBottom:10 }}>Slett faktura</h2>
      <p style={{ color:C.gray, fontSize:14, lineHeight:1.6, marginBottom:24 }}>
        Er du sikker på at du vil slette fakturaen fra <strong style={{ color:C.white }}>{leverandor}</strong>?
        Denne handlingen kan ikke angres.
      </p>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onCancel} disabled={loading}
          style={{ flex:1, padding:'10px', borderRadius:8, border:`1px solid ${C.border}`, background:'transparent', color:C.gray, fontSize:13, cursor:'pointer' }}>
          Avbryt
        </button>
        <button onClick={onConfirm} disabled={loading}
          style={{ flex:1, padding:'10px', borderRadius:8, border:'none', background:C.red, color:C.white, fontSize:13, fontWeight:700, cursor:loading?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
          {loading ? <><Spinner/> Sletter…</> : 'Slett faktura'}
        </button>
      </div>
    </div>
  </div>
);

export default function FakturaerPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = use(params);
  const supabase  = createClient();

  const [fakturaer,     setFakturaer]     = useState<Faktura[]>([]);
  const [pageLoading,   setPageLoading]   = useState(true);
  const [pageError,     setPageError]     = useState<string|null>(null);
  const [pdfLoading,    setPdfLoading]    = useState<Record<string,string>>({});
  const [pdfError,      setPdfError]      = useState<Record<string,string>>({});
  const [statusLoading, setStatusLoading] = useState<Record<string,boolean>>({});
  const [confirmId,     setConfirmId]     = useState<string|null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setPageLoading(true); setPageError(null);
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/login'; return; }
    const { data, error } = await supabase
      .from('fakturaer')
      .select('id,leverandor,belop,dato,mva,kategori,pdf_url,status')
      .eq('user_id', user.id)
      .gte('dato', `${month}-01`)
      .lte('dato', `${month}-31`)
      .order('dato', { ascending: false });
    if (error) setPageError(error.message);
    else setFakturaer((data ?? []) as Faktura[]);
    setPageLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // ── Status toggle ─────────────────────────────────────────────────────────────
  const handleToggleStatus = async (f: Faktura) => {
    const next = f.status === 'betalt' ? 'ubetalt' : 'betalt';
    setStatusLoading(p => ({ ...p, [f.id]: true }));
    // Optimistic update
    setFakturaer(prev => prev.map(x => x.id === f.id ? { ...x, status: next } : x));
    const { error } = await supabase
      .from('fakturaer')
      .update({ status: next })
      .eq('id', f.id);
    if (error) {
      // Revert on failure
      setFakturaer(prev => prev.map(x => x.id === f.id ? { ...x, status: f.status } : x));
      setPdfError(p => ({ ...p, [f.id]: error.message }));
    }
    setStatusLoading(p => ({ ...p, [f.id]: false }));
  };

  // ── PDF helpers ───────────────────────────────────────────────────────────────
  const getSignedUrl = async (f: Faktura): Promise<string> => {
    if (!f.pdf_url) throw new Error('Ingen PDF lagret for denne fakturaen');
    const { data, error } = await supabase.storage
      .from('fakturaer-pdfs')
      .createSignedUrl(f.pdf_url, 3600);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Kunne ikke generere PDF-lenke');
    return data.signedUrl;
  };

  const handleOpen = async (f: Faktura) => {
    setPdfLoading(p => ({ ...p, [f.id]: 'open' }));
    setPdfError(p => ({ ...p, [f.id]: '' }));
    try {
      const url = await getSignedUrl(f);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      setPdfError(p => ({ ...p, [f.id]: e instanceof Error ? e.message : 'Feil ved åpning' }));
    } finally {
      setPdfLoading(p => ({ ...p, [f.id]: '' }));
    }
  };

  const handleDownload = async (f: Faktura) => {
    setPdfLoading(p => ({ ...p, [f.id]: 'download' }));
    setPdfError(p => ({ ...p, [f.id]: '' }));
    try {
      const url = await getSignedUrl(f);
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const filename = `faktura_${slug(f.leverandor)}_${f.dato}.pdf`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setPdfError(p => ({ ...p, [f.id]: e instanceof Error ? e.message : 'Feil ved nedlasting' }));
    } finally {
      setPdfLoading(p => ({ ...p, [f.id]: '' }));
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmId) return;
    setDeleteLoading(true);
    const f = fakturaer.find(x => x.id === confirmId);
    if (f?.pdf_url) {
      await supabase.storage.from('fakturaer-pdfs').remove([f.pdf_url]);
    }
    const { error } = await supabase.from('fakturaer').delete().eq('id', confirmId);
    setDeleteLoading(false);
    setConfirmId(null);
    if (!error) setFakturaer(prev => prev.filter(x => x.id !== confirmId));
    else setPageError(error.message);
  };

  const totalBelop = fakturaer.reduce((s,f) => s + (f.belop ?? 0), 0);
  const totalMva   = fakturaer.reduce((s,f) => s + (f.mva   ?? 0), 0);

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return <div style={{ color:C.white, padding:40 }}>Ugyldig måned.</div>;
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {confirmId && (
        <ConfirmDialog
          leverandor={fakturaer.find(f => f.id === confirmId)?.leverandor ?? ''}
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
          loading={deleteLoading}
        />
      )}

      <div style={{ minHeight:'100vh', background:C.navy, padding:'40px 24px', fontFamily:"'Cabinet Grotesk', sans-serif" }}>
        <div style={{ maxWidth:760, margin:'0 auto' }}>

          <a href="/app" style={{ display:'inline-flex', alignItems:'center', gap:6, color:C.grayD, fontSize:13, textDecoration:'none', marginBottom:28 }}>
            ← Tilbake til Måneder
          </a>

          <div style={{ marginBottom:32 }}>
            <div style={{ fontSize:11, color:C.grayD, letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:6 }}>Fakturaer</div>
            <h1 style={{ fontSize:28, fontWeight:800, color:C.white, letterSpacing:'-0.02em' }}>{fmtMonth(month)}</h1>
            {!pageLoading && fakturaer.length > 0 && (
              <p style={{ color:C.gray, fontSize:14, marginTop:6 }}>
                {fakturaer.length} faktura{fakturaer.length !== 1 ? 'er' : ''} — totalt {fmtNOK(totalBelop)} (herav MVA: {fmtNOK(totalMva)})
              </p>
            )}
          </div>

          {pageError && (
            <div style={{ background:'#2B0F14', border:`1px solid ${C.red}`, borderRadius:10, padding:'12px 18px', marginBottom:20, color:C.red, fontSize:13 }}>
              {pageError}
            </div>
          )}

          {pageLoading ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:C.gray, display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
              <Spinner/> Laster fakturaer…
            </div>
          ) : fakturaer.length === 0 ? (
            <div style={{ background:C.navyL, border:`1px dashed ${C.border}`, borderRadius:12, padding:'48px 24px', textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
              <div style={{ color:C.gray, fontSize:14 }}>Ingen fakturaer registrert for {fmtMonth(month)}</div>
              <a href="/admin/test-parsing" style={{ display:'inline-block', marginTop:20, padding:'9px 20px', background:C.white, color:C.navy, borderRadius:8, fontSize:13, fontWeight:700, textDecoration:'none' }}>
                Last opp faktura
              </a>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {fakturaer.map(f => {
                const busy   = pdfLoading[f.id];
                const errMsg = pdfError[f.id];
                const hasPdf = !!f.pdf_url;
                const toggling = !!statusLoading[f.id];
                const isPaid   = f.status === 'betalt';
                return (
                  <div key={f.id} style={{ background:C.navyL, border:`1px solid ${C.border}`, borderRadius:12, padding:'18px 20px' }}>

                    {/* Top: name + status badge */}
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
                      <span style={{ fontSize:16, fontWeight:700, color:C.white }}>{f.leverandor}</span>
                      <span style={{
                        fontSize:11, fontWeight:600,
                        color: STATUS_COLOR[f.status] ?? C.grayD,
                        background: `${STATUS_COLOR[f.status] ?? C.grayD}18`,
                        border: `1px solid ${STATUS_COLOR[f.status] ?? C.border}`,
                        borderRadius:5, padding:'2px 8px',
                      }}>
                        {isPaid ? '✓ ' : ''}{STATUS_LABEL[f.status] ?? f.status}
                      </span>
                    </div>

                    {/* Details */}
                    <div style={{ display:'flex', gap:20, flexWrap:'wrap', marginBottom:14 }}>
                      <div>
                        <div style={{ fontSize:10, color:C.grayD, textTransform:'uppercase', letterSpacing:'0.1em' }}>Beløp</div>
                        <div style={{ fontSize:14, color:C.white, fontWeight:600 }}>{fmtNOK(f.belop)}</div>
                      </div>
                      {f.mva > 0 && (
                        <div>
                          <div style={{ fontSize:10, color:C.grayD, textTransform:'uppercase', letterSpacing:'0.1em' }}>MVA</div>
                          <div style={{ fontSize:14, color:C.gray }}>{fmtNOK(f.mva)}</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize:10, color:C.grayD, textTransform:'uppercase', letterSpacing:'0.1em' }}>Dato</div>
                        <div style={{ fontSize:14, color:C.gray }}>{fmtDate(f.dato)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:10, color:C.grayD, textTransform:'uppercase', letterSpacing:'0.1em' }}>Kategori</div>
                        <div style={{ fontSize:14, color:C.gray }}>{f.kategori || '—'}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                      {/* PDF buttons — only shown when PDF exists */}
                      {hasPdf ? (
                        <>
                          <Btn onClick={() => handleOpen(f)} disabled={!!busy || toggling}>
                            {busy === 'open' ? <><Spinner/> Åpner…</> : '📄 Åpne PDF'}
                          </Btn>
                          <Btn onClick={() => handleDownload(f)} disabled={!!busy || toggling}>
                            {busy === 'download' ? <><Spinner/> Laster ned…</> : '⬇️ Last ned'}
                          </Btn>
                        </>
                      ) : (
                        <span style={{ fontSize:11, color:C.grayD, padding:'7px 0' }}>Ingen PDF</span>
                      )}

                      {/* Status toggle */}
                      <Btn onClick={() => handleToggleStatus(f)} disabled={toggling || !!busy} active={isPaid}>
                        {toggling ? <><Spinner/> …</> : isPaid ? '✓ Marker som ubetalt' : 'Marker som betalt'}
                      </Btn>

                      {/* Delete — pushed to the right */}
                      <div style={{ marginLeft:'auto' }}>
                        <Btn onClick={() => setConfirmId(f.id)} disabled={!!busy || toggling} danger>
                          🗑️ Slett
                        </Btn>
                      </div>
                    </div>

                    {errMsg && (
                      <div style={{ marginTop:8, fontSize:12, color:C.red }}>{errMsg}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!pageLoading && fakturaer.length > 0 && (
            <div style={{ marginTop:24, textAlign:'center' }}>
              <a href="/admin/test-parsing" style={{ color:C.grayD, fontSize:13, textDecoration:'none' }}>
                + Last opp ny faktura
              </a>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
