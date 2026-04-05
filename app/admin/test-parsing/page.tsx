'use client';
import { useState, useRef } from 'react';

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

export default function TestParsingPage() {
  const [file, setFile]       = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<ParseResult | null>(null);
  const [raw, setRaw]         = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setRaw(null);
    setError(null);
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

  const fields: { label: string; key: keyof ParseResult; format?: (v: string | number | null) => string }[] = [
    { label: 'Leverandør',  key: 'leverandor', format: v => v === null ? '—' : String(v) },
    { label: 'Beløp (ink. MVA)', key: 'belop', format: v => fmt(v as number | null) },
    { label: 'MVA',         key: 'mva',    format: v => fmt(v as number | null) },
    { label: 'Dato',        key: 'dato',   format: v => v === null ? '—' : String(v) },
    { label: 'Kategori',    key: 'kategori', format: v => v === null ? '—' : String(v) },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.navy, padding: '40px 24px', fontFamily: "'Cabinet Grotesk', sans-serif" }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: C.grayD, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
            Admin — Testverktøy
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, letterSpacing: '-0.02em' }}>
            Faktura-parsing
          </h1>
          <p style={{ color: C.gray, fontSize: 14, marginTop: 6 }}>
            Last opp en PDF-faktura og se hva Claude trekker ut.
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
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files?.[0] ?? null)}
          />
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

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!file || loading}
          style={{
            width: '100%', padding: '13px', borderRadius: 10, border: 'none',
            background: !file || loading ? C.navyB : C.white,
            color: !file || loading ? C.grayD : C.navy,
            fontSize: 15, fontWeight: 700, cursor: !file || loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s', marginBottom: 28,
          }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ width: 14, height: 14, border: `2px solid ${C.grayD}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }}/>
              Analyserer…
            </span>
          ) : 'Analyser faktura'}
        </button>

        {/* Error */}
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
              <div
                key={key}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
                }}
              >
                <span style={{ fontSize: 13, color: C.grayD }}>{label}</span>
                <span style={{ fontSize: 14, color: result[key] === null ? C.grayD : C.white, fontWeight: result[key] !== null ? 600 : 400 }}>
                  {format ? format(result[key] as string | number | null) : String(result[key] ?? '—')}
                </span>
              </div>
            ))}

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
