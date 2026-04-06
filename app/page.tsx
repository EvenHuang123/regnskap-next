
export default async function LandingPage() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .landing-root {
          font-family: 'Cabinet Grotesk', sans-serif;
          background: #0A0A0A;
          color: #F5F5F5;
          min-height: 100vh;
          overflow-x: hidden;
        }

        /* ── Nav ─────────────────────────────────────────── */
        .lnav {
          position: sticky; top: 0; z-index: 50;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 48px; height: 64px;
          background: rgba(10,10,10,0.88); backdrop-filter: blur(16px);
          border-bottom: 1px solid #1A1A1A;
        }
        .lnav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; color: #F5F5F5; }
        .lnav-icon {
          width: 32px; height: 32px; background: #F5F5F5; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 800; color: #0A0A0A; flex-shrink: 0;
        }
        .lnav-name { font-size: 17px; font-weight: 800; letter-spacing: -0.02em; }
        .lnav-actions { display: flex; align-items: center; gap: 12px; }
        .lnav-login {
          padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700;
          text-decoration: none; border: 1px solid #2A2A2A; color: #9CA3AF;
          transition: color 0.15s, border-color 0.15s;
        }
        .lnav-login:hover { color: #F5F5F5; border-color: #4A4A4A; }
        .lnav-cta {
          padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700;
          text-decoration: none; background: #22C55E; color: #0A0A0A;
          transition: background 0.15s;
        }
        .lnav-cta:hover { background: #16A34A; }

        /* ── Shared buttons ──────────────────────────────── */
        .lbtn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 28px; background: #22C55E; color: #0A0A0A;
          font-size: 15px; font-weight: 800; border-radius: 10px;
          text-decoration: none; transition: background 0.15s, transform 0.1s;
        }
        .lbtn-primary:hover { background: #16A34A; transform: translateY(-1px); }
        .lbtn-ghost {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 28px; background: transparent; color: #9CA3AF;
          font-size: 15px; font-weight: 700; border-radius: 10px;
          text-decoration: none; border: 1px solid #2A2A2A;
          transition: color 0.15s, border-color 0.15s;
        }
        .lbtn-ghost:hover { color: #F5F5F5; border-color: #4A4A4A; }

        /* ── Section labels ──────────────────────────────── */
        .lsection-label {
          font-size: 11px; font-weight: 700; letter-spacing: 0.16em;
          text-transform: uppercase; color: #22C55E; margin-bottom: 12px;
        }
        .lsection-h2 {
          font-size: clamp(26px, 3vw, 40px); font-weight: 800;
          letter-spacing: -0.025em; color: #F5F5F5; margin-bottom: 16px;
        }
        .lsection-sub {
          font-size: 16px; color: #6B7280; max-width: 520px;
          line-height: 1.7; margin-bottom: 60px;
        }

        /* ── Hero ────────────────────────────────────────── */
        .lhero {
          max-width: 1200px; margin: 0 auto;
          padding: 96px 48px 72px;
          display: flex; flex-direction: column; align-items: center; text-align: center;
        }
        .lhero-eyebrow {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25);
          border-radius: 100px; padding: 5px 14px; font-size: 12px; font-weight: 600;
          color: #22C55E; letter-spacing: 0.04em; margin-bottom: 28px;
        }
        .lhero-h1 {
          font-size: clamp(36px, 5.5vw, 68px); font-weight: 800;
          line-height: 1.05; letter-spacing: -0.035em; color: #F5F5F5;
          margin-bottom: 24px; max-width: 860px;
        }
        .lhero-h1 span { color: #22C55E; }
        .lhero-sub {
          font-size: 18px; color: #9CA3AF; line-height: 1.7;
          margin-bottom: 44px; max-width: 580px;
        }
        .lhero-btns { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-bottom: 72px; }

        /* Dashboard mockup */
        .lhero-dash {
          width: 100%; max-width: 900px;
          background: #111111; border: 1px solid #1E1E1E;
          border-radius: 16px; overflow: hidden;
          box-shadow: 0 0 0 1px #1A1A1A, 0 40px 100px rgba(0,0,0,0.7);
        }
        .lhero-dash-bar {
          background: #141414; border-bottom: 1px solid #1E1E1E;
          padding: 12px 20px; display: flex; align-items: center; gap: 8px;
        }
        .lhero-dash-dot {
          width: 10px; height: 10px; border-radius: 50%;
        }
        .lhero-dash-body { padding: 28px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .lhero-kpi {
          background: #161616; border: 1px solid #222222;
          border-radius: 12px; padding: 20px 22px;
        }
        .lhero-kpi-label { font-size: 11px; color: #4A4A4A; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px; }
        .lhero-kpi-val { font-size: 22px; font-weight: 800; color: #F5F5F5; letter-spacing: -0.02em; }
        .lhero-kpi-delta {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 12px; font-weight: 600; margin-top: 6px;
          padding: 3px 8px; border-radius: 100px;
        }
        .lhero-kpi-delta.up { color: #22C55E; background: rgba(34,197,94,0.1); }
        .lhero-kpi-delta.down { color: #E8445A; background: rgba(232,68,90,0.1); }
        .lhero-chart-row { padding: 0 28px 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .lhero-chart {
          background: #161616; border: 1px solid #222222; border-radius: 12px; padding: 18px 20px;
        }
        .lhero-chart-title { font-size: 12px; font-weight: 600; color: #6B7280; margin-bottom: 16px; }
        .lhero-bars { display: flex; align-items: flex-end; gap: 6px; height: 60px; }
        .lhero-bar-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
        .lhero-bar { width: 100%; border-radius: 4px 4px 0 0; transition: height 0.3s; }
        .lhero-bar-lbl { font-size: 9px; color: #3A3A3A; }
        .lhero-ai-card {
          background: #0F1A12; border: 1px solid #1A2E1A;
          border-radius: 12px; padding: 18px 20px;
        }
        .lhero-ai-title { font-size: 12px; font-weight: 600; color: #22C55E; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
        .lhero-ai-line { height: 8px; background: #1A2E1A; border-radius: 4px; margin-bottom: 6px; }
        .lhero-ai-line:last-child { width: 60%; }

        /* ── Trust bar ───────────────────────────────────── */
        .ltrust {
          border-top: 1px solid #141414; border-bottom: 1px solid #141414;
          padding: 24px 48px; display: flex; align-items: center;
          justify-content: center; gap: 0; flex-wrap: wrap;
          color: #3A3A3A; font-size: 13px; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
        }
        .ltrust-divider { width: 1px; height: 16px; background: #1E1E1E; margin: 0 20px; }

        /* ── Three pillars ───────────────────────────────── */
        .lpillars {
          max-width: 1200px; margin: 0 auto; padding: 96px 48px;
          display: flex; flex-direction: column; gap: 80px;
        }
        .lpillar {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 64px; align-items: center;
        }
        .lpillar.reverse { direction: rtl; }
        .lpillar.reverse > * { direction: ltr; }
        .lpillar-text {}
        .lpillar-icon-row {
          display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
        }
        .lpillar-icon {
          width: 48px; height: 48px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; background: #161616; border: 1px solid #222;
        }
        .lpillar-num {
          font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
          text-transform: uppercase; color: #3A3A3A;
        }
        .lpillar-h3 {
          font-size: clamp(22px, 2.5vw, 30px); font-weight: 800;
          letter-spacing: -0.02em; color: #F5F5F5; margin-bottom: 14px;
        }
        .lpillar-desc { font-size: 15px; color: #6B7280; line-height: 1.8; margin-bottom: 24px; }
        .lpillar-checks { display: flex; flex-direction: column; gap: 8px; }
        .lpillar-check {
          display: flex; align-items: center; gap: 10px;
          font-size: 14px; color: #9CA3AF;
        }
        .lpillar-check-dot {
          width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
          background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; color: #22C55E;
        }

        /* Pillar visual panels */
        .lpillar-visual {
          background: #111111; border: 1px solid #1E1E1E;
          border-radius: 16px; padding: 24px; overflow: hidden;
          box-shadow: 0 24px 60px rgba(0,0,0,0.4);
        }
        .lpillar-vis-title {
          font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: #3A3A3A; margin-bottom: 20px;
        }

        /* Invoice panel */
        .linv-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 0; border-bottom: 1px solid #1A1A1A;
        }
        .linv-item:last-child { border-bottom: none; }
        .linv-left { display: flex; align-items: center; gap: 12px; }
        .linv-avatar {
          width: 34px; height: 34px; border-radius: 8px; background: #1A1A1A;
          border: 1px solid #252525; display: flex; align-items: center;
          justify-content: center; font-size: 14px; flex-shrink: 0;
        }
        .linv-name { font-size: 13px; font-weight: 600; color: #E5E5E5; }
        .linv-cat { font-size: 11px; color: #4A4A4A; margin-top: 2px; }
        .linv-right { text-align: right; }
        .linv-amount { font-size: 13px; font-weight: 700; color: #F5F5F5; }
        .linv-badge {
          display: inline-block; font-size: 10px; font-weight: 600;
          padding: 2px 8px; border-radius: 100px; margin-top: 3px;
        }
        .linv-badge.ubetalt { background: rgba(245,166,35,0.12); color: #F5A623; border: 1px solid rgba(245,166,35,0.2); }
        .linv-badge.betalt  { background: rgba(34,197,94,0.10); color: #22C55E; border: 1px solid rgba(34,197,94,0.2); }

        /* Chart panel */
        .lbar-chart { display: flex; align-items: flex-end; gap: 8px; height: 80px; margin-bottom: 12px; }
        .lbar-month { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
        .lbar-stack { display: flex; flex-direction: column; justify-content: flex-end; width: 100%; border-radius: 4px; overflow: hidden; }
        .lbar-seg { width: 100%; }
        .lbar-lbl { font-size: 10px; color: #3A3A3A; }
        .lbar-legend { display: flex; gap: 16px; margin-top: 4px; }
        .lbar-legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #4A4A4A; }
        .lbar-legend-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }

        /* AI insight panel */
        .lai-insight {
          background: #0A0A0A; border: 1px solid #1A2A1A;
          border-radius: 12px; padding: 18px 20px; margin-bottom: 14px;
        }
        .lai-insight:last-child { margin-bottom: 0; }
        .lai-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .lai-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .lai-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        .lai-text { font-size: 13px; color: #6B7280; line-height: 1.6; }
        .lai-text strong { color: #22C55E; font-weight: 700; }

        /* ── How it works ────────────────────────────────── */
        .lhow {
          border-top: 1px solid #141414;
          background: linear-gradient(180deg, #0A0A0A 0%, #0C0F0C 100%);
          padding: 96px 48px;
        }
        .lhow-inner { max-width: 1200px; margin: 0 auto; }
        .lhow-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; margin-top: 60px; }
        .lhow-step { position: relative; }
        .lhow-step::after {
          content: '→'; position: absolute; top: 20px; right: -20px;
          font-size: 16px; color: #2A2A2A;
        }
        .lhow-step:last-child::after { display: none; }
        .lhow-num {
          width: 40px; height: 40px; border-radius: 10px;
          background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 800; color: #22C55E; margin-bottom: 18px;
        }
        .lhow-step-title { font-size: 16px; font-weight: 800; color: #F5F5F5; margin-bottom: 8px; letter-spacing: -0.01em; }
        .lhow-step-desc { font-size: 13px; color: #4A4A4A; line-height: 1.7; }
        .lhow-step-desc strong { color: #22C55E; }

        /* AI example box */
        .lhow-ai-example {
          margin-top: 64px; background: #0E140E; border: 1px solid #1A2A1A;
          border-radius: 16px; padding: 28px 32px;
          display: grid; grid-template-columns: auto 1fr; gap: 20px; align-items: start;
        }
        .lhow-ai-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2);
          display: flex; align-items: center; justify-content: center; font-size: 20px;
          flex-shrink: 0;
        }
        .lhow-ai-label { font-size: 11px; font-weight: 700; color: #22C55E; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
        .lhow-ai-msg { font-size: 14px; color: #9CA3AF; line-height: 1.8; }
        .lhow-ai-msg strong { color: #F5F5F5; font-weight: 700; }
        .lhow-ai-msg em { color: #22C55E; font-style: normal; font-weight: 700; }

        /* ── Benefits row ────────────────────────────────── */
        .lbenefits {
          max-width: 1200px; margin: 0 auto;
          padding: 96px 48px;
        }
        .lbenefits-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 60px; }
        .lbenefit-card {
          background: #111111; border: 1px solid #1A1A1A;
          border-radius: 14px; padding: 24px;
        }
        .lbenefit-num {
          font-size: 32px; font-weight: 800; color: #22C55E;
          letter-spacing: -0.03em; margin-bottom: 8px;
        }
        .lbenefit-title { font-size: 14px; font-weight: 700; color: #F5F5F5; margin-bottom: 6px; }
        .lbenefit-desc { font-size: 13px; color: #4A4A4A; line-height: 1.6; }

        /* ── Checklist ───────────────────────────────────── */
        .lchecklist {
          border-top: 1px solid #141414;
          padding: 80px 48px;
        }
        .lchecklist-inner {
          max-width: 1200px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: start;
        }
        .lchecklist-list { display: flex; flex-direction: column; gap: 14px; margin-top: 48px; }
        .lchecklist-item {
          display: flex; align-items: center; gap: 14px;
          font-size: 15px; color: #9CA3AF;
        }
        .lchecklist-tick {
          width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
          background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; color: #22C55E;
        }

        /* ── CTA ─────────────────────────────────────────── */
        .lcta { max-width: 1200px; margin: 0 auto 96px; padding: 0 48px; }
        .lcta-inner {
          background: linear-gradient(135deg, #0E1A10 0%, #0A120C 100%);
          border: 1px solid #1A2E1A; border-radius: 24px; padding: 72px 64px;
          text-align: center; position: relative; overflow: hidden;
        }
        .lcta-inner::before {
          content: ''; position: absolute;
          top: -100px; left: 50%; transform: translateX(-50%);
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(34,197,94,0.07) 0%, transparent 70%);
          pointer-events: none;
        }
        .lcta-h2 {
          font-size: clamp(26px, 3.5vw, 44px); font-weight: 800;
          letter-spacing: -0.03em; color: #F5F5F5; margin-bottom: 16px;
        }
        .lcta-sub { font-size: 17px; color: #6B7280; margin-bottom: 40px; line-height: 1.6; }
        .lcta-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

        /* ── Footer ──────────────────────────────────────── */
        .lfooter {
          border-top: 1px solid #141414; padding: 28px 48px;
          display: flex; align-items: center; justify-content: space-between;
          max-width: 1200px; margin: 0 auto;
        }
        .lfooter-logo {
          display: flex; align-items: center; gap: 8px;
          text-decoration: none; color: #3A3A3A; font-size: 13px; font-weight: 700;
        }
        .lfooter-links { display: flex; gap: 24px; }
        .lfooter-link {
          font-size: 12px; color: #2A2A2A; text-decoration: none; transition: color 0.15s;
        }
        .lfooter-link:hover { color: #6B7280; }

        /* ── Responsive ──────────────────────────────────── */
        @media (max-width: 1024px) {
          .lhow-steps { grid-template-columns: repeat(2, 1fr); }
          .lhow-step::after { display: none; }
          .lbenefits-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 900px) {
          .lnav { padding: 0 24px; }
          .lhero { padding: 64px 24px 48px; }
          .lhero-dash-body { grid-template-columns: 1fr; }
          .lhero-chart-row { grid-template-columns: 1fr; }
          .lpillars { padding: 64px 24px; gap: 56px; }
          .lpillar { grid-template-columns: 1fr; gap: 32px; }
          .lpillar.reverse { direction: ltr; }
          .lhow { padding: 64px 24px; }
          .lhow-steps { grid-template-columns: 1fr; }
          .lhow-ai-example { grid-template-columns: 1fr; }
          .lhow-ai-icon { display: none; }
          .lbenefits { padding: 64px 24px; }
          .lbenefits-grid { grid-template-columns: 1fr 1fr; }
          .lchecklist { padding: 56px 24px; }
          .lchecklist-inner { grid-template-columns: 1fr; gap: 32px; }
          .lcta { padding: 0 24px; margin-bottom: 56px; }
          .lcta-inner { padding: 48px 28px; }
          .ltrust { padding: 20px 24px; gap: 0; }
          .lfooter { padding: 24px; flex-direction: column; gap: 16px; text-align: center; }
          .lfooter-links { justify-content: center; }
        }
        @media (max-width: 500px) {
          .lbenefits-grid { grid-template-columns: 1fr; }
          .lhero-h1 { font-size: 34px; }
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
          <div className="lhero-eyebrow">
            <span>✦</span> AI-drevet finansplattform for småbedrifter
          </div>
          <h1 className="lhero-h1">
            Komplett økonomisk oversikt<br />
            med <span>AI-analyse</span>
          </h1>
          <p className="lhero-sub">
            Automatisk fakturabehandling, månedlige grafer og likviditetsanalyse — alt på ett sted. Forstå økonomien din uten regnskapskompetanse.
          </p>
          <div className="lhero-btns">
            <a href="/login" className="lbtn-primary">Kom i gang gratis →</a>
            <a href="/login" className="lbtn-ghost">Logg inn</a>
          </div>

          {/* Dashboard mockup */}
          <div className="lhero-dash">
            <div className="lhero-dash-bar">
              <div className="lhero-dash-dot" style={{ background: '#E8445A' }} />
              <div className="lhero-dash-dot" style={{ background: '#F5A623' }} />
              <div className="lhero-dash-dot" style={{ background: '#22C55E' }} />
              <span style={{ fontSize: 11, color: '#3A3A3A', marginLeft: 8, letterSpacing: '0.08em' }}>FinanceIQ — Dashbord</span>
            </div>
            <div className="lhero-dash-body">
              <div className="lhero-kpi">
                <div className="lhero-kpi-label">Inntekter april</div>
                <div className="lhero-kpi-val">kr 284 000</div>
                <div className="lhero-kpi-delta up">▲ 12% vs mars</div>
              </div>
              <div className="lhero-kpi">
                <div className="lhero-kpi-label">Kostnader april</div>
                <div className="lhero-kpi-val">kr 198 400</div>
                <div className="lhero-kpi-delta down">▲ 4% vs mars</div>
              </div>
              <div className="lhero-kpi">
                <div className="lhero-kpi-label">Resultat april</div>
                <div className="lhero-kpi-val">kr 85 600</div>
                <div className="lhero-kpi-delta up">▲ 31% vs mars</div>
              </div>
            </div>
            <div className="lhero-chart-row">
              <div className="lhero-chart">
                <div className="lhero-chart-title">Månedlig oversikt — siste 6 måneder</div>
                <div className="lhero-bars">
                  {[
                    { h: 52, label: 'Nov', color: '#1E2E1E' },
                    { h: 44, label: 'Des', color: '#1E2E1E' },
                    { h: 60, label: 'Jan', color: '#1E2E1E' },
                    { h: 48, label: 'Feb', color: '#1E2E1E' },
                    { h: 56, label: 'Mar', color: '#243824' },
                    { h: 80, label: 'Apr', color: '#22C55E' },
                  ].map(b => (
                    <div key={b.label} className="lhero-bar-wrap">
                      <div className="lhero-bar" style={{ height: b.h + '%', background: b.color }} />
                      <span className="lhero-bar-lbl">{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lhero-ai-card">
                <div className="lhero-ai-title">🤖 AI-analyse</div>
                <div className="lhero-ai-line" style={{ width: '100%' }} />
                <div className="lhero-ai-line" style={{ width: '85%' }} />
                <div className="lhero-ai-line" style={{ width: '70%' }} />
                <div className="lhero-ai-line" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust bar ── */}
        <div className="ltrust">
          <span>✂️ Frisører</span>
          <div className="ltrust-divider" />
          <span>🛍️ Butikker</span>
          <div className="ltrust-divider" />
          <span>💼 Konsulenter</span>
          <div className="ltrust-divider" />
          <span>🔧 Håndverkere</span>
          <div className="ltrust-divider" />
          <span>🍽️ Restauranter</span>
          <div className="ltrust-divider" />
          <span>og alle andre småbedrifter</span>
        </div>

        {/* ── Three pillars ── */}
        <section className="lpillars">

          {/* Pillar 1 — Invoice automation */}
          <div className="lpillar">
            <div className="lpillar-text">
              <div className="lpillar-icon-row">
                <div className="lpillar-icon">📧</div>
                <span className="lpillar-num">01 / Fakturabehandling</span>
              </div>
              <h3 className="lpillar-h3">Fakturaer behandler seg selv</h3>
              <p className="lpillar-desc">
                Videresend fakturaer til din personlige FinanceIQ-adresse, eller last opp PDF direkte. Claude AI leser fakturaen og registrerer alt automatisk — du gjør ingenting.
              </p>
              <div className="lpillar-checks">
                {['AI-parsing av leverandør, beløp og MVA', 'Automatisk kategorisering per bransje', 'Betalt / ubetalt sporing per faktura', 'PDF lagret og tilgjengelig alltid'].map(t => (
                  <div key={t} className="lpillar-check">
                    <div className="lpillar-check-dot">✓</div>
                    {t}
                  </div>
                ))}
              </div>
            </div>
            <div className="lpillar-visual">
              <div className="lpillar-vis-title">Fakturaer · April 2025</div>
              {[
                { icon: '⚡', name: 'Fjordkraft AS', cat: 'Strøm', amt: 'kr 4 280', status: 'betalt' },
                { icon: '📱', name: 'Telenor Norge', cat: 'Internett', amt: 'kr 1 249', status: 'betalt' },
                { icon: '🏠', name: 'Eiendomsforvaltning AS', cat: 'Husleie', amt: 'kr 28 000', status: 'ubetalt' },
                { icon: '🚚', name: 'ASKO Grossist', cat: 'Varekjøp', amt: 'kr 62 450', status: 'ubetalt' },
              ].map(f => (
                <div key={f.name} className="linv-item">
                  <div className="linv-left">
                    <div className="linv-avatar">{f.icon}</div>
                    <div>
                      <div className="linv-name">{f.name}</div>
                      <div className="linv-cat">{f.cat}</div>
                    </div>
                  </div>
                  <div className="linv-right">
                    <div className="linv-amount">{f.amt}</div>
                    <span className={`linv-badge ${f.status}`}>{f.status === 'betalt' ? '✓ Betalt' : 'Ubetalt'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pillar 2 — Monthly graphs */}
          <div className="lpillar reverse">
            <div className="lpillar-text">
              <div className="lpillar-icon-row">
                <div className="lpillar-icon">📊</div>
                <span className="lpillar-num">02 / Månedsoversikt</span>
              </div>
              <h3 className="lpillar-h3">Se hele bildet med interaktive grafer</h3>
              <p className="lpillar-desc">
                Inntekter og utgifter visualisert per måned. Sammenlign perioder, se trender, og forstå nøyaktig hvor pengene tar veien — alt uten Excel.
              </p>
              <div className="lpillar-checks">
                {['Inntekter og kostnader per måned', 'Sammenligning mellom perioder', 'Kategorisert: varekost, lønn, andre kostnader', 'Visuell fremstilling av likviditetsutvikling'].map(t => (
                  <div key={t} className="lpillar-check">
                    <div className="lpillar-check-dot">✓</div>
                    {t}
                  </div>
                ))}
              </div>
            </div>
            <div className="lpillar-visual">
              <div className="lpillar-vis-title">Kostnadsfordeling · siste 5 måneder</div>
              <div className="lbar-chart">
                {[
                  { lbl: 'Des', h1: 35, h2: 20, h3: 25 },
                  { lbl: 'Jan', h1: 38, h2: 22, h3: 20 },
                  { lbl: 'Feb', h1: 30, h2: 24, h3: 28 },
                  { lbl: 'Mar', h1: 40, h2: 20, h3: 22 },
                  { lbl: 'Apr', h1: 44, h2: 18, h3: 18 },
                ].map(b => (
                  <div key={b.lbl} className="lbar-month">
                    <div className="lbar-stack" style={{ height: 80 }}>
                      <div className="lbar-seg" style={{ height: b.h3 + '%', background: '#1E2A2A' }} />
                      <div className="lbar-seg" style={{ height: b.h2 + '%', background: '#1E3030' }} />
                      <div className="lbar-seg" style={{ height: b.h1 + '%', background: '#22C55E' }} />
                    </div>
                    <span className="lbar-lbl">{b.lbl}</span>
                  </div>
                ))}
              </div>
              <div className="lbar-legend">
                <div className="lbar-legend-item"><div className="lbar-legend-dot" style={{ background: '#22C55E' }} />Inntekter</div>
                <div className="lbar-legend-item"><div className="lbar-legend-dot" style={{ background: '#1E3030' }} />Varekost</div>
                <div className="lbar-legend-item"><div className="lbar-legend-dot" style={{ background: '#1E2A2A' }} />Andre kost.</div>
              </div>
            </div>
          </div>

          {/* Pillar 3 — AI insights */}
          <div className="lpillar">
            <div className="lpillar-text">
              <div className="lpillar-icon-row">
                <div className="lpillar-icon">💰</div>
                <span className="lpillar-num">03 / AI-innsikt</span>
              </div>
              <h3 className="lpillar-h3">AI-rådgiver som forstår bedriften din</h3>
              <p className="lpillar-desc">
                Claude analyserer tallene dine og gir konkrete, handlingsrettede råd. Likviditetsanalyse, trendvarsler og anbefalinger — uten at du trenger regnskapsbakgrunn.
              </p>
              <div className="lpillar-checks">
                {['Automatisk likviditetsanalyse per måned', 'Varsler ved uvanlige kostnadstrender', 'Konkrete råd for bedre kontantstrøm', 'Sammenligning mot bransjenormer'].map(t => (
                  <div key={t} className="lpillar-check">
                    <div className="lpillar-check-dot">✓</div>
                    {t}
                  </div>
                ))}
              </div>
            </div>
            <div className="lpillar-visual">
              <div className="lpillar-vis-title">AI-analyse · April 2025</div>
              <div className="lai-insight">
                <div className="lai-head">
                  <div className="lai-dot" style={{ background: '#22C55E' }} />
                  <span className="lai-label" style={{ color: '#22C55E' }}>Positiv trend</span>
                </div>
                <div className="lai-text">
                  Resultat økte med <strong>+31%</strong> i april — primært drevet av at varekostnader holdt seg stabile mens inntektene økte med 12%. God margin.
                </div>
              </div>
              <div className="lai-insight">
                <div className="lai-head">
                  <div className="lai-dot" style={{ background: '#F5A623' }} />
                  <span className="lai-label" style={{ color: '#F5A623' }}>Likviditetsvarsling</span>
                </div>
                <div className="lai-text">
                  3 fakturaer på til sammen <strong>kr 90 450</strong> forfaller innen 14 dager. Sørg for tilstrekkelig likviditet for å unngå forsinkelsesrenter.
                </div>
              </div>
              <div className="lai-insight">
                <div className="lai-head">
                  <div className="lai-dot" style={{ background: '#60A5FA' }} />
                  <span className="lai-label" style={{ color: '#60A5FA' }}>Anbefaling</span>
                </div>
                <div className="lai-text">
                  Husleiekostnaden utgjør 14% av omsetningen — over anbefalt 10% for bransjen. Vurder reforhandling ved neste leieavtale.
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* ── How it works ── */}
        <section className="lhow">
          <div className="lhow-inner">
            <p className="lsection-label">Slik fungerer det</p>
            <h2 className="lsection-h2">Fra faktura til innsikt — automatisk</h2>
            <div className="lhow-steps">
              <div className="lhow-step">
                <div className="lhow-num">1</div>
                <h3 className="lhow-step-title">Videresend fakturaer</h3>
                <p className="lhow-step-desc">
                  Send PDF-fakturaer til din unike FinanceIQ-adresse. Fungerer fra alle e-postklienter — Outlook, Gmail, Apple Mail.
                </p>
              </div>
              <div className="lhow-step">
                <div className="lhow-num">2</div>
                <h3 className="lhow-step-title">AI registrerer alt</h3>
                <p className="lhow-step-desc">
                  Claude leser fakturaen og lagrer <strong>leverandør, beløp, MVA, dato og kategori</strong> automatisk. Null manuell jobb.
                </p>
              </div>
              <div className="lhow-step">
                <div className="lhow-num">3</div>
                <h3 className="lhow-step-title">Se månedsoversikt</h3>
                <p className="lhow-step-desc">
                  Interaktive grafer viser inntekter, kostnader og resultat per måned. Sammenlign perioder og se trender.
                </p>
              </div>
              <div className="lhow-step">
                <div className="lhow-num">4</div>
                <h3 className="lhow-step-title">Få AI-innsikt</h3>
                <p className="lhow-step-desc">
                  Claude analyserer tallene og gir <strong>konkrete anbefalinger</strong> for bedre likviditet og lønnsomhet.
                </p>
              </div>
            </div>

            {/* AI example */}
            <div className="lhow-ai-example">
              <div className="lhow-ai-icon">🤖</div>
              <div>
                <div className="lhow-ai-label">Eksempel på AI-analyse</div>
                <p className="lhow-ai-msg">
                  <strong>«April var din beste måned hittil i år.</strong> Inntektene økte med 12% til kr 284 000, mens kostnadene bare steg 4% — dette er tegn på god kostnadskontroll. Lønnskostnadene falt fra 38% til 32% av omsetningen etter at dere reduserte overtidsbruk i mars. <em>Anbefaling: Fortsett å holde varekostnadene under 25% av omsetning — du er nå på 22%, godt innenfor bransjens beste praksis.»</em>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Benefits ── */}
        <section className="lbenefits">
          <p className="lsection-label">Hvorfor FinanceIQ</p>
          <h2 className="lsection-h2">Konkrete resultater fra dag én</h2>
          <div className="lbenefits-grid">
            {[
              { num: '5–10t', title: 'Spart per måned', desc: 'Slutt på manuell registrering og Excel-tallknusing.' },
              { num: '100%', title: 'Fakturaer fanget', desc: 'Ingenting glipper — alt registreres automatisk fra e-post.' },
              { num: '24/7', title: 'AI-rådgiver', desc: 'Alltid oppdatert analyse av tallene dine, uten ekstra kostnad.' },
              { num: '0 kr', title: 'Regnskapsekspertise', desc: 'Forstå din økonomi fullt ut — ingen regnskapsbakgrunn nødvendig.' },
            ].map(b => (
              <div key={b.num} className="lbenefit-card">
                <div className="lbenefit-num">{b.num}</div>
                <div className="lbenefit-title">{b.title}</div>
                <div className="lbenefit-desc">{b.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Checklist ── */}
        <div className="lchecklist">
          <div className="lchecklist-inner">
            <div>
              <p className="lsection-label">Alt inkludert</p>
              <h2 className="lsection-h2">Komplett plattform for småbedrifter</h2>
              <p className="lsection-sub" style={{ marginBottom: 0 }}>
                Ikke bare fakturalagring — et fullstendig finansielt oversiktssystem med AI-drevet analyse og likviditetsrapportering.
              </p>
            </div>
            <div className="lchecklist-list">
              {[
                'Automatisk fakturabehandling via e-post',
                'AI-parsing av PDF — Claude leser fakturaen',
                'Månedlig oversikt med interaktive grafer',
                'AI-genererte økonomiske analyser',
                'Likviditetsrapportering og varsler',
                'Sammenligning mellom måneder',
                'Betalt/ubetalt tracking per faktura',
                'PDF-lagring og nedlasting',
                'Fungerer for alle bransjer',
              ].map(item => (
                <div key={item} className="lchecklist-item">
                  <div className="lchecklist-tick">✓</div>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="lcta">
          <div className="lcta-inner">
            <h2 className="lcta-h2">Klar til å forstå økonomien din?</h2>
            <p className="lcta-sub">
              Gratis å komme i gang. Ingen kredittkort. Brukes av småbedrifter over hele Norge.
            </p>
            <div className="lcta-btns">
              <a href="/login" className="lbtn-primary" style={{ display: 'inline-flex' }}>
                Opprett gratis konto →
              </a>
              <a href="/login" className="lbtn-ghost" style={{ display: 'inline-flex' }}>
                Logg inn
              </a>
            </div>
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
