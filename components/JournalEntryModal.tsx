'use client';
import { useState, useEffect } from 'react';
import { buildJournalEntry, isBalanced, ACCOUNT_NAMES, type JournalLine } from '@/lib/accounting';

const C = {
  navy:    '#141414',
  navyL:   '#1E1E1E',
  navyM:   '#252525',
  navyB:   '#2E2E2E',
  white:   '#F5F5F5',
  gray:    '#9CA3AF',
  grayD:   '#6B7280',
  green:   '#22C55E',
  greenBg: '#14532D22',
  red:     '#E8445A',
  redBg:   '#4C000A22',
  border:  '#2A2A2A',
  amber:   '#F59E0B',
};

interface Faktura {
  id:        string;
  leverandor: string;
  belop:     number;
  dato:      string;
  mva:       number;
  kategori:  string;
  status:    string;
}

interface StoredLine {
  id:            string;
  account_code:  string;
  debit_amount:  number;
  credit_amount: number;
  description:   string;
}

interface StoredEntry {
  id:          string;
  entry_date:  string;
  description: string;
  journal_entry_lines: StoredLine[];
}

interface Props {
  faktura: Faktura;
  onClose: () => void;
}

const fmtNOK = (n: number) => n.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => { const [y,m,day] = d.split('-'); return `${day}.${m}.${y}`; };

function TAccount({ lines }: { lines: JournalLine[] }) {
  const debits  = lines.filter(l => l.debit_amount  > 0);
  const credits = lines.filter(l => l.credit_amount > 0);
  const totalD  = debits.reduce((s, l)  => s + l.debit_amount,  0);
  const totalC  = credits.reduce((s, l) => s + l.credit_amount, 0);

  const Cell = ({ label, amount, code, isDebit }: { label: string; amount: number; code: string; isDebit: boolean }) => (
    <div style={{
      padding: '10px 14px',
      borderBottom: `1px solid ${C.border}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 12, color: C.grayD }}>{code}</div>
        <div style={{ fontSize: 13, color: C.white, fontWeight: 500 }}>{label}</div>
      </div>
      <div style={{
        fontSize: 14,
        fontWeight: 700,
        color: isDebit ? C.amber : C.green,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {fmtNOK(amount)}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Debet side */}
      <div style={{ borderRight: `1px solid ${C.border}` }}>
        <div style={{
          padding: '8px 14px',
          background: C.navyB,
          fontSize: 11,
          fontWeight: 700,
          color: C.amber,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          Debet
        </div>
        {debits.map((l, i) => (
          <Cell key={i} code={l.account_code} label={l.account_name || ACCOUNT_NAMES[l.account_code] || l.description} amount={l.debit_amount} isDebit />
        ))}
        <div style={{
          padding: '8px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          background: `${C.amber}12`,
          borderTop: `1px solid ${C.amber}40`,
        }}>
          <span style={{ fontSize: 11, color: C.amber, fontWeight: 700 }}>SUM</span>
          <span style={{ fontSize: 13, color: C.amber, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtNOK(totalD)}</span>
        </div>
      </div>

      {/* Kredit side */}
      <div>
        <div style={{
          padding: '8px 14px',
          background: C.navyB,
          fontSize: 11,
          fontWeight: 700,
          color: C.green,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          Kredit
        </div>
        {credits.map((l, i) => (
          <Cell key={i} code={l.account_code} label={l.account_name || ACCOUNT_NAMES[l.account_code] || l.description} amount={l.credit_amount} isDebit={false} />
        ))}
        <div style={{
          padding: '8px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          background: `${C.green}12`,
          borderTop: `1px solid ${C.green}40`,
        }}>
          <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>SUM</span>
          <span style={{ fontSize: 13, color: C.green, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtNOK(totalC)}</span>
        </div>
      </div>
    </div>
  );
}

export default function JournalEntryModal({ faktura, onClose }: Props) {
  const [storedEntry, setStoredEntry] = useState<StoredEntry | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  // Build the local journal entry from faktura data
  const localEntry = buildJournalEntry({
    id:          faktura.id,
    leverandor:  faktura.leverandor,
    belop:       faktura.belop,
    dato:        faktura.dato,
    mva:         faktura.mva,
    kategori:    faktura.kategori,
    status:      faktura.status,
    betalt_dato: null,
  });
  const balanced = isBalanced(localEntry);

  // Fetch stored entry on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/accounting/create-entry?invoice_id=${faktura.id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { entry?: StoredEntry };
        if (!cancelled) setStoredEntry(json.entry ?? null);
      } catch {
        // not fatal — just means entry not saved yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [faktura.id]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/accounting/create-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: faktura.id,
          faktura: {
            id:          faktura.id,
            leverandor:  faktura.leverandor,
            belop:       faktura.belop,
            dato:        faktura.dato,
            mva:         faktura.mva,
            kategori:    faktura.kategori,
            status:      faktura.status,
            betalt_dato: null,
          },
        }),
      });
      const json = await res.json() as { error?: string; journalEntryId?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      // Refetch to show the stored entry
      const refetch = await fetch(`/api/accounting/create-entry?invoice_id=${faktura.id}`);
      const refetched = await refetch.json() as { entry?: StoredEntry };
      setStoredEntry(refetched.entry ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ukjent feil');
    } finally {
      setSaving(false);
    }
  };

  // Use stored lines if available, otherwise local preview
  const displayLines: JournalLine[] = storedEntry
    ? storedEntry.journal_entry_lines.map(l => ({
        account_code:  l.account_code,
        account_name:  ACCOUNT_NAMES[l.account_code] ?? l.account_code,
        debit_amount:  l.debit_amount,
        credit_amount: l.credit_amount,
        description:   l.description,
      }))
    : localEntry.lines;

  const sBg:    React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
  const sModal: React.CSSProperties = { background: C.navyL, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px', maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' };

  return (
    <div style={sBg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={sModal}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: C.grayD, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
              Journalpostering
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: C.white, margin: 0 }}>{faktura.leverandor}</h2>
            <div style={{ fontSize: 13, color: C.gray, marginTop: 3 }}>
              {fmtDate(faktura.dato)} · {fmtNOK(faktura.belop)} kr
              {faktura.mva > 0 && ` (herav MVA: ${fmtNOK(faktura.mva)} kr)`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.grayD, fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Balance indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 8,
          background: balanced ? C.greenBg : C.redBg,
          border: `1px solid ${balanced ? C.green : C.red}40`,
          marginBottom: 18,
          fontSize: 12,
        }}>
          <span style={{ color: balanced ? C.green : C.red, fontWeight: 700 }}>
            {balanced ? '✓ Balansert postering' : '⚠ Postering ikke i balanse'}
          </span>
          {storedEntry && (
            <span style={{ color: C.grayD, marginLeft: 'auto' }}>
              Lagret {fmtDate(storedEntry.entry_date)}
            </span>
          )}
          {!storedEntry && !loading && (
            <span style={{ color: C.amber, marginLeft: 'auto', fontSize: 11 }}>
              Forhåndsvisning — ikke lagret
            </span>
          )}
        </div>

        {/* T-account */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: C.gray, fontSize: 13 }}>Laster…</div>
        ) : (
          <TAccount lines={displayLines} />
        )}

        {/* Account breakdown table */}
        {!loading && (
          <div style={{ marginTop: 16, background: C.navyM, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            <div style={{ padding: '8px 14px', background: C.navyB, fontSize: 11, color: C.grayD, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'grid', gridTemplateColumns: '60px 1fr 100px 100px' }}>
              <span>Konto</span><span>Navn</span><span style={{ textAlign: 'right' }}>Debet</span><span style={{ textAlign: 'right' }}>Kredit</span>
            </div>
            {displayLines.map((l, i) => (
              <div key={i} style={{
                padding: '9px 14px',
                borderTop: `1px solid ${C.border}`,
                display: 'grid',
                gridTemplateColumns: '60px 1fr 100px 100px',
                fontSize: 13,
              }}>
                <span style={{ color: C.grayD, fontFamily: 'monospace' }}>{l.account_code}</span>
                <span style={{ color: C.white }}>{l.account_name || ACCOUNT_NAMES[l.account_code] || l.account_code}</span>
                <span style={{ textAlign: 'right', color: l.debit_amount  > 0 ? C.amber : C.grayD, fontVariantNumeric: 'tabular-nums' }}>
                  {l.debit_amount  > 0 ? fmtNOK(l.debit_amount)  : '—'}
                </span>
                <span style={{ textAlign: 'right', color: l.credit_amount > 0 ? C.green : C.grayD, fontVariantNumeric: 'tabular-nums' }}>
                  {l.credit_amount > 0 ? fmtNOK(l.credit_amount) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: C.redBg, border: `1px solid ${C.red}40`, borderRadius: 8, color: C.red, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose}
            style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.grayD, fontSize: 13, cursor: 'pointer' }}>
            Lukk
          </button>
          {!storedEntry && !loading && (
            <button onClick={handleSave} disabled={saving || !balanced}
              style={{
                padding: '9px 20px',
                background: balanced ? C.green : C.border,
                border: 'none',
                borderRadius: 8,
                color: balanced ? '#000' : C.grayD,
                fontSize: 13,
                fontWeight: 700,
                cursor: saving || !balanced ? 'not-allowed' : 'pointer',
              }}>
              {saving ? 'Lagrer…' : '💾 Lagre postering'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
