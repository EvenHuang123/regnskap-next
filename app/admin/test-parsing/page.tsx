'use client';
import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase-browser';

interface ParseResult {
  leverandor: string | null;
  belop: number | null;
  dato: string | null;
  mva: number | null;
  kategori: string | null;
}

const C = {
  navy: '#141414', navyL: '#1E1E1E', navyM: '#252525', navyB: '#2E2E2E',
  amber: '#E8E8E8', red: '#E8445A', green: '#22C55E',
  white: '#F5F5F5', gray: '#9CA3AF', grayD: '#6B7280', border: '#2A2A2A',
};

const fmt = (v: number | null) =>
  v === null ? '—' : v.toLocaleString('nb-NO', { style: 'currency', currency: 'NOK' });

// Map kategori → which maaneder column the cost belongs to
const kategoriToColumn = (kategori: string | null): 'varekostnader' | 'lonnskostnader' | 'andre_kostnader' => {
  switch (kategori) {
    case 'Varekjøp': return 'varekostnader';
    case 'Lønn':     return 'lonnskostnader';
    default:         return 'andre_kostnader';
  }
};

export default function TestParsingPage() {
  const supabase = createClient();

  const [file, setFile]         = useState<File | null>(null);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<ParseResult | null>(null);
  const [raw, setRaw]           = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg]   = useState('');
  const inputRef                = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setRaw(null);
    setError(null);
    setSaveStatus('idle');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0] ?? null);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setRaw(null);
    setSaveStatus('idle');

    try {
      const body = new FormData();
      body.append('pdf', file);
      const res = await fetch('/api/parse-invoice', { method: 'POST', body });
      const json = await res.json() as { result?: ParseResult; raw?: string; error?: string };

      if (!res.ok || json.error) {
        setError(json.error ?? `HTTP ${res.status}`);
        if (json.raw) setRaw(json.raw);
        return;
      }
      setResult(json.result ?? null);
      setRaw(json.raw ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nettverksfeil');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result || !result.dato || result.belop === null) return;
    setSaving(true);
    setSaveStatus('idle');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Ikke innlogget');

      // Derive month key (YYYY-MM) from invoice date
      const month = result.dato.slice(0, 7);

      // Ex-VAT cost = what we store in maaneder cost columns
      const exVat = (result.belop ?? 0) - (result.mva ?? 0);
      const col   = kategoriToColumn(result.kategori);

      // 1. Upload PDF to Storage (path: {user_id}/{date}_{leverandor}.pdf)
      let pdfPath = '';
      if (file) {
        const safeName = (result.leverandor ?? 'faktura')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        pdfPath = `${user.id}/${result.dato}_${safeName}.pdf`;
        const { error: uploadErr } = await supabase.storage
          .from('fakturaer-pdfs')
          .upload(pdfPath, file, { contentType: 'application/pdf', upsert: true });
        if (uploadErr) throw new Error(`PDF-opplasting: ${uploadErr.message}`);
      }

      // 2. Save to fakturaer (include pdf_url if uploaded)
      const { error: faktErr } = await supabase.from('fakturaer').insert({
        user_id:   user.id,
        leverandor: result.leverandor ?? 'Ukjent',
        belop:     result.belop,
        dato:      result.dato,
        mva:       result.mva ?? 0,
        kategori:  result.kategori ?? 'Annet',
        status:    'ubetalt',
        pdf_url:   pdfPath,
      });
      if (faktErr) throw new Error(`fakturaer: ${faktErr.message}`);

      // 2. Read existing maaneder row for this month (may not exist yet)
      const { data: existing } = await supabase
        .from('maaneder')
        .select('inntekter, varekostnader, lonnskostnader, andre_kostnader, mva_innbetalt')
        .eq('user_id', user.id)
        .eq('month', month)
        .single();

      const base = {
        inntekter:       Number(existing?.inntekter       ?? 0),
        varekostnader:   Number(existing?.varekostnader   ?? 0),
        lonnskostnader:  Number(existing?.lonnskostnader  ?? 0),
        andre_kostnader: Number(existing?.andre_kostnader ?? 0),
        mva_innbetalt:   Number(existing?.mva_innbetalt   ?? 0),
      };

      // Add cost to the right column
      base[col] = base[col] + exVat;

      const { error: maanErr } = await supabase.from('maaneder').upsert(
        { user_id: user.id, month, ...base, lagret_at: new Date().toISOString() },
        { onConflict: 'user_id,month' }
      );
      if (maanErr) throw new Error(`maaneder: ${maanErr.message}`);

      setSaveStatus('saved');
      const monthLabel = new Date(month + '-01').toLocaleString('nb-NO', { month: 'long', year: 'numeric' });
      setSaveMsg(`Lagret under ${monthLabel} (${result.kategori ?? 'Annet'})`);
    } catch (e) {
      setSaveStatus('error');
      setSaveMsg(e instanceof Error ? e.message : 'Ukjent feil');
    } finally {
      setSaving(false);
    }
  };

  const fields: { label: string; key: keyof ParseResult; format?: (v: string | number | null) => string }[] = [
    { label: 'Leverandør',       key: 'leverandor', format: v => v === null ? '—' : String(v) },
    { label: 'Beløp (ink. MVA)', key: 'belop',      format: v => fmt(v as number | null) },
    { label: 'MVA',              key: 'mva',        format: v => fmt(v as number | null) },
    { label: 'Dato',             key: 'dato',       format: v => v === null ? '—' : String(v) },
    { label: 'Kategori',         key: 'kategori',   format: v => v === null ? '—' : String(v) },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.navy, padding: '40px 24px', fontFamily: "'Cabinet Grotesk', sans-serif" }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Back button */}
        <a href="/app" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.grayD, fontSize: 13, textDecoration: 'none', marginBottom: 28, transition: 'color 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = C.white; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = C.grayD; }}>
          ← Tilbake til dashbord
        </a>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: C.grayD, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
            Fakturaer
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, letterSpacing: '-0.02em' }}>
            Last opp faktura
          </h1>
          <p style={{ color: C.gray, fontSize: 14, marginTop: 6 }}>
            Claude leser PDF-en og trekker ut leverandør, beløp, dato, MVA og kategori automatisk.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          style={{
            border: `2px dashed ${file ? C.green : C.border}`,
            borderRadius: 12,
            padding: '40px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 20,
            transition: 'border-color 0.2s',
            background: C.navyL,
          }}
        >
          <input ref={inputRef} type="file" accept="application/pdf" style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
              <div style={{ color: C.white, fontWeight: 600 }}>{file.name}</div>
              <div style={{ color: C.grayD, fontSize: 12, marginTop: 4 }}>
                {(file.size / 1024).toFixed(1)} KB — klikk for å bytte
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
              <div style={{ color: C.gray }}>Dra og slipp PDF her, eller klikk for å velge</div>
            </>
          )}
        </div>

        {/* Analyse button */}
        <button onClick={handleSubmit} disabled={!file || loading}
          style={{
            width: '100%', padding: '13px', borderRadius: 10, border: 'none',
            background: !file || loading ? C.navyB : C.white,
            color: !file || loading ? C.grayD : C.navy,
            fontSize: 15, fontWeight: 700, cursor: !file || loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s', marginBottom: 28,
          }}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ width: 14, height: 14, border: `2px solid ${C.grayD}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }}/>
              Analyserer…
            </span>
          ) : 'Analyser faktura'}
        </button>

        {/* Parse error */}
        {error && (
          <div style={{ background: '#2B0F14', border: `1px solid ${C.red}`, borderRadius: 10, padding: '14px 18px', marginBottom: 20, color: C.red, fontSize: 13 }}>
            <strong>Feil:</strong> {error}
            {raw && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: 'pointer', color: C.grayD, fontSize: 11 }}>Råsvar fra AI</summary>
                <pre style={{ marginTop: 8, fontSize: 11, color: C.gray, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{raw}</pre>
              </details>
            )}
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ background: C.navyL, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, display: 'inline-block' }}/>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.white }}>Resultat</span>
            </div>

            {fields.map(({ label, key, format }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.grayD }}>{label}</span>
                <span style={{ fontSize: 14, color: result[key] === null ? C.grayD : C.white, fontWeight: result[key] !== null ? 600 : 400 }}>
                  {format ? format(result[key] as string | number | null) : String(result[key] ?? '—')}
                </span>
              </div>
            ))}

            {/* Save button */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
              {saveStatus === 'saved' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.green, fontSize: 13 }}>
                  <span>✓</span>
                  <span>{saveMsg}</span>
                  <a href="/app" style={{ marginLeft: 'auto', color: C.grayD, fontSize: 12, textDecoration: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = C.white; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = C.grayD; }}>
                    → Gå til Måneder
                  </a>
                </div>
              ) : (
                <>
                  <button onClick={handleSave} disabled={saving || !result.dato || result.belop === null}
                    style={{
                      width: '100%', padding: '11px', borderRadius: 8, border: 'none',
                      background: saving ? C.navyB : '#16A34A',
                      color: saving ? C.grayD : C.white,
                      fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}>
                    {saving ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <span style={{ width: 12, height: 12, border: `2px solid ${C.grayD}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }}/>
                        Lagrer…
                      </span>
                    ) : 'Lagre i Måneder'}
                  </button>
                  {saveStatus === 'error' && (
                    <div style={{ marginTop: 8, fontSize: 12, color: C.red }}>{saveMsg}</div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 11, color: C.grayD }}>
                    Legger til {result.kategori === 'Varekjøp' ? 'varekostnader' : 'andre kostnader'} for {result.dato?.slice(0, 7) ?? '—'}
                  </div>
                </>
              )}
            </div>

            <details style={{ padding: '12px 20px' }}>
              <summary style={{ cursor: 'pointer', fontSize: 11, color: C.grayD, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Råsvar fra AI
              </summary>
              <pre style={{ marginTop: 10, fontSize: 12, color: C.gray, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: C.navyM, padding: 12, borderRadius: 8 }}>
                {raw}
              </pre>
            </details>
          </div>
        )}

      </div>
    </div>
  );
}
