import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/app');

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        .landing-root {
          font-family: 'Cabinet Grotesk', sans-serif;
          background: #0A0A0A;
          color: #F5F5F5;
          min-height: 100vh;
          overflow-x: hidden;
        }

        /* ── Nav ─────────────────────────────────────────── */
        .lnav {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 48px;
          height: 64px;
          background: rgba(10,10,10,0.85);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid #1E1E1E;
        }
        .lnav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: #F5F5F5;
        }
        .lnav-icon {
          width: 32px;
          height: 32px;
          background: #F5F5F5;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
          color: #0A0A0A;
          flex-shrink: 0;
        }
        .lnav-name {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .lnav-actions { display: flex; align-items: center; gap: 12px; }
        .lnav-login {
          padding: 8px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          border: 1px solid #2A2A2A;
          color: #9CA3AF;
          transition: color 0.15s, border-color 0.15s;
        }
        .lnav-login:hover { color: #F5F5F5; border-color: #4A4A4A; }
        .lnav-cta {
          padding: 8px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          background: #22C55E;
          color: #0A0A0A;
          transition: background 0.15s;
        }
        .lnav-cta:hover { background: #16A34A; }

        /* ── Hero ────────────────────────────────────────── */
        .lhero {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
          padding: 100px 48px 80px;
        }
        .lhero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.25);
          border-radius: 100px;
          padding: 5px 14px;
          font-size: 12px;
          font-weight: 600;
          color: #22C55E;
          letter-spacing: 0.04em;
          margin-bottom: 24px;
        }
        .lhero-h1 {
          font-size: clamp(32px, 4vw, 52px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.03em;
          color: #F5F5F5;
          margin-bottom: 20px;
        }
        .lhero-h1 span { color: #22C55E; }
        .lhero-sub {
          font-size: 17px;
          color: #9CA3AF;
          line-height: 1.7;
          margin-bottom: 40px;
          max-width: 460px;
        }
        .lhero-btns { display: flex; gap: 12px; flex-wrap: wrap; }
        .lbtn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          background: #22C55E;
          color: #0A0A0A;
          font-size: 15px;
          font-weight: 800;
          border-radius: 10px;
          text-decoration: none;
          transition: background 0.15s, transform 0.1s;
        }
        .lbtn-primary:hover { background: #16A34A; transform: translateY(-1px); }
        .lbtn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          background: transparent;
          color: #9CA3AF;
          font-size: 15px;
          font-weight: 700;
          border-radius: 10px;
          text-decoration: none;
          border: 1px solid #2A2A2A;
          transition: color 0.15s, border-color 0.15s;
        }
        .lbtn-ghost:hover { color: #F5F5F5; border-color: #4A4A4A; }
        .lhero-img-wrap {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid #1E1E1E;
          box-shadow: 0 0 0 1px #1E1E1E, 0 32px 80px rgba(0,0,0,0.6);
        }
        .lhero-img-wrap::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(34,197,94,0.06) 0%, transparent 60%);
          z-index: 1;
          pointer-events: none;
        }
        .lhero-img {
          width: 100%;
          aspect-ratio: 4/3;
          object-fit: cover;
          display: block;
          filter: brightness(0.85) saturate(0.9);
        }
        .lhero-img-badge {
          position: absolute;
          bottom: 20px;
          left: 20px;
          z-index: 2;
          background: rgba(10,10,10,0.85);
          backdrop-filter: blur(12px);
          border: 1px solid #2A2A2A;
          border-radius: 12px;
          padding: 12px 18px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .lhero-img-badge-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22C55E;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.2);
          flex-shrink: 0;
        }
        .lhero-img-badge-text { font-size: 12px; color: #F5F5F5; font-weight: 600; }
        .lhero-img-badge-sub { font-size: 11px; color: #6B7280; margin-top: 1px; }

        /* ── Logos / Trust bar ───────────────────────────── */
        .ltrust {
          border-top: 1px solid #141414;
          border-bottom: 1px solid #141414;
          padding: 28px 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #4A4A4A;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .ltrust-divider { width: 1px; height: 16px; background: #252525; margin: 0 16px; }

        /* ── Features ────────────────────────────────────── */
        .lfeatures {
          max-width: 1200px;
          margin: 0 auto;
          padding: 96px 48px;
        }
        .lsection-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #22C55E;
          margin-bottom: 12px;
        }
        .lsection-h2 {
          font-size: clamp(26px, 3vw, 40px);
          font-weight: 800;
          letter-spacing: -0.025em;
          color: #F5F5F5;
          margin-bottom: 16px;
        }
        .lsection-sub {
          font-size: 16px;
          color: #6B7280;
          max-width: 500px;
          line-height: 1.7;
          margin-bottom: 64px;
        }
        .lfeatures-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        .lfeature-card {
          background: #111111;
          border: 1px solid #1E1E1E;
          border-radius: 16px;
          padding: 32px;
          transition: border-color 0.2s, transform 0.2s;
          position: relative;
          overflow: hidden;
        }
        .lfeature-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(34,197,94,0.3), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .lfeature-card:hover { border-color: #2A2A2A; transform: translateY(-2px); }
        .lfeature-card:hover::before { opacity: 1; }
        .lfeature-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 20px;
          background: #1A1A1A;
          border: 1px solid #252525;
        }
        .lfeature-title {
          font-size: 17px;
          font-weight: 800;
          color: #F5F5F5;
          letter-spacing: -0.01em;
          margin-bottom: 10px;
        }
        .lfeature-desc {
          font-size: 14px;
          color: #6B7280;
          line-height: 1.7;
        }

        /* ── How it works ────────────────────────────────── */
        .lhow {
          border-top: 1px solid #141414;
          padding: 96px 48px;
        }
        .lhow-inner {
          max-width: 1200px;
          margin: 0 auto;
        }
        .lhow-steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
          margin-top: 64px;
        }
        .lhow-step {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .lhow-num {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 800;
          color: #22C55E;
          margin-bottom: 20px;
        }
        .lhow-step-title {
          font-size: 17px;
          font-weight: 800;
          color: #F5F5F5;
          margin-bottom: 10px;
          letter-spacing: -0.01em;
        }
        .lhow-step-desc {
          font-size: 14px;
          color: #6B7280;
          line-height: 1.7;
        }

        /* ── CTA Banner ──────────────────────────────────── */
        .lcta {
          max-width: 1200px;
          margin: 0 auto 96px;
          padding: 0 48px;
        }
        .lcta-inner {
          background: linear-gradient(135deg, #111111 0%, #0F1A12 100%);
          border: 1px solid #1E2E20;
          border-radius: 24px;
          padding: 64px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .lcta-inner::before {
          content: '';
          position: absolute;
          top: -80px; left: 50%; transform: translateX(-50%);
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .lcta-h2 {
          font-size: clamp(24px, 3vw, 38px);
          font-weight: 800;
          letter-spacing: -0.025em;
          color: #F5F5F5;
          margin-bottom: 16px;
        }
        .lcta-sub {
          font-size: 16px;
          color: #6B7280;
          margin-bottom: 36px;
          line-height: 1.6;
        }

        /* ── Footer ──────────────────────────────────────── */
        .lfooter {
          border-top: 1px solid #141414;
          padding: 28px 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1200px;
          margin: 0 auto;
        }
        .lfooter-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: #4A4A4A;
          font-size: 13px;
          font-weight: 700;
        }
        .lfooter-links { display: flex; gap: 24px; }
        .lfooter-link {
          font-size: 12px;
          color: #3A3A3A;
          text-decoration: none;
          transition: color 0.15s;
        }
        .lfooter-link:hover { color: #6B7280; }

        /* ── Responsive ──────────────────────────────────── */
        @media (max-width: 900px) {
          .lhero { grid-template-columns: 1fr; gap: 48px; padding: 64px 24px 48px; }
          .lhero-img-wrap { order: -1; }
          .lhero-sub { max-width: 100%; }
          .lfeatures { padding: 64px 24px; }
          .lfeatures-grid { grid-template-columns: 1fr; }
          .lhow { padding: 64px 24px; }
          .lhow-steps { grid-template-columns: 1fr; gap: 32px; }
          .lcta { padding: 0 24px; margin-bottom: 64px; }
          .lcta-inner { padding: 40px 24px; }
          .lnav { padding: 0 24px; }
          .lfooter { padding: 24px; flex-direction: column; gap: 16px; text-align: center; }
          .lfooter-links { justify-content: center; }
          .ltrust { padding: 20px 24px; flex-wrap: wrap; }
        }
      `}</style>

      <div className="landing-root">

        {/* ── Nav ── */}
        <nav className="lnav">
          <a href="/" className="lnav-logo">
            <div className="lnav-icon">F</div>
            <span className="lnav-name">FinanceIQ</span>
          </a>
          <div className="lnav-actions">
            <a href="/login" className="lnav-login">Logg inn</a>
            <a href="/login" className="lnav-cta">Kom i gang</a>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="lhero">
          <div>
            <div className="lhero-eyebrow">
              <span>✦</span>
              AI-drevet regnskapsverktøy
            </div>
            <h1 className="lhero-h1">
              Automatisk<br />
              faktura&shy;behandling<br />
              for <span>restauranter</span>
            </h1>
            <p className="lhero-sub">
              Send faktura på e-post. AI-en leser, registrerer og kategoriserer den automatisk — leverandør, beløp, MVA og alt.
            </p>
            <div className="lhero-btns">
              <a href="/login" className="lbtn-primary">
                Kom i gang gratis →
              </a>
              <a href="/login" className="lbtn-ghost">
                Logg inn
              </a>
            </div>
          </div>

          <div className="lhero-img-wrap">
            <img
              src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80&auto=format&fit=crop"
              alt="Restaurant"
              className="lhero-img"
            />
            <div className="lhero-img-badge">
              <div className="lhero-img-badge-dot" />
              <div>
                <div className="lhero-img-badge-text">Faktura registrert automatisk</div>
                <div className="lhero-img-badge-sub">Telenor · kr 1 249 · Internett</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust bar ── */}
        <div className="ltrust">
          <span>Claude AI</span>
          <div className="ltrust-divider" />
          <span>Supabase</span>
          <div className="ltrust-divider" />
          <span>Norsk MVA-håndtering</span>
          <div className="ltrust-divider" />
          <span>PDF-parsing</span>
        </div>

        {/* ── Features ── */}
        <section className="lfeatures">
          <p className="lsection-label">Funksjoner</p>
          <h2 className="lsection-h2">Alt du trenger for fakturaene</h2>
          <p className="lsection-sub">
            Fra mottak til betaling — FinanceIQ håndterer fakturaadministrasjonen slik at du kan fokusere på restauranten.
          </p>

          <div className="lfeatures-grid">
            <div className="lfeature-card">
              <div className="lfeature-icon">📧</div>
              <h3 className="lfeature-title">Automatisk e-postmottak</h3>
              <p className="lfeature-desc">
                Videresend fakturaer til din personlige FinanceIQ-adresse. AI-en tar seg av resten — ingen manuell registrering.
              </p>
            </div>
            <div className="lfeature-card">
              <div className="lfeature-icon">🤖</div>
              <h3 className="lfeature-title">AI-parsing av PDF</h3>
              <p className="lfeature-desc">
                Claude leser PDF-fakturaen og trekker ut leverandør, totalbeløp, MVA, dato og kategori automatisk.
              </p>
            </div>
            <div className="lfeature-card">
              <div className="lfeature-icon">📊</div>
              <h3 className="lfeature-title">Månedsoversikt</h3>
              <p className="lfeature-desc">
                Se alle kostnader fordelt per kategori og måned. Sammenlign perioder og få full kontroll på utgiftene.
              </p>
            </div>
            <div className="lfeature-card">
              <div className="lfeature-icon">✅</div>
              <h3 className="lfeature-title">Betalingssporing</h3>
              <p className="lfeature-desc">
                Marker fakturaer som betalt eller ubetalt med ett klikk. Hold oversikt over hva som forfaller og hva som er gjort opp.
              </p>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="lhow">
          <div className="lhow-inner">
            <p className="lsection-label">Slik fungerer det</p>
            <h2 className="lsection-h2">Fra e-post til oversikt på sekunder</h2>
            <div className="lhow-steps">
              <div className="lhow-step">
                <div className="lhow-num">1</div>
                <h3 className="lhow-step-title">Registrer deg</h3>
                <p className="lhow-step-desc">
                  Opprett konto og sett opp din bedriftsprofil. Tar under 2 minutter.
                </p>
              </div>
              <div className="lhow-step">
                <div className="lhow-num">2</div>
                <h3 className="lhow-step-title">Videresend fakturaer</h3>
                <p className="lhow-step-desc">
                  Send PDF-fakturaer til din unike FinanceIQ-adresse. Fungerer fra alle e-postklienter.
                </p>
              </div>
              <div className="lhow-step">
                <div className="lhow-num">3</div>
                <h3 className="lhow-step-title">AI registrerer alt</h3>
                <p className="lhow-step-desc">
                  Claude analyserer fakturaen og lagrer leverandør, beløp, MVA og kategori automatisk i oversikten din.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <div className="lcta">
          <div className="lcta-inner">
            <h2 className="lcta-h2">Klar til å ta kontroll over fakturaene?</h2>
            <p className="lcta-sub">
              Gratis å komme i gang. Ingen kredittkort nødvendig.
            </p>
            <a href="/login" className="lbtn-primary" style={{ display: 'inline-flex' }}>
              Opprett gratis konto →
            </a>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer style={{ borderTop: '1px solid #141414' }}>
          <div className="lfooter">
            <a href="/" className="lfooter-logo">
              <div style={{ width: 24, height: 24, background: '#F5F5F5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#0A0A0A' }}>F</div>
              FinanceIQ v1.0
            </a>
            <div className="lfooter-links">
              <a href="/login" className="lfooter-link">Logg inn</a>
              <a href="/register" className="lfooter-link">Registrer deg</a>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
