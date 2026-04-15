'use client';
import { useState } from 'react';
import { C, MONTHS_NO } from '@/lib/constants';

interface ExportModalProps {
  currentMonth: string;   // YYYY-MM
  bedriftsnavn: string;
  onClose: () => void;
}

type Format    = 'xlsx' | 'csv';
type PeriodMode = 'month' | 'custom';
type Step      = 'options' | 'loading' | 'done' | 'error';

const fmtMonthLabel = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${MONTHS_NO[+m - 1]} ${y}`;
};

// Build a list of the last 24 months for the selector
function recentMonths(): string[] {
  const now   = new Date();
  const months: string[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(ym);
  }
  return months;
}

export default function ExportModal({ currentMonth, bedriftsnavn, onClose }: ExportModalProps) {
  const [step,        setStep]        = useState<Step>('options');
  const [periodMode,  setPeriodMode]  = useState<PeriodMode>('month');
  const [selMonth,    setSelMonth]    = useState(currentMonth);
  const [customFrom,  setCustomFrom]  = useState(`${currentMonth}-01`);
  const [customTo,    setCustomTo]    = useState(`${currentMonth}-28`);
  const [format,      setFormat]      = useState<Format>('xlsx');
  const [filterBetalt,  setFilterBetalt]  = useState(true);
  const [filterUbetalt, setFilterUbetalt] = useState(true);
  const [inclBookkeeping, setInclBookkeeping] = useState(true);
  const [inclSummary,     setInclSummary]     = useState(true);
  const [inclMva,         setInclMva]         = useState(true);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [downloadedName, setDownloadedName] = useState('');

  const months = recentMonths();

  const handleExport = async () => {
    setStep('loading');
    setErrorMsg('');

    const period = periodMode === 'month' ? selMonth : 'custom';

    try {
      const res = await fetch('/api/export/accountant', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          ...(periodMode === 'custom' ? { from: customFrom, to: customTo } : {}),
          format,
          bedriftsnavn,
          options: {
            filterBetalt,
            filterUbetalt,
            includeBookkeeping: inclBookkeeping,
            includeSummary:     inclSummary,
            includeMva:         inclMva,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const blob        = await res.blob();
      const slug        = periodMode === 'month' ? selMonth : `${customFrom}_${customTo}`;
      const filename    = `regnskap_${slug}.${format}`;
      const url         = URL.createObjectURL(blob);
      const a           = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setDownloadedName(filename);
      setStep('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Ukjent feil');
      setStep('error');
    }
  };

  // ── Shared style helpers ──────────────────────────────────────────────────
  const sBg:    React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:24 };
  const sModal: React.CSSProperties = { background:C.navyL, border:`1px solid ${C.border}`, borderRadius:16, padding:'28px 28px 24px', maxWidth:480, width:'100%', maxHeight:'90vh', overflowY:'auto' };
  const sLabel: React.CSSProperties = { fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:C.gray, display:'block', marginBottom:6 };
  const sSelect: React.CSSProperties = { width:'100%', padding:'9px 12px', background:C.navyM, border:`1px solid ${C.border}`, borderRadius:8, color:C.white, fontSize:13, cursor:'pointer' };
  const sInput:  React.CSSProperties = { width:'100%', padding:'9px 12px', background:C.navyM, border:`1px solid ${C.border}`, borderRadius:8, color:C.white, fontSize:13 };
  const sRow:    React.CSSProperties = { display:'flex', alignItems:'center', gap:10, marginBottom:8 };
  const sChk:    React.CSSProperties = { width:15, height:15, accentColor:C.green, cursor:'pointer', flexShrink:0 };
  const sSect:   React.CSSProperties = { marginBottom:22 };
  const sDivider:React.CSSProperties = { borderTop:`1px solid ${C.border}`, margin:'18px 0' };

  const RadioOpt = ({ val, label, sub }: { val: Format; label: string; sub: string }) => (
    <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', padding:'10px 12px', borderRadius:9, border:`1px solid ${format===val ? C.green : C.border}`, background:format===val ? `${C.green}12` : 'transparent', marginBottom:8 }}>
      <input type="radio" value={val} checked={format===val} onChange={()=>setFormat(val)} style={{ accentColor:C.green, marginTop:2, flexShrink:0 }}/>
      <div>
        <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{label}</div>
        <div style={{ fontSize:11, color:C.grayD }}>{sub}</div>
      </div>
    </label>
  );

  // ── States ────────────────────────────────────────────────────────────────

  if (step === 'loading') return (
    <div style={sBg}>
      <div style={{ ...sModal, textAlign:'center', padding:48 }}>
        <div style={{ fontSize:36, marginBottom:16 }}>⏳</div>
        <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:6 }}>Genererer eksport…</div>
        <div style={{ fontSize:13, color:C.grayD }}>Henter fakturaer og bygger fil…</div>
      </div>
    </div>
  );

  if (step === 'done') return (
    <div style={sBg}>
      <div style={{ ...sModal, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>✅</div>
        <h2 style={{ fontSize:18, fontWeight:800, color:C.white, marginBottom:8 }}>Eksport lastet ned!</h2>
        <p style={{ fontSize:13, color:C.gray, marginBottom:4 }}>Filen er klar:</p>
        <code style={{ fontSize:12, color:C.green, background:`${C.green}15`, padding:'4px 10px', borderRadius:6 }}>{downloadedName}</code>
        <p style={{ fontSize:12, color:C.grayD, marginTop:12, lineHeight:1.6 }}>
          Del filen med regnskapsføreren din. Den kan importeres direkte i Tripletex, Fiken og Visma.
        </p>
        <button onClick={onClose}
          style={{ marginTop:24, padding:'10px 24px', background:C.green, border:'none', borderRadius:8, color:'#000', fontSize:13, fontWeight:700, cursor:'pointer' }}>
          Lukk
        </button>
      </div>
    </div>
  );

  if (step === 'error') return (
    <div style={sBg}>
      <div style={{ ...sModal, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>❌</div>
        <h2 style={{ fontSize:18, fontWeight:800, color:C.white, marginBottom:8 }}>Noe gikk galt</h2>
        <p style={{ fontSize:13, color:C.gray, marginBottom:16 }}>{errorMsg}</p>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button onClick={()=>setStep('options')}
            style={{ padding:'9px 20px', background:C.navyM, border:`1px solid ${C.border}`, borderRadius:8, color:C.gray, fontSize:13, cursor:'pointer' }}>
            Prøv igjen
          </button>
          <button onClick={onClose}
            style={{ padding:'9px 20px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:8, color:C.grayD, fontSize:13, cursor:'pointer' }}>
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );

  // ── Options form ──────────────────────────────────────────────────────────

  return (
    <div style={sBg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={sModal}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
          <div>
            <h2 style={{ fontSize:18, fontWeight:800, color:C.white, marginBottom:4 }}>📊 Eksporter til regnskapsfører</h2>
            <p style={{ fontSize:12, color:C.grayD }}>Last ned Excel/CSV til Tripletex, Fiken eller Visma.</p>
          </div>
          <button onClick={onClose}
            style={{ background:'transparent', border:'none', color:C.grayD, fontSize:20, cursor:'pointer', lineHeight:1, padding:4 }}>×</button>
        </div>

        {/* Period */}
        <div style={sSect}>
          <label style={sLabel}>Velg periode</label>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            {(['month','custom'] as PeriodMode[]).map(m => (
              <button key={m} onClick={()=>setPeriodMode(m)}
                style={{ padding:'7px 14px', borderRadius:7, border:`1px solid ${periodMode===m ? C.green : C.border}`, background:periodMode===m ? `${C.green}18` : 'transparent', color:periodMode===m ? C.green : C.gray, fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.15s' }}>
                {m === 'month' ? 'Enkeltmåned' : 'Tilpasset periode'}
              </button>
            ))}
          </div>

          {periodMode === 'month' ? (
            <select value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={sSelect}>
              {months.map(m => <option key={m} value={m}>{fmtMonthLabel(m)}</option>)}
            </select>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label style={sLabel}>Fra</label>
                <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={sInput}/>
              </div>
              <div>
                <label style={sLabel}>Til</label>
                <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} style={sInput}/>
              </div>
            </div>
          )}
        </div>

        <div style={sDivider}/>

        {/* Status filter */}
        <div style={sSect}>
          <label style={sLabel}>Inkluder fakturaer</label>
          <div style={sRow}>
            <input type="checkbox" id="chk-betalt" checked={filterBetalt} onChange={e=>setFilterBetalt(e.target.checked)} style={sChk}/>
            <label htmlFor="chk-betalt" style={{ fontSize:13, color:C.white, cursor:'pointer' }}>Betalte fakturaer</label>
          </div>
          <div style={sRow}>
            <input type="checkbox" id="chk-ubetalt" checked={filterUbetalt} onChange={e=>setFilterUbetalt(e.target.checked)} style={sChk}/>
            <label htmlFor="chk-ubetalt" style={{ fontSize:13, color:C.white, cursor:'pointer' }}>Ubetalte fakturaer</label>
          </div>
          {!filterBetalt && !filterUbetalt && (
            <p style={{ fontSize:11, color:C.red, marginTop:4 }}>⚠️ Velg minst én status for å eksportere.</p>
          )}
        </div>

        <div style={sDivider}/>

        {/* Content options */}
        <div style={sSect}>
          <label style={sLabel}>Innhold</label>
          <div style={sRow}>
            <input type="checkbox" id="chk-summary" checked={inclSummary} onChange={e=>setInclSummary(e.target.checked)} style={sChk}/>
            <label htmlFor="chk-summary" style={{ fontSize:13, color:C.white, cursor:'pointer' }}>
              Sammendrag / totaler
              <span style={{ fontSize:11, color:C.grayD, marginLeft:6 }}>(første ark)</span>
            </label>
          </div>
          <div style={sRow}>
            <input type="checkbox" id="chk-mva" checked={inclMva} onChange={e=>setInclMva(e.target.checked)} style={sChk}/>
            <label htmlFor="chk-mva" style={{ fontSize:13, color:C.white, cursor:'pointer' }}>MVA-beregning per faktura</label>
          </div>
          <div style={sRow}>
            <input type="checkbox" id="chk-bookkeeping" checked={inclBookkeeping} onChange={e=>setInclBookkeeping(e.target.checked)} style={sChk}/>
            <label htmlFor="chk-bookkeeping" style={{ fontSize:13, color:C.white, cursor:'pointer' }}>
              Bokføringsdata (kontonumre)
              <span style={{ fontSize:11, color:C.grayD, marginLeft:6 }}>— dobbel bokføring NRS</span>
            </label>
          </div>
        </div>

        <div style={sDivider}/>

        {/* Format */}
        <div style={sSect}>
          <label style={sLabel}>Format</label>
          <RadioOpt val="xlsx" label="Excel (.xlsx) — Anbefalt" sub="Flere ark, formatering, kan åpnes i Excel og Google Sheets"/>
          <RadioOpt val="csv"  label="CSV (.csv)"               sub="Enkel tekstfil, kompatibel med alle regnskapssystemer"/>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
          <button onClick={onClose}
            style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:8, color:C.grayD, fontSize:13, cursor:'pointer' }}>
            Avbryt
          </button>
          <button onClick={handleExport} disabled={!filterBetalt && !filterUbetalt}
            style={{ padding:'10px 22px', background:(!filterBetalt && !filterUbetalt) ? C.border : C.green, border:'none', borderRadius:8, color:'#000', fontSize:13, fontWeight:700, cursor:(!filterBetalt && !filterUbetalt) ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', gap:8, transition:'background 0.15s' }}>
            📥 Last ned eksport
          </button>
        </div>

      </div>
    </div>
  );
}
