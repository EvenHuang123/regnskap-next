'use client';
import { useState, useEffect, useCallback } from 'react';
import { TUTORIAL_STEPS, TOTAL_STEPS } from '@/lib/tutorial/steps';
import { C } from '@/lib/constants';

const LS_KEY = 'fiq:tutorial:v1';

interface PersistedState {
  step: number;
  done: boolean;
}

const lsGet = (): PersistedState | null => {
  try { const v = localStorage.getItem(LS_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
};
const lsSet = (s: PersistedState) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* noop */ } };

interface TutorialOverlayProps {
  onTabChange?: (tab: string) => void;
}

export default function TutorialOverlay({ onTabChange }: TutorialOverlayProps) {
  const [visible,   setVisible]   = useState(false);
  const [step,      setStep]      = useState(0);
  const [saving,    setSaving]    = useState(false);
  const [animating, setAnimating] = useState(false);

  // Mount: decide if we should show
  useEffect(() => {
    const saved = lsGet();
    if (!saved || (!saved.done && saved.step >= 0)) {
      const initStep = saved?.step ?? 0;
      setStep(initStep);
      setVisible(true);
    }
  }, []);

  // Listen for external trigger (the ? button)
  useEffect(() => {
    const handler = () => {
      setStep(0);
      setVisible(true);
    };
    window.addEventListener('__fiqStartTutorial', handler);
    return () => window.removeEventListener('__fiqStartTutorial', handler);
  }, []);

  const persist = useCallback(async (s: PersistedState) => {
    lsSet(s);
    setSaving(true);
    try {
      await fetch('/api/tutorial/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: s.step, completed: s.done }),
      });
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }, []);

  const goToStep = useCallback((next: number) => {
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
      persist({ step: next, done: next >= TOTAL_STEPS - 1 });
    }, 180);
  }, [persist]);

  const handleNext = () => {
    const cur = TUTORIAL_STEPS[step];
    if (cur.action?.tab && onTabChange) onTabChange(cur.action.tab);
    if (step >= TOTAL_STEPS - 1) {
      handleClose();
    } else {
      goToStep(step + 1);
    }
  };

  const handlePrev = () => { if (step > 0) goToStep(step - 1); };

  const handleSkip = async () => {
    lsSet({ step, done: true });
    try { await fetch('/api/tutorial/skip', { method: 'POST' }); } catch { /* silent */ }
    setVisible(false);
  };

  const handleClose = () => {
    persist({ step: TOTAL_STEPS - 1, done: true });
    setVisible(false);
  };

  if (!visible) return null;

  const cur = TUTORIAL_STEPS[step];
  const isFirst = step === 0;
  const isLast  = step === TOTAL_STEPS - 1;
  const pct     = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleSkip}
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(2px)',
          transition: 'opacity 0.2s',
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={cur.title}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          zIndex: 9001,
          width: '100%',
          maxWidth: 480,
          background: C.navy,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          padding: '32px 32px 28px',
          opacity: animating ? 0 : 1,
          transform: animating
            ? 'translate(-50%, -48%) scale(0.97)'
            : 'translate(-50%, -50%) scale(1)',
          transition: 'opacity 0.18s ease, transform 0.18s ease',
        }}
      >
        {/* Progress bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: C.grayD, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Steg {step + 1} av {TOTAL_STEPS}
            </span>
            <button
              onClick={handleSkip}
              style={{ background: 'transparent', border: 'none', color: C.grayD, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
              aria-label="Lukk opplæring"
            >
              ×
            </button>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: C.navyM, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${C.amber}, ${C.green})`,
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 28, justifyContent: 'center' }}>
          {TUTORIAL_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => goToStep(i)}
              aria-label={`Gå til steg ${i + 1}`}
              style={{
                width: i === step ? 20 : 8,
                height: 8,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                background: i === step ? C.amber : i < step ? `${C.amber}55` : C.navyM,
                transition: 'all 0.25s ease',
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 52, lineHeight: 1 }}>{cur.icon}</span>
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: 22, fontWeight: 800, color: C.white,
          textAlign: 'center', marginBottom: 14, lineHeight: 1.3,
        }}>
          {cur.title}
        </h2>

        {/* Description */}
        <p style={{
          fontSize: 14, color: C.gray, textAlign: 'center',
          lineHeight: 1.75, marginBottom: cur.tip ? 16 : 24,
        }}>
          {cur.description}
        </p>

        {/* Tip */}
        {cur.tip && (
          <div style={{
            marginBottom: 24, padding: '10px 14px',
            background: `${C.amber}12`, border: `1px solid ${C.amber}30`,
            borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
            <span style={{ fontSize: 12, color: C.grayD, lineHeight: 1.6 }}>{cur.tip}</span>
          </div>
        )}

        {/* External link action */}
        {cur.action?.href && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <a
              href={cur.action.href}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 18px',
                background: `${C.amber}20`, border: `1px solid ${C.amber}50`,
                borderRadius: 8, color: C.amber, fontSize: 12, fontWeight: 600,
                textDecoration: 'none', transition: 'all 0.15s',
              }}
            >
              {cur.action.label} →
            </a>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Previous */}
          <button
            onClick={handlePrev}
            disabled={isFirst}
            style={{
              flex: '0 0 auto', padding: '10px 18px',
              background: 'transparent', border: `1px solid ${isFirst ? C.border : C.grayD}`,
              borderRadius: 9, color: isFirst ? C.border : C.grayD,
              fontSize: 13, cursor: isFirst ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            ← Tilbake
          </button>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Skip (only show on non-last steps) */}
          {!isLast && (
            <button
              onClick={handleSkip}
              style={{
                padding: '10px 14px',
                background: 'transparent', border: 'none',
                color: C.grayD, fontSize: 12, cursor: 'pointer',
              }}
            >
              Hopp over
            </button>
          )}

          {/* Next / Done */}
          <button
            onClick={handleNext}
            style={{
              padding: '11px 24px',
              background: isLast ? C.green : C.amber,
              border: 'none', borderRadius: 9,
              color: isLast ? '#fff' : C.navy,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              transition: 'opacity 0.15s',
              opacity: saving ? 0.7 : 1,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          >
            {cur.action?.tab
              ? `${cur.action.label} →`
              : isLast
                ? '🎉 Kom i gang!'
                : 'Neste →'}
          </button>
        </div>
      </div>
    </>
  );
}
