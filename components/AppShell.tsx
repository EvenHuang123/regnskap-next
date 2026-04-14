'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
const ProductTour = dynamic(() => import('./ProductTour'), { ssr: false });
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-browser';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { C, MONTHS_NO, BEDRIFTSTYPER, FASTE_DEFAULTS } from '@/lib/constants';
import {
  calcDerived, getFasteSum, ansattMndKostnad, ansatteTotalKostnad,
  formatNOK, formatPct, getCurrentMonth, fmtMonthFull, fmtMonthShort,
} from '@/lib/calculations';
import type { Profil, MonthData, FasteKostnader, Ansatt } from '@/lib/types';

// ─── DB row mappers ───────────────────────────────────────────────────────────
const mapDbMonth = (r: Record<string, unknown>): MonthData => ({
  month: r.month as string,
  inntekter: Number(r.inntekter) || 0,
  varekostnader: Number(r.varekostnader) || 0,
  lønnskostnader: Number(r.lonnskostnader) || 0,
  andreKostnader: Number(r.andre_kostnader) || 0,
  mvaInnbetalt: Number(r.mva_innbetalt) || 0,
  savedAt: r.lagret_at as string | undefined,
});

const mapDbFaste = (r: Record<string, unknown>): FasteKostnader => ({
  husleie: Number(r.husleie) || 0,
  strøm: Number(r.strom) || 0,
  internett: Number(r.internett) || 0,
  betalingsterminal: Number(r.betalingsterminal) || 0,
  forsikring: Number(r.forsikring) || 0,
  andreFasteNavn: (r.andre_faste_navn as string) || '',
  andreFasteBeløp: Number(r.andre_faste_belop) || 0,
});

const mapDbAnsatt = (r: Record<string, unknown>): Ansatt => ({
  id: r.id as string,
  navn: (r.navn as string) || '',
  lønnstype: (r.lonnstype as 'måned' | 'time') || 'måned',
  månedslønn: Number(r.manedslonn) || 0,
  timelønn: Number(r.timelonn) || 0,
  estimerteTimer: Number(r.estimerte_timer) || 160,
  stillingsprosent: Number(r.stillingsprosent) || 100,
  ansatttype: (r.ansatttype as 'Fast' | 'Deltid' | 'Tilkalling') || 'Fast',
});

const mapDbProfil = (r: Record<string, unknown>): Profil => ({
  bedriftsnavn: (r.bedriftsnavn as string) || '',
  eierNavn: (r.eier_navn as string) || '',
  bedriftstype: (r.bedriftstype as string) || '',
  selskapsform: (r.selskapsform as 'AS' | 'ENK') || 'AS',
  antallAnsatte: (r.antall_ansatte as string) || '',
  opprettet: r.opprettet as string | undefined,
});

// ─── localStorage helpers ─────────────────────────────────────────────────────
const SAI   = (m: string) => `regnskap:ai:${m}`;
const SLIK  = 'regnskap:likviditet_saldo';
const SSCEN = 'regnskap:scenarios';

// ─── Server-side AI helper ────────────────────────────────────────────────────
const callAI = async (system: string, prompt: string, max_tokens = 1200): Promise<string> => {
  const r = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, prompt, max_tokens }),
  });
  const res = await r.json() as { text?: string; error?: string };
  if (!r.ok || res.error) throw new Error(res.error || `HTTP ${r.status}`);
  return res.text!;
};

const lsGet  = (k: string) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const lsSet  = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) { console.error(e); } };

// ─── Primitive components ─────────────────────────────────────────────────────
const Skel = ({ w = '100%', h = 18, r = 6 }: { w?: string|number; h?: number; r?: number }) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: `linear-gradient(90deg, ${C.navyM} 25%, ${C.navyB} 50%, ${C.navyM} 75%)`,
    backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.5s infinite',
  }} />
);

const Counter = ({ target, fmt }: { target: number; fmt: (v: number) => string }) => {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const s = prev.current, e = target || 0;
    const t0 = Date.now(), dur = 500;
    const tick = () => {
      const p = Math.min((Date.now()-t0)/dur, 1);
      const ease = 1 - Math.pow(1-p, 3);
      setVal(s + (e-s)*ease);
      if (p < 1) requestAnimationFrame(tick);
      else prev.current = e;
    };
    requestAnimationFrame(tick);
  }, [target]);
  return <>{fmt(val)}</>;
};

const Badge = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <span style={{
    display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px',
    background:`${color}18`, border:`1px solid ${color}38`, borderRadius:20,
    fontSize:12, color, fontWeight:500,
  }}>{children}</span>
);

const Card = ({ children, style = {}, hover = true }: { children: React.ReactNode; style?: React.CSSProperties; hover?: boolean }) => {
  const [lifted, setLifted] = useState(false);
  return (
    <div
      onMouseEnter={() => hover && setLifted(true)}
      onMouseLeave={() => hover && setLifted(false)}
      style={{
        background: C.navyL, border:`1px solid ${C.border}`, borderRadius:16, padding:24,
        transition:'transform 0.2s ease, box-shadow 0.2s ease',
        transform: lifted ? 'translateY(-2px)' : 'none',
        boxShadow: lifted ? '0 12px 40px rgba(0,0,0,.35)' : 'none',
        ...style,
      }}
    >{children}</div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KPICardProps {
  title: string; value: number; unit?: 'nok'|'pct'|'num';
  delta?: number|null; positive?: 'up'|'down';
  sparkData?: Record<string,unknown>[]; sparkKey?: string; sparkColor?: string;
}
const KPICard = ({ title, value, unit='nok', delta, positive='up', sparkData, sparkKey, sparkColor }: KPICardProps) => {
  const isGood = delta != null && ((positive==='up'&&delta>0)||(positive==='down'&&delta<0));
  const isBad  = delta != null && ((positive==='up'&&delta<0)||(positive==='down'&&delta>0));
  const dColor = isGood ? C.green : isBad ? C.red : C.gray;
  const arrow  = isGood ? '↑' : isBad ? '↓' : '→';
  const Spark = () => {
    if (!sparkData || sparkData.length < 2 || !sparkKey) return null;
    const vals = sparkData.map(d => (d[sparkKey] as number)||0);
    const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx-mn||1;
    const W=72, H=28;
    const pts = vals.map((v,i) => ({ x:(i/(vals.length-1))*W, y:H-((v-mn)/rng)*(H-6)-3 }));
    const d = pts.map((p,i) => `${i===0?'M':'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const last = pts[pts.length-1];
    return (
      <svg width={W} height={H} style={{ overflow:'visible', display:'block' }}>
        <path d={d} stroke={sparkColor||C.amber} strokeWidth={1.5} fill="none" strokeLinejoin="round"/>
        <circle cx={last.x} cy={last.y} r={2.5} fill={sparkColor||C.amber}/>
      </svg>
    );
  };
  return (
    <Card style={{ padding:'20px 22px' }}>
      <div style={{ fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color:C.gray, marginBottom:10 }}>{title}</div>
      <div style={{ fontSize:21, fontWeight:500, color:C.white, lineHeight:1.2 }}>
        <Counter target={value} fmt={unit==='nok' ? formatNOK : unit==='pct' ? formatPct : (v) => String(Math.round(v))}/>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginTop:10 }}>
        {delta != null ? (
          <div style={{ fontSize:11, color:dColor, display:'flex', alignItems:'center', gap:3 }}>
            <span>{arrow}</span><span>{Math.abs(delta).toFixed(1)}%</span>
            <span style={{ color:C.grayD }}>vs. forrige</span>
          </div>
        ) : <div/>}
        <Spark/>
      </div>
    </Card>
  );
};

// ─── Charts ───────────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }: { active?: boolean; payload?: Array<{name:string;value:number;color:string}>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:C.navyB, border:`1px solid ${C.navyHL}`, borderRadius:10, padding:'12px 16px', fontSize:12, boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>
      <div style={{ color:C.gray, fontSize:10, letterSpacing:'0.08em', marginBottom:8, textTransform:'uppercase' }}>{label}</div>
      {payload.map((e,i) => (
        <div key={i} style={{ color:e.color, marginBottom:3 }}>
          <span style={{ color:C.grayD }}>{e.name}: </span>{formatNOK(e.value)}
        </div>
      ))}
    </div>
  );
};

const RevenueChart = ({ data }: { data: MonthData[] }) => {
  const cd = data.map(d => {
    const dr = calcDerived(d);
    return { name:fmtMonthShort(d.month), Inntekter:d.inntekter||0, 'Totale kostnader':dr.totaleKostnader||0 };
  });
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={cd} margin={{ top:8, right:8, left:-12, bottom:0 }}>
        <defs>
          <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={C.amber} stopOpacity={0.25}/><stop offset="95%" stopColor={C.amber} stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="gK" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={C.red} stopOpacity={0.25}/><stop offset="95%" stopColor={C.red} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
        <XAxis dataKey="name" tick={{ fill:C.gray, fontSize:11, fontFamily:'Cabinet Grotesk' }} axisLine={false} tickLine={false}/>
        <YAxis tick={{ fill:C.gray, fontSize:10, fontFamily:'Cabinet Grotesk' }} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
        <Tooltip content={<ChartTip/>}/>
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize:11, color:C.gray, paddingTop:8 }}/>
        <Area type="monotone" dataKey="Inntekter" stroke={C.amber} fill="url(#gI)" strokeWidth={2} dot={{ fill:C.amber, r:3, strokeWidth:0 }} activeDot={{ r:5 }}/>
        <Area type="monotone" dataKey="Totale kostnader" stroke={C.red} fill="url(#gK)" strokeWidth={2} dot={{ fill:C.red, r:3, strokeWidth:0 }} activeDot={{ r:5 }}/>
      </AreaChart>
    </ResponsiveContainer>
  );
};

const CostChart = ({ data, fasteSum = 0 }: { data: MonthData[]; fasteSum?: number }) => {
  const cd = data.map(d => ({ name:fmtMonthShort(d.month), Varekostnader:d.varekostnader||0, Lønnskostnader:d.lønnskostnader||0, Faste:fasteSum, Andre:d.andreKostnader||0 }));
  const barColors = [C.indigo, C.red, '#F5A623', C.green];
  const keys = ['Varekostnader','Lønnskostnader','Faste','Andre'];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={cd} margin={{ top:8, right:8, left:-12, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
        <XAxis dataKey="name" tick={{ fill:C.gray, fontSize:11, fontFamily:'Cabinet Grotesk' }} axisLine={false} tickLine={false}/>
        <YAxis tick={{ fill:C.gray, fontSize:10, fontFamily:'Cabinet Grotesk' }} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
        <Tooltip content={<ChartTip/>}/>
        <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize:11, color:C.gray, paddingTop:8 }}/>
        {keys.map((k,i) => (
          <Bar key={k} dataKey={k} stackId="a" fill={barColors[i]} radius={i===keys.length-1 ? [4,4,0,0] : [0,0,0,0]}/>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

// ─── Month Selector ───────────────────────────────────────────────────────────
const MonthSelector = ({ month, onChange, saved }: { month: string; onChange: (m: string) => void; saved: string[] }) => {
  const [y,m] = month.split('-').map(Number);
  const nav = (dir: number) => {
    const d = new Date(y, m-1+dir, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  };
  const BtnStyle: React.CSSProperties = {
    background:'transparent', border:`1px solid ${C.border}`, borderRadius:7,
    color:C.gray, cursor:'pointer', padding:'5px 12px', fontSize:15, transition:'all 0.15s',
  };
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <button style={BtnStyle}
        onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.amber;(e.currentTarget as HTMLButtonElement).style.color=C.amber;}}
        onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.border;(e.currentTarget as HTMLButtonElement).style.color=C.gray;}}
        onClick={()=>nav(-1)}>←</button>
      <div style={{ textAlign:'center', minWidth:170 }}>
        <div style={{ fontSize:18, color:C.white, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          {fmtMonthFull(month)}
          {saved.includes(month) && <span style={{ width:6, height:6, borderRadius:'50%', background:C.amber, display:'inline-block', verticalAlign:'middle' }}/>}
        </div>
        {month === getCurrentMonth() && (
          <div style={{ fontSize:9, color:C.amber, letterSpacing:'0.14em', textTransform:'uppercase', marginTop:1 }}>Inneværende måned</div>
        )}
      </div>
      <button style={BtnStyle}
        onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.amber;(e.currentTarget as HTMLButtonElement).style.color=C.amber;}}
        onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.border;(e.currentTarget as HTMLButtonElement).style.color=C.gray;}}
        onClick={()=>nav(1)}>→</button>
    </div>
  );
};

// ─── Data Entry ───────────────────────────────────────────────────────────────
const FIELDS = [
  { key:'inntekter',      label:'Inntekter',       hint:'eks. MVA', section:'income' },
  { key:'varekostnader',  label:'Varekostnader',   hint:'KOST',     section:'costs'  },
  { key:'lønnskostnader', label:'Lønnskostnader',  hint:'',         section:'costs'  },
  { key:'andreKostnader', label:'Andre kostnader', hint:'',         section:'costs'  },
  { key:'mvaInnbetalt',   label:'MVA innbetalt',   hint:'betalt til staten', section:'vat' },
];
const EMPTY = Object.fromEntries(FIELDS.map(f => [f.key, '']));

const InputField = ({ label, hint, value, onChange }: { label:string; hint?:string; value:string; onChange:(v:string)=>void }) => {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color:C.gray, marginBottom:5 }}>
        {label}{hint && <span style={{ marginLeft:8, textTransform:'none', letterSpacing:0, fontSize:10, color:C.grayD }}>{hint}</span>}
      </label>
      <div style={{ position:'relative' }}>
        <input type="number" min="0" step="1" value={value} onChange={e=>onChange(e.target.value)} placeholder="0"
          onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
          style={{ width:'100%', background:C.navy, border:`1px solid ${focus?C.amber:C.border}`, borderRadius:8, padding:'9px 50px 9px 12px', fontSize:14, color:C.white, outline:'none', transition:'border-color 0.15s' }}/>
        <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:C.grayD, fontSize:11, pointerEvents:'none' }}>kr</span>
      </div>
    </div>
  );
};

const DerivedRow = ({ label, value, color, note, unit='nok' }: { label:string; value:number; color:string; note?:string; unit?:string }) => (
  <div style={{ padding:'14px 16px', background:C.navy, borderRadius:10, borderLeft:`3px solid ${color}`, marginBottom:10 }}>
    <div style={{ fontSize:10, color:C.gray, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:3 }}>{label}</div>
    <div style={{ fontSize:22, color, fontWeight:500 }}>
      <Counter target={value} fmt={unit==='pct' ? formatPct : formatNOK}/>
    </div>
    {note && <div style={{ fontSize:10, color:C.grayD, marginTop:3 }}>{note}</div>}
  </div>
);

interface DataEntryProps {
  month: string;
  currentData: MonthData | null;
  faste: Partial<FasteKostnader>;
  ansatte: Ansatt[];
  onSave: (month: string, data: Record<string,number>) => Promise<void>;
  onDelete: (month: string) => Promise<void>;
}

const DataEntry = ({ month, currentData, faste, ansatte, onSave, onDelete }: DataEntryProps) => {
  const [form, setForm] = useState<Record<string,string>>(EMPTY);
  const [status, setStatus] = useState<'idle'|'saved'|'saving'>('idle');
  const [delStep, setDelStep] = useState(false);
  const [useAnsatte, setUseAnsatte] = useState(false);
  const [lønnsPrompt, setLønnsPrompt] = useState(false);

  const fasteSum = getFasteSum(faste);
  const fasteFields = [
    { key:'husleie',          label:'Husleie'            },
    { key:'strøm',            label:'Strøm'              },
    { key:'internett',        label:'Internett'          },
    { key:'betalingsterminal',label:'Betalingsterminal'  },
    { key:'forsikring',       label:'Forsikring'         },
    ...((faste.andreFasteNavn && (faste.andreFasteBeløp||0) > 0)
      ? [{ key:'andreFasteBeløp', label: faste.andreFasteNavn! }] : []),
  ].filter(f => ((faste as Record<string,unknown>)[f.key] as number) > 0);

  const ansatteTotal = ansatteTotalKostnad(ansatte);

  useEffect(() => {
    if (currentData) {
      setForm(Object.fromEntries(FIELDS.map(f => [f.key, String((currentData as unknown as Record<string,unknown>)[f.key] ?? '')])));
      if (ansatte.length > 0 && Math.abs((currentData.lønnskostnader||0) - ansatteTotal) > 1) setLønnsPrompt(true);
    } else {
      const pre = { ...EMPTY };
      if (ansatte.length > 0) pre.lønnskostnader = String(ansatteTotal);
      setForm(pre);
      setLønnsPrompt(false);
    }
    setStatus('idle'); setDelStep(false); setUseAnsatte(false);
  }, [month, currentData?.savedAt]);

  const upd = (k: string) => (v: string) => setForm(p => ({ ...p, [k]: v }));
  const num = Object.fromEntries(Object.entries(form).map(([k,v]) => [k, parseFloat(v)||0]));
  const dr = calcDerived(num as unknown as Partial<MonthData>, fasteSum);
  const lønnsColor = dr.lønnsandel > 70 ? C.red : dr.lønnsandel > 50 ? C.amber : C.green;

  const save = async () => {
    setStatus('saving');
    await onSave(month, num);
    setStatus('saved');
    setTimeout(() => setStatus('idle'), 2500);
  };

  const sections: Record<string,{label:string;color:string}> = {
    income: { label:'Inntekter',          color:C.amber  },
    costs:  { label:'Variable kostnader', color:C.red    },
    vat:    { label:'MVA',                color:C.indigo },
  };

  return (
    <div className="fade-in two-col">
      <Card hover={false}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
          <h3 style={{ fontSize:20 }}>Månedstall — {fmtMonthFull(month)}</h3>
          {fasteSum > 0 && (
            <span style={{ fontSize:11, color:'#F5A623', background:'#1A1200', border:'1px solid #3D2E00', borderRadius:6, padding:'3px 10px', whiteSpace:'nowrap' }}>
              Faste: {formatNOK(fasteSum)}/mnd
            </span>
          )}
        </div>

        {lønnsPrompt && ansatte.length > 0 && (
          <div style={{ padding:'12px 14px', background:C.navyB, border:'1px solid #3D2E00', borderRadius:10, marginBottom:16, fontSize:13, color:C.white, lineHeight:1.7 }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Du har registrert {ansatte.length} ansatte</div>
            <div style={{ color:C.gray, fontSize:12, marginBottom:10 }}>Beregnet lønnskostnad: <strong style={{ color:C.white }}>{formatNOK(ansatteTotal)}</strong> — vil du bruke dette?</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>{setForm(p=>({...p,lønnskostnader:String(ansatteTotal)}));setLønnsPrompt(false);setUseAnsatte(true);}}
                style={{ flex:1, padding:'7px', background:C.white, color:C.navy, border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                Bruk {formatNOK(ansatteTotal)}
              </button>
              <button onClick={()=>setLønnsPrompt(false)}
                style={{ flex:1, padding:'7px', background:'transparent', color:C.gray, border:`1px solid ${C.border}`, borderRadius:7, fontSize:12, cursor:'pointer' }}>
                Behold eksisterende
              </button>
            </div>
          </div>
        )}

        {Object.entries(sections).map(([sec,{label,color}]) => (
          <div key={sec}>
            <div style={{ fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color, marginBottom:12, marginTop:sec!=='income'?20:0, paddingBottom:7, borderBottom:`1px solid ${C.border}` }}>
              {label}
            </div>
            {FIELDS.filter(f=>f.section===sec).map(f => {
              const isLønn = f.key === 'lønnskostnader';
              return (
                <div key={f.key}>
                  <InputField label={f.label} hint={f.hint} value={form[f.key]} onChange={upd(f.key)}/>
                  {isLønn && ansatte.length > 0 && (useAnsatte || form.lønnskostnader === String(ansatteTotal)) && (
                    <div style={{ fontSize:11, color:C.gray, padding:'6px 10px', background:C.navy, borderRadius:7, marginTop:-8, marginBottom:10 }}>
                      Basert på {ansatte.length} ansatte — <span style={{ color:C.white }}>{formatNOK(ansatteTotal)}</span>
                    </div>
                  )}
                </div>
              );
            })}
            {sec === 'vat' && num.inntekter > 0 && (
              <div style={{ fontSize:11, color:C.indigo, padding:'8px 12px', background:C.navy, borderRadius:8, marginTop:4 }}>
                MVA mottatt (auto): <strong>{formatNOK(num.inntekter * 0.25)}</strong> — Inntekter × 25 %
              </div>
            )}
          </div>
        ))}

        {fasteFields.length > 0 && (
          <div style={{ marginTop:20 }}>
            <div style={{ fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color:'#F5A623', marginBottom:12, paddingBottom:7, borderBottom:`1px solid ${C.border}` }}>
              Faste kostnader (automatisk)
            </div>
            {fasteFields.map(f => (
              <div key={f.key} style={{ display:'flex', justifyContent:'space-between', padding:'7px 12px', background:C.navy, borderRadius:7, marginBottom:6, fontSize:13 }}>
                <span style={{ color:C.grayD }}>{f.label}</span>
                <span style={{ color:C.white, fontWeight:600 }}>{formatNOK(Number((faste as Record<string,unknown>)[f.key])||0)}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'9px 12px', background:C.navyM, borderRadius:7, marginTop:4, fontSize:13, fontWeight:700 }}>
              <span style={{ color:'#F5A623' }}>Totalt faste</span>
              <span style={{ color:'#F5A623' }}>{formatNOK(fasteSum)}</span>
            </div>
          </div>
        )}

        <button onClick={save} disabled={num.inntekter===0||status==='saving'}
          style={{ width:'100%', marginTop:8, padding:'12px', background:status==='saved'?C.green:num.inntekter>0?C.white:C.grayD, color:status==='saved'?'#fff':C.navy, border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:num.inntekter>0?'pointer':'not-allowed', transition:'all 0.2s', letterSpacing:'0.04em' }}>
          {status==='saved' ? '✓  Lagret' : status==='saving' ? '…' : 'Lagre måned'}
        </button>

        {currentData && (
          <div style={{ marginTop:10 }}>
            {!delStep ? (
              <button onClick={()=>setDelStep(true)}
                style={{ width:'100%', padding:'10px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:8, color:C.grayD, fontSize:12, fontWeight:500, cursor:'pointer', transition:'all 0.2s' }}
                onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.red;(e.currentTarget as HTMLButtonElement).style.color=C.red;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.border;(e.currentTarget as HTMLButtonElement).style.color=C.grayD;}}>
                Slett månedsdata
              </button>
            ) : (
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>{ setDelStep(false); onDelete(month); }}
                  style={{ flex:1, padding:'10px', background:C.red, border:'none', borderRadius:8, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  Ja, slett alt
                </button>
                <button onClick={()=>setDelStep(false)}
                  style={{ flex:1, padding:'10px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:8, color:C.gray, fontSize:12, cursor:'pointer' }}>
                  Avbryt
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      <div>
        <Card hover={false} style={{ marginBottom:16 }}>
          <h3 style={{ fontSize:18, marginBottom:18 }}>Nøkkeltall</h3>
          <DerivedRow label="Bruttofortjeneste"        value={dr.bruttofortjeneste}  color={C.amber}  note="Inntekter minus varekostnader"/>
          <DerivedRow label="Driftsresultat (EBIT)"    value={dr.driftsresultat}     color={dr.driftsresultat>=0?C.green:C.red} note={`Inkl. faste kostnader ${fasteSum>0?'('+formatNOK(fasteSum)+')':''}`}/>
          <DerivedRow label="Skyldig MVA"               value={dr.netteMva}           color={C.indigo} note="Inntekter × 25 % minus MVA innbetalt"/>
          <DerivedRow label="Lønnsandel av omsetning"  value={dr.lønnsandel}         color={lønnsColor} note={dr.lønnsandel>70?'Høyt — vurder tiltak':dr.lønnsandel>50?'Moderat — følg med':'Under kontroll'} unit="pct"/>
          <DerivedRow label="Bruttomargin"             value={dr.bruttomargin}       color={C.amber}  note="Bruttofortjeneste / Inntekter" unit="pct"/>
        </Card>
      </div>
    </div>
  );
};

// ─── AI Analysis Text Renderer ───────────────────────────────────────────────
const AnalysisText = ({ text }: { text: string }) => {
  const sections: Array<{ heading: string; body: string }> = [];
  let current = { heading: '', lines: [] as string[] };
  for (const line of text.split('\n')) {
    const isHeading = line.startsWith('🔍') || line.startsWith('📊') || line.startsWith('⚡');
    if (isHeading) {
      if (current.heading) sections.push({ heading: current.heading, body: current.lines.join('\n').trim() });
      current = { heading: line, lines: [] };
    } else if (line.trim()) {
      current.lines.push(line);
    }
  }
  if (current.heading) sections.push({ heading: current.heading, body: current.lines.join('\n').trim() });

  if (!sections.length) {
    return <p style={{ color:C.white, fontSize:14, lineHeight:1.8, whiteSpace:'pre-wrap' }}>{text}</p>;
  }

  return (
    <div className="fade-in">
      {sections.map((s, i) => {
        const color = s.heading.startsWith('🔍') ? C.amber : s.heading.startsWith('📊') ? C.indigo : C.green;
        return (
          <div key={i} style={{ padding:'16px 20px', background:C.navy, borderRadius:10, borderLeft:`3px solid ${color}`, marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color, marginBottom:8 }}>{s.heading}</div>
            <p style={{ color:C.white, fontSize:14, margin:0, lineHeight:1.8, whiteSpace:'pre-wrap' }}>{s.body}</p>
          </div>
        );
      })}
    </div>
  );
};

// ─── AI Panel ─────────────────────────────────────────────────────────────────
interface AIPanelProps {
  month: string; allData: MonthData[]; currentData: MonthData | null;
  faste: Partial<FasteKostnader>; ansatte: Ansatt[]; profil: Profil|null;
}
interface AIResult { text?: string; generatedAt?: string; }

const AIPanel = ({ month, allData, currentData, faste, ansatte, profil }: AIPanelProps) => {
  const [analysis, setAnalysis] = useState<AIResult|null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string|null>(null);

  useEffect(() => {
    const cached = lsGet(SAI(month));
    setAnalysis(cached || null);
    setError(null);
  }, [month]);

  const run = async () => {
    if (!currentData) return;
    setLoading(true); setError(null);
    const sorted = [...allData].sort((a,b)=>b.month.localeCompare(a.month));
    const prev2  = sorted.filter(d=>d.month!==month).slice(0,2);
    const fasteSum2 = getFasteSum(faste||{});

    const fmtMonth = (d: MonthData) => {
      const dr = calcDerived(d, fasteSum2);
      return {
        måned: fmtMonthFull(d.month),
        inntekter: d.inntekter,
        varekostnader: d.varekostnader,
        lønnskostnader: d.lønnskostnader,
        andreKostnader: d.andreKostnader,
        fasteKostnader: fasteSum2,
        driftsresultat: dr.driftsresultat,
        lønnsandel_pct: Number(dr.lønnsandel.toFixed(1)),
        bruttomargin_pct: Number(dr.bruttomargin.toFixed(1)),
      };
    };

    const system = `Du er en erfaren norsk regnskapsrådgiver spesialisert på småbedrifter. \nDu analyserer månedstall og gir konkrete, tallbaserte råd på norsk.\n\nDu MÅ alltid:\n1. Sammenligne med forrige måned og si eksplisitt om det er bedre eller verre\n2. Sammenligne nøkkeltall mot bransjesnitt for bedriftstypen\n3. Avslutte med ETT konkret tiltak som inkluderer et faktisk kronebeløp\n\nBransjesnitt du skal bruke:\n- Restaurant/Kafé: lønnsandel 30-35%, bruttomargin 60-70%\n- Frisør/Salong: lønnsandel 40-50%, bruttomargin 50-60%\n- Butikk/Dagligvare: lønnsandel 15-20%, bruttomargin 25-35%\n- Konsulent: lønnsandel 50-60%, bruttomargin 70-85%\n- Håndverk: lønnsandel 35-45%, bruttomargin 40-55%\n- Treningssenter: lønnsandel 25-35%, bruttomargin 55-70%\n\nFormat (følg dette nøyaktig):\n🔍 DENNE MÅNEDEN\n[2-3 setninger om hva som skjedde med konkrete tall og sammenligning mot forrige måned]\n\n📊 VS. BRANSJEN\n[Sammenlign lønnsandel og bruttomargin mot bransjesnitt. Si eksplisitt om de er over eller under, og hva det koster dem i kroner per måned]\n\n⚡ VIKTIGSTE TILTAK\n[ETT konkret tiltak med et faktisk kronebeløp og tidshorisont. F.eks: "Reduser vakt X med 2 timer per dag — sparer deg 8 400 kr per måned"]`;

    const prompt = `Bedriftstype: ${profil?.bedriftstype || 'ukjent'} (${profil?.selskapsform || ''})
Bedriftsnavn: ${profil?.bedriftsnavn || ''}

Aktuell måned:
${JSON.stringify(fmtMonth(currentData), null, 2)}

Tidligere måneder (for sammenligning):
${JSON.stringify(prev2.map(fmtMonth), null, 2)}`;

    try {
      const text = (await callAI(system, prompt, 1200)).trim();
      const data: AIResult = { text, generatedAt: new Date().toISOString() };
      lsSet(SAI(month), data);
      setAnalysis(data);
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Feil');
    } finally { setLoading(false); }
  };

  if (!currentData) return (
    <Card hover={false} style={{ textAlign:'center', padding:48 }}>
      <div style={{ fontSize:40, marginBottom:14 }}>📊</div>
      <h3 style={{ fontSize:22, marginBottom:10 }}>Ingen data for {fmtMonthFull(month)}</h3>
      <p style={{ color:C.gray, fontSize:14 }}>Fyll inn månedstall først for å kjøre AI-analyse.</p>
    </Card>
  );

  return (
    <div className="fade-in">
      <Card hover={false}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
          <div>
            <h3 style={{ fontSize:22, marginBottom:4 }}>AI-analyse — {fmtMonthFull(month)}</h3>
            {analysis?.generatedAt && <div style={{ fontSize:11, color:C.grayD }}>Sist generert {new Date(analysis.generatedAt).toLocaleString('no-NO')}</div>}
          </div>
          <button onClick={run} disabled={loading}
            style={{ padding:'9px 20px', background:loading?C.navyB:C.amber, color:loading?C.gray:C.navy, border:'none', borderRadius:8, fontSize:12, fontWeight:500, cursor:loading?'not-allowed':'pointer', transition:'all 0.2s', display:'flex', alignItems:'center', gap:6 }}>
            {loading && <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', border:`2px solid ${C.navy}`, borderTopColor:'transparent', animation:'spin 0.7s linear infinite' }}/>}
            {loading ? 'Analyserer…' : analysis ? '↺\u00A0Regenerer' : '▶\u00A0Analyser'}
          </button>
        </div>
        {loading && <div style={{ display:'flex', flexDirection:'column', gap:12 }}><Skel w="55%" h={22}/><Skel h={15}/><Skel h={15} w="85%"/><Skel h={15} w="70%"/><div style={{ marginTop:16 }}><Skel w="40%" h={22}/></div><Skel h={15}/><Skel h={15} w="75%"/></div>}
        {error && !loading && <div style={{ padding:16, background:`${C.red}14`, border:`1px solid ${C.red}35`, borderRadius:10, color:C.red, fontSize:13 }}>⚠\u00A0 {error}</div>}
        {!loading && !error && analysis?.text && (
          <AnalysisText text={analysis.text}/>
        )}
        {!loading && !error && !analysis && (
          <div style={{ textAlign:'center', padding:'40px 0', color:C.gray }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🤖</div>
            <p style={{ fontSize:14, lineHeight:1.7 }}>Klikk <strong style={{ color:C.amber }}>Analyser</strong> for å generere en AI-rapport for {fmtMonthFull(month)}.</p>
          </div>
        )}
      </Card>
    </div>
  );
};

// ─── History Table ────────────────────────────────────────────────────────────
const HistoryTable = ({ allData }: { allData: MonthData[] }) => {
  if (!allData.length) return (
    <Card hover={false} style={{ textAlign:'center', padding:56 }}>
      <div style={{ fontSize:44, marginBottom:14 }}>📚</div>
      <h3 style={{ fontSize:22, marginBottom:10 }}>Ingen historikk ennå</h3>
      <p style={{ color:C.gray, fontSize:14 }}>Lagre månedstall for å se historisk oversikt og trendanalyse.</p>
    </Card>
  );
  const metrics = [
    { k:'inntekter',        l:'Inntekter',   pos:'up',   fmt:formatNOK,  dr:false },
    { k:'bruttofortjeneste',l:'Bruttofortj.', pos:'up',  fmt:formatNOK,  dr:true  },
    { k:'driftsresultat',   l:'EBIT',         pos:'up',  fmt:formatNOK,  dr:true  },
    { k:'bruttomargin',     l:'Bruttomargin', pos:'up',  fmt:formatPct,  dr:true  },
    { k:'lønnsandel',       l:'Lønnsandel',   pos:'down',fmt:formatPct,  dr:true  },
    { k:'totaleKostnader',  l:'Totale kost.', pos:'down',fmt:formatNOK,  dr:true  },
    { k:'netteMva',         l:'Skyldig MVA',  pos:'down',fmt:formatNOK,  dr:true  },
  ];
  const rows = allData.map((d,i) => {
    const dr   = calcDerived(d);
    const prev = i>0 ? allData[i-1] : null;
    const pdr  = prev ? calcDerived(prev) : null;
    return { ...d, ...dr, _prev: prev ? { ...prev, ...pdr } : null };
  }).reverse();
  const TH = ({ children }: { children: React.ReactNode }) => (
    <th style={{ padding:'14px 18px', textAlign:'right', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:C.gray, fontWeight:500, background:C.navyM, whiteSpace:'nowrap' as const }}>{children}</th>
  );
  return (
    <div className="fade-in">
      <Card hover={false} style={{ padding:0, overflow:'hidden' }}>
        <div className="history-table-wrap" style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                <th style={{ padding:'14px 20px', textAlign:'left', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:C.gray, fontWeight:500, background:C.navyM, position:'sticky', left:0, zIndex:2 }}>Måned</th>
                {metrics.map(m => <TH key={m.k}>{m.l}</TH>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const rowAny = row as Record<string, unknown>;
                return (
                  <tr key={row.month} style={{ borderBottom:`1px solid ${C.border}` }}
                    onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background=`${C.navyB}40`}
                    onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background='transparent'}>
                    <td style={{ padding:'13px 20px', fontSize:13, color:C.white, whiteSpace:'nowrap', position:'sticky', left:0, background:C.navyL, zIndex:1 }}>{fmtMonthFull(row.month)}</td>
                    {metrics.map(m => {
                      const val  = rowAny[m.k] as number;
                      const pval = (rowAny._prev as Record<string,unknown>)?.[m.k] as number|undefined;
                      const delta = (pval !== undefined && pval !== null && pval !== 0) ? ((val-pval)/Math.abs(pval))*100 : null;
                      const good = delta !== null && ((m.pos==='up'&&delta>0)||(m.pos==='down'&&delta<0));
                      const bad  = delta !== null && ((m.pos==='up'&&delta<0)||(m.pos==='down'&&delta>0));
                      return (
                        <td key={m.k} style={{ padding:'13px 18px', textAlign:'right', fontSize:13, color:good?C.green:bad?C.red:C.white, whiteSpace:'nowrap' }}>
                          {m.fmt(val)}
                          {delta !== null && <span style={{ marginLeft:6, fontSize:10, color:good?C.green:bad?C.red:C.grayD }}>{good?'↑':bad?'↓':'→'}{Math.abs(delta).toFixed(1)}%</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ─── Reservation Panel ────────────────────────────────────────────────────────
const ReservationPanel = ({ allData }: { allData: MonthData[] }) => {
  const now = new Date();
  const mo  = now.getMonth();
  const termStart  = mo % 2 === 0 ? mo : mo - 1;
  const termYear   = now.getFullYear();
  const termMonths = [`${termYear}-${String(termStart+1).padStart(2,'0')}`, `${termYear}-${String(termStart+2).padStart(2,'0')}`];
  const deadlineMonth = termStart + 2;
  const deadlineYear  = deadlineMonth > 11 ? termYear+1 : termYear;
  const deadline      = new Date(deadlineYear, deadlineMonth % 12, 10);
  const daysLeft      = Math.ceil((deadline.getTime()-now.getTime())/(1000*60*60*24));
  const deadlineStr   = `${deadline.getDate()}. ${MONTHS_NO[deadline.getMonth()]} ${deadline.getFullYear()}`;
  const termData  = allData.filter(d => termMonths.includes(d.month));
  const totalMva  = termData.reduce((sum,d) => sum + ((d.inntekter||0)*0.25-(d.mvaInnbetalt||0)), 0);
  if (!termData.length) return null;
  const isPaid   = totalMva <= 0;
  const isUrgent = !isPaid && daysLeft < 14;
  const bg       = isUrgent ? '#2A0A0E' : '#1A1200';
  const border   = isUrgent ? '#7A1020' : '#3D2E00';
  const accent   = isUrgent ? C.red : '#F5A623';
  const termLabel = `${MONTHS_NO[termStart]}/${MONTHS_NO[termStart+1]||MONTHS_NO[0]} ${termYear}`;
  return (
    <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:14, padding:'16px 20px', marginBottom:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:10, color:accent, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:4 }}>🔒 MVA-reservasjon · Termin {termLabel}</div>
          {isPaid
            ? <div style={{ fontSize:18, fontWeight:800, color:C.green }}>MVA er betalt for denne terminen ✅</div>
            : <div style={{ fontSize:26, fontWeight:800, color:accent }}>{formatNOK(totalMva)}</div>}
          {!isPaid && <div style={{ fontSize:12, color:isUrgent?C.red:'#A37A00', marginTop:4, fontWeight:isUrgent?700:400 }}>Frist: {deadlineStr} — {daysLeft} dager igjen{isUrgent?' ⚠️':''}</div>}
        </div>
        {!isPaid && <div style={{ fontSize:11, color:'#6B5200', textAlign:'right', maxWidth:220, lineHeight:1.6 }}>Skyldig MVA for {termData.length===2?'begge månedene':'måneden'} i terminen</div>}
      </div>
      <div style={{ fontSize:10, color:'#6B5200', marginTop:10, borderTop:`1px solid ${border}`, paddingTop:8, lineHeight:1.6 }}>
        Beløpet baserer seg på inntastet data. Kontakt regnskapsfører for nøyaktige tall.
      </div>
    </div>
  );
};

// ─── Warning system ───────────────────────────────────────────────────────────
interface Warning { level: 'red' | 'yellow'; icon: string; message: string; }

const BRANSJE_NORMER: Record<string, { lønn: [number, number]; margin: [number, number] }> = {
  restaurant:    { lønn: [30, 35], margin: [60, 70] },
  frisør:        { lønn: [40, 50], margin: [50, 60] },
  butikk:        { lønn: [15, 20], margin: [25, 35] },
  konsulent:     { lønn: [50, 60], margin: [70, 85] },
  håndverk:      { lønn: [35, 45], margin: [40, 55] },
  treningssenter:{ lønn: [25, 35], margin: [55, 70] },
};

function computeWarnings(
  curr: MonthData, currDr: ReturnType<typeof calcDerived>,
  prev: MonthData | null, prevDr: ReturnType<typeof calcDerived> | null,
  bedriftstype: string,
): Warning[] {
  const warns: Warning[] = [];
  const normer = BRANSJE_NORMER[bedriftstype];
  const lønn   = currDr.lønnsandel;
  const margin = currDr.bruttomargin;

  // Lønnsandel
  if (lønn > 45) {
    const normMax  = normer?.lønn[1] ?? 40;
    const ekstra   = Math.round(curr.inntekter * (lønn - normMax) / 100);
    warns.push({ level: 'red', icon: '🔴', message: `Lønnsandel er ${lønn.toFixed(1)}% — bransjenorm er maks ${normMax}%. Det koster deg ${formatNOK(ekstra)} ekstra denne måneden.` });
  } else if (lønn >= 35) {
    warns.push({ level: 'yellow', icon: '🟡', message: `Lønnsandel er ${lønn.toFixed(1)}% — nærmer seg kritisk nivå (over 45%). Følg med neste måned.` });
  }

  // Bruttomargin
  if (margin < 20) {
    warns.push({ level: 'red', icon: '🔴', message: `Bruttomargin er kun ${margin.toFixed(1)}% — under kritisk grense på 20%. Vurder å øke priser eller redusere varekostnader.` });
  } else if (normer && margin < normer.margin[0]) {
    warns.push({ level: 'yellow', icon: '🟡', message: `Bruttomargin er ${margin.toFixed(1)}% — bransjenorm er ${normer.margin[0]}–${normer.margin[1]}%. Du er under snittet.` });
  }

  // Negativt driftsresultat
  if (currDr.driftsresultat < 0) {
    warns.push({ level: 'red', icon: '🔴', message: `Underskudd på ${formatNOK(Math.abs(currDr.driftsresultat))} denne måneden — kostnadene overstiger inntektene.` });
  }

  // Kostnader økt mer enn 15% fra forrige måned
  if (prev && prevDr && prevDr.totaleKostnader > 0) {
    const kostPct = ((currDr.totaleKostnader - prevDr.totaleKostnader) / prevDr.totaleKostnader) * 100;
    if (kostPct > 15) {
      const ekstra = Math.round(currDr.totaleKostnader - prevDr.totaleKostnader);
      warns.push({ level: 'yellow', icon: '🟡', message: `Totale kostnader økte ${kostPct.toFixed(1)}% fra forrige måned — ${formatNOK(ekstra)} mer enn måneden før.` });
    }
  }

  return warns;
}

const WarningBanner = ({ warnings }: { warnings: Warning[] }) => {
  if (!warnings.length) return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 18px', background:'#0D2B1A', border:`1px solid #1A4D2E`, borderRadius:12, marginBottom:20, fontSize:13, color:C.green }}>
      <span style={{ fontSize:16 }}>✅</span>
      <span>Alle nøkkeltall ser bra ut denne måneden</span>
    </div>
  );
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
      {warnings.map((w, i) => {
        const isRed = w.level === 'red';
        return (
          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 18px', background: isRed ? `${C.red}12` : '#241A00', border:`1px solid ${isRed ? C.red+'50' : '#5C3D00'}`, borderRadius:12, fontSize:13, color: isRed ? C.red : '#F5A623' }}>
            <span style={{ fontSize:15, flexShrink:0, marginTop:1 }}>{w.icon}</span>
            <span style={{ lineHeight:1.6 }}>{w.message}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = ({ allData, month, faste, profil }: { allData: MonthData[]; month: string; faste: Partial<FasteKostnader>; profil: Profil | null }) => {
  const fasteSum = getFasteSum(faste||{});
  const sorted   = [...allData].sort((a,b)=>a.month.localeCompare(b.month));
  const curr     = sorted.find(d=>d.month===month) || null;
  const currDr   = curr ? calcDerived(curr, fasteSum) : null;
  const cidx     = sorted.findIndex(d=>d.month===month);
  const prev     = cidx > 0 ? sorted[cidx-1] : null;
  const prevDr   = prev ? calcDerived(prev, fasteSum) : null;
  const delta = (field: string, isDr=false) => {
    const c = isDr ? currDr?.[field as keyof typeof currDr] : curr?.[field as keyof MonthData];
    const p = isDr ? prevDr?.[field as keyof typeof prevDr] : prev?.[field as keyof MonthData];
    if (c==null||p==null||p===0) return null;
    return ((Number(c)-Number(p))/Math.abs(Number(p)))*100;
  };
  const warnings = (curr && currDr)
    ? computeWarnings(curr, currDr, prev, prevDr, profil?.bedriftstype || '')
    : [];

  if (!curr && !allData.length) return (
    <div className="fade-in" style={{ textAlign:'center', padding:'80px 0' }}>
      <div style={{ fontSize:64, marginBottom:20 }}>📊</div>
      <h2 style={{ fontSize:30, marginBottom:14 }}>Kom i gang med FinanceIQ</h2>
      <p style={{ color:C.gray, fontSize:15, maxWidth:420, margin:'0 auto', lineHeight:1.8 }}>Ingen data registrert ennå. Gå til <strong style={{ color:C.amber }}>Datainntasting</strong> for å legge inn din første måned.</p>
    </div>
  );
  const sortedWithDr = sorted.map(d => ({ ...d, ...calcDerived(d, fasteSum) }));
  return (
    <div className="fade-in">
      {curr && <WarningBanner warnings={warnings}/>}
      <ReservationPanel allData={allData}/>
      {curr ? (
        <div className="kpi-grid">
          <KPICard title="Inntekter"   value={curr.inntekter}          unit="nok" delta={delta('inntekter')}           positive="up"   sparkData={sorted as unknown as Record<string,unknown>[]} sparkKey="inntekter"       sparkColor={C.amber}/>
          <KPICard title="EBIT"        value={currDr?.driftsresultat||0} unit="nok" delta={delta('driftsresultat',true)} positive="up"   sparkData={sortedWithDr as unknown as Record<string,unknown>[]} sparkKey="driftsresultat"  sparkColor={(currDr?.driftsresultat||0)>=0?C.green:C.red}/>
          <KPICard title="Lønnsandel"  value={currDr?.lønnsandel||0}   unit="pct" delta={delta('lønnsandel',true)}     positive="down" sparkData={sortedWithDr as unknown as Record<string,unknown>[]} sparkKey="lønnsandel"      sparkColor={C.red}/>
          <KPICard title="Bruttomargin" value={currDr?.bruttomargin||0} unit="pct" delta={delta('bruttomargin',true)}  positive="up"   sparkData={sortedWithDr as unknown as Record<string,unknown>[]} sparkKey="bruttomargin"    sparkColor={C.indigo}/>
        </div>
      ) : (
        <div style={{ background:C.navyL, border:`1px dashed ${C.border}`, borderRadius:12, padding:20, textAlign:'center', color:C.gray, marginBottom:28, fontSize:13 }}>
          Ingen data for {fmtMonthFull(month)} — gå til Datainntasting for å registrere tall.
        </div>
      )}
      {sorted.length > 0 && (
        <div className="chart-grid">
          <Card hover={false}><h3 style={{ fontSize:16, marginBottom:18, color:C.white }}>Inntekter vs. Totale kostnader</h3><RevenueChart data={sorted}/></Card>
          <Card hover={false}><h3 style={{ fontSize:16, marginBottom:18, color:C.white }}>Kostnadsfordeling per måned</h3><CostChart data={sorted} fasteSum={fasteSum}/></Card>
        </div>
      )}
      {sorted.length >= 2 && (
        <Card hover={false}>
          <h3 style={{ fontSize:16, marginBottom:20 }}>Nøkkeltrender</h3>
          <div className="trend-grid">
            {[{ label:'Inntekter', key:'inntekter', color:C.amber }, { label:'Lønnskostnader', key:'lønnskostnader', color:C.red }, { label:'Varekostnader', key:'varekostnader', color:C.indigo }, { label:'Andre kostnader', key:'andreKostnader', color:C.green }].map(({label,key,color}) => {
              const vals = sorted.map(d => (d[key as keyof MonthData] as number)||0);
              const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx-mn||1;
              const W=90, H=40;
              const pts = vals.map((v,i)=>({ x:(i/(vals.length-1))*W, y:H-((v-mn)/rng)*(H-8)-4 }));
              const pathD = pts.map((p,i)=>`${i===0?'M':'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
              const last  = pts[pts.length-1];
              const prev0 = vals.length>=2 ? vals[vals.length-2] : null;
              const curr0 = vals[vals.length-1];
              const pct   = prev0 ? ((curr0-prev0)/Math.abs(prev0))*100 : null;
              return (
                <div key={key}>
                  <div style={{ fontSize:10, color:C.gray, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>{label}</div>
                  <svg width={W} height={H} style={{ overflow:'visible', display:'block', marginBottom:8 }}>
                    <path d={pathD} stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round"/>
                    <circle cx={last.x} cy={last.y} r={3} fill={color}/>
                  </svg>
                  <div style={{ fontSize:14, color, fontWeight:500 }}>{formatNOK(curr0)}</div>
                  {pct !== null && <div style={{ fontSize:11, color:pct>0?C.green:pct<0?C.red:C.gray, marginTop:3 }}>{pct>0?'↑':pct<0?'↓':'→'}{Math.abs(pct).toFixed(1)}%</div>}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

// ─── Month Calendar ───────────────────────────────────────────────────────────
const MonthCalendar = ({ allData, month, onNavigate }: { allData: MonthData[]; month: string; onNavigate: (m:string)=>void }) => {
  const supabase = createClient();
  const [year, setYear] = useState(() => parseInt(month.split('-')[0]));
  const [invoiceCounts, setInvoiceCounts] = useState<Record<string,number>>({});

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('fakturaer').select('dato').eq('user_id', user.id);
      if (!data) return;
      const counts: Record<string,number> = {};
      for (const row of data) {
        if (row.dato) { const m = (row.dato as string).slice(0,7); counts[m] = (counts[m]??0)+1; }
      }
      setInvoiceCounts(counts);
    };
    load();
  }, []);

  const savedSet = new Set(allData.map(d => d.month));
  const NB: React.CSSProperties = { background:'transparent', border:`1px solid ${C.border}`, borderRadius:7, color:C.gray, cursor:'pointer', padding:'6px 14px', fontSize:13, transition:'all 0.15s' };
  return (
    <div className="fade-in">
      <Card hover={false}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h3 style={{ fontSize:20, fontWeight:800 }}>Månedsoversikt {year}</h3>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button style={NB} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.white;(e.currentTarget as HTMLButtonElement).style.color=C.white;}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.border;(e.currentTarget as HTMLButtonElement).style.color=C.gray;}} onClick={()=>setYear(y=>y-1)}>← {year-1}</button>
            <button style={NB} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.white;(e.currentTarget as HTMLButtonElement).style.color=C.white;}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.border;(e.currentTarget as HTMLButtonElement).style.color=C.gray;}} onClick={()=>setYear(y=>y+1)}>{year+1} →</button>
          </div>
        </div>
        <div className="month-cal-grid">
          {MONTHS_NO.map((name,i) => {
            const mKey     = `${year}-${String(i+1).padStart(2,'0')}`;
            const isSaved  = savedSet.has(mKey);
            const isCurrent= mKey === getCurrentMonth();
            const isSelected=mKey === month;
            const data     = isSaved ? allData.find(d=>d.month===mKey) : null;
            const dr       = data ? calcDerived(data) : null;
            const nFakt    = invoiceCounts[mKey] ?? 0;
            return (
              <div key={mKey} onClick={()=>onNavigate(mKey)}
                style={{ padding:'16px', borderRadius:12, cursor:'pointer', border:isSelected?`2px solid ${C.white}`:`1px solid ${isSaved?C.navyHL:C.border}`, background:isSaved?C.navyM:C.navy, transition:'all 0.15s', position:'relative' }}
                onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=C.white;(e.currentTarget as HTMLDivElement).style.background=C.navyM;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=isSelected?C.white:isSaved?C.navyHL:C.border;(e.currentTarget as HTMLDivElement).style.background=isSaved?C.navyM:C.navy;}}>
                {isCurrent && <div style={{ position:'absolute', top:10, right:10, width:6, height:6, borderRadius:'50%', background:C.green }}/>}
                <div style={{ fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:isSaved?C.white:C.grayD, marginBottom:8 }}>{name}</div>
                {isSaved && data ? (
                  <>
                    <div style={{ fontSize:11, color:C.green, fontWeight:600, marginBottom:4 }}>✓ Utfylt</div>
                    <div style={{ fontSize:12, color:C.gray }}>{formatNOK(data.inntekter)}</div>
                    {dr && <div style={{ fontSize:11, marginTop:4, color:dr.driftsresultat>=0?C.green:C.red, fontWeight:600 }}>{dr.driftsresultat>=0?'▲':'▼'} {formatNOK(dr.driftsresultat)}</div>}
                  </>
                ) : <div style={{ fontSize:11, color:C.grayD }}>Ingen data</div>}
                {nFakt > 0 && (
                  <a href={`/app/fakturaer/${mKey}`}
                    onClick={e=>e.stopPropagation()}
                    style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:8, padding:'4px 8px', background:C.navyB, border:`1px solid ${C.border}`, borderRadius:6, fontSize:11, color:C.gray, textDecoration:'none', transition:'all 0.15s' }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=C.amber;(e.currentTarget as HTMLAnchorElement).style.color=C.amber;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=C.border;(e.currentTarget as HTMLAnchorElement).style.color=C.gray;}}>
                    📄 Se fakturaer ({nFakt})
                  </a>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop:16, display:'flex', gap:16, fontSize:11, color:C.grayD }}>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:8, height:8, borderRadius:2, background:C.navyM, border:`1px solid ${C.navyHL}`, display:'inline-block' }}/>Utfylt</span>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:8, height:8, borderRadius:2, background:C.navy, border:`1px solid ${C.border}`, display:'inline-block' }}/>Tom</span>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:6, height:6, borderRadius:'50%', background:C.green, display:'inline-block' }}/>Inneværende måned</span>
        </div>
      </Card>
    </div>
  );
};

// ─── Likviditet Panel ─────────────────────────────────────────────────────────
const LikviditetPanel = ({ allData }: { allData: MonthData[] }) => {
  const [saldo,       setSaldo]       = useState('');
  useEffect(() => { const v = lsGet(SLIK); if (v) setSaldo(v); }, []);
  const [focus,       setFocus]       = useState(false);
  const [aiText,      setAiText]      = useState<{tiltak?:string[]}|null>(null);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiError,     setAiError]     = useState<string|null>(null);
  const [aiTriggered, setAiTriggered] = useState(false);
  const sorted  = [...allData].sort((a,b)=>b.month.localeCompare(a.month));
  const last3   = sorted.slice(0,3);
  const avgFlow = last3.length > 0 ? last3.reduce((sum,d) => sum + ((d.inntekter||0)-(calcDerived(d)?.totaleKostnader||0)), 0) / last3.length : 0;
  const numSaldo = parseFloat(saldo) || 0;
  const proj30 = numSaldo + avgFlow * 1;
  const proj60 = numSaldo + avgFlow * 2;
  const proj90 = numSaldo + avgFlow * 3;
  let zeroMonth: string|null = null;
  if (avgFlow < 0 && numSaldo > 0) {
    const mths = Math.ceil(numSaldo / Math.abs(avgFlow));
    const now = new Date();
    const z = new Date(now.getFullYear(), now.getMonth()+mths, 1);
    zeroMonth = `${MONTHS_NO[z.getMonth()]} ${z.getFullYear()}`;
  }
  const statusColor = numSaldo <= 0 ? C.grayD : proj90 >= 50000 ? C.green : proj90 >= 10000 ? '#F5A623' : C.red;
  const statusEmoji = numSaldo <= 0 ? '' : proj90 >= 50000 ? '🟢' : proj90 >= 10000 ? '🟡' : '🔴';
  const chartData = [{ name:'Nå', saldo:numSaldo },{ name:'30 dager', saldo:proj30 },{ name:'60 dager', saldo:proj60 },{ name:'90 dager', saldo:proj90 }];
  const saveSaldo = (v: string) => { setSaldo(v); lsSet(SLIK, v); };
  const runAI = async () => {
    if (!last3.length) return;
    setAiLoading(true); setAiError(null);
    try {
      const text = await callAI(
        `Du er norsk regnskapsrådgiver. Gi 2 konkrete, handlingsrettede råd for å forbedre kontantstrøm. Svar med JSON uten markdown: {"tiltak": ["...", "..."]}`,
        `Saldo: ${formatNOK(numSaldo)}. Estimert 90-dagers saldo: ${formatNOK(proj90)}. Avg. månedlig netto: ${formatNOK(avgFlow)}. Kostnadsprofil: ${JSON.stringify(last3.map(d=>({måned:fmtMonthFull(d.month),inntekter:d.inntekter,lønnskostnader:d.lønnskostnader,varekostnader:d.varekostnader,andreKostnader:d.andreKostnader})))}`,
        400
      );
      const m2 = text.trim().match(/\{[\s\S]*\}/);
      if (!m2) throw new Error('Ugyldig respons');
      setAiText(JSON.parse(m2[0]) as {tiltak?: string[]});
    } catch(e) { setAiError(e instanceof Error ? e.message : 'Feil'); }
    finally { setAiLoading(false); }
  };
  useEffect(() => {
    if (numSaldo > 0 && proj90 < 50000 && last3.length > 0 && !aiTriggered && !aiText) {
      setAiTriggered(true); runAI();
    }
  }, [numSaldo]);
  return (
    <div className="fade-in">
      <div className="two-col-eq" style={{ marginBottom:20 }}>
        <Card hover={false}>
          <h3 style={{ fontSize:20, fontWeight:800, marginBottom:6 }}>Likviditetsvarsel</h3>
          <p style={{ color:C.gray, fontSize:12, marginBottom:20, lineHeight:1.6 }}>Basert på gjennomsnittlig netto kontantstrøm de siste {last3.length||'—'} månedene.</p>
          <label style={{ fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color:C.gray, display:'block', marginBottom:5 }}>Nåværende banksaldo</label>
          <div style={{ position:'relative', marginBottom:18 }}>
            <input type="number" value={saldo} onChange={e=>saveSaldo(e.target.value)} placeholder="0"
              onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
              style={{ width:'100%', background:C.navy, border:`1px solid ${focus?C.white:C.border}`, borderRadius:8, padding:'10px 45px 10px 12px', fontSize:14, color:C.white, outline:'none' }}/>
            <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:C.grayD, fontSize:11, pointerEvents:'none' }}>kr</span>
          </div>
          <div style={{ fontSize:12, color:C.gray, marginBottom:16, padding:'10px 14px', background:C.navy, borderRadius:8 }}>
            Avg. månedlig netto kontantstrøm: <span style={{ color:avgFlow>=0?C.green:C.red, fontWeight:700 }}>{last3.length?formatNOK(avgFlow):'—'}</span>
          </div>
          <div style={{ padding:'20px', background:C.navy, borderRadius:12, border:`2px solid ${statusColor}`, textAlign:'center' }}>
            <div style={{ fontSize:11, color:C.gray, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.1em' }}>Estimert saldo om 90 dager</div>
            <div style={{ fontSize:30, fontWeight:800, color:statusColor }}>{numSaldo > 0 ? formatNOK(proj90) : '—'}</div>
            {statusEmoji && <div style={{ fontSize:16, marginTop:6 }}>{statusEmoji}</div>}
          </div>
          {zeroMonth && <div style={{ marginTop:14, padding:'12px 16px', background:`${C.red}14`, border:`1px solid ${C.red}35`, borderRadius:10, fontSize:13, color:C.red, lineHeight:1.6 }}>⚠️ Estimert tom for likviditet: <strong>{zeroMonth}</strong></div>}
          {!last3.length && <div style={{ marginTop:14, fontSize:12, color:C.grayD }}>Fyll inn månedstall for å beregne kontantstrøm.</div>}
        </Card>
        <Card hover={false}>
          <h3 style={{ fontSize:18, fontWeight:800, marginBottom:18 }}>Kontantstrømprognose</h3>
          {numSaldo > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top:8, right:8, left:-12, bottom:0 }}>
                  <defs><linearGradient id="gL" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={statusColor} stopOpacity={0.3}/><stop offset="95%" stopColor={statusColor} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <XAxis dataKey="name" tick={{ fill:C.gray, fontSize:11, fontFamily:'Cabinet Grotesk' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:C.gray, fontSize:10, fontFamily:'Cabinet Grotesk' }} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                  <Tooltip content={<ChartTip/>}/>
                  <ReferenceLine y={0} stroke={C.red} strokeDasharray="4 4" strokeWidth={1.5}/>
                  <Area type="monotone" dataKey="saldo" stroke={statusColor} fill="url(#gL)" strokeWidth={2} dot={{ fill:statusColor, r:4, strokeWidth:0 }} name="Estimert saldo"/>
                </AreaChart>
              </ResponsiveContainer>
              <div className="cash-proj-grid">
                {([['30 dager',proj30],['60 dager',proj60],['90 dager',proj90]] as [string,number][]).map(([lbl,val]) => {
                  const c = val >= 50000 ? C.green : val >= 10000 ? '#F5A623' : C.red;
                  return (
                    <div key={lbl} style={{ padding:'12px', background:C.navy, borderRadius:8, textAlign:'center' }}>
                      <div style={{ fontSize:10, color:C.gray, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>{lbl}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:c }}>{formatNOK(val)}</div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : <div style={{ textAlign:'center', padding:'70px 0', color:C.grayD, fontSize:13 }}>Skriv inn banksaldo for å se prognose</div>}
        </Card>
      </div>
      {numSaldo > 0 && proj90 < 50000 && (
        <Card hover={false}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ fontSize:18, fontWeight:800 }}>AI-råd for kontantstrøm</h3>
            <button onClick={runAI} disabled={aiLoading} style={{ padding:'7px 16px', background:aiLoading?C.navyB:C.white, color:C.navy, border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:aiLoading?'not-allowed':'pointer' }}>{aiLoading?'…':'↺ Oppdater'}</button>
          </div>
          {aiLoading && <div style={{ display:'flex', flexDirection:'column', gap:10 }}><Skel/><Skel w="80%"/><Skel w="60%"/></div>}
          {aiError && !aiLoading && <div style={{ color:C.red, fontSize:13 }}>⚠ {aiError}</div>}
          {!aiLoading && !aiError && aiText && (
            <div className="fade-in">
              {aiText.tiltak?.map((t,i) => (
                <div key={i} style={{ display:'flex', gap:12, padding:'12px 16px', background:C.navy, borderRadius:9, borderLeft:`3px solid ${C.green}`, marginBottom:10 }}>
                  <span style={{ color:C.green, fontSize:16 }}>→</span>
                  <p style={{ color:C.white, fontSize:14, margin:0, lineHeight:1.7 }}>{t}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

// ─── Kalkulator Panel ─────────────────────────────────────────────────────────
interface Scenario { name: string; amount: number; verdict: string|null; newEBIT: number|null; savedAt: string; }
const VC = {
  go:      { color:C.green,   emoji:'🟢', text:'Ja, du tåler dette',    sub:'Marginen forblir sunn.' },
  caution: { color:'#F5A623', emoji:'🟡', text:'Mulig, men stramt',     sub:'Marginen faller under 10 %.' },
  stop:    { color:C.red,     emoji:'🔴', text:'Ikke anbefalt nå',      sub:'EBIT vil bli negativt.' },
};
const KalkulatorPanel = ({ allData, currentMonth }: { allData: MonthData[]; currentMonth: string }) => {
  const [name,      setName]      = useState('');
  const [amount,    setAmount]    = useState('');
  const [isPayroll, setIsPayroll] = useState(false);
  const [aiText,    setAiText]    = useState<string|null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  useEffect(() => { const v = lsGet(SSCEN); if (v) setScenarios(v); }, []);
  const curr   = allData.find(d=>d.month===currentMonth) || null;
  const currDr = curr ? calcDerived(curr) : null;
  const numAmt = parseFloat(amount) || 0;
  const newEBIT       = currDr ? currDr.driftsresultat - numAmt : null;
  const newLønnsandel = curr   ? ((curr.lønnskostnader||0)+(isPayroll?numAmt:0)) / (Math.max(curr.inntekter||1,1)) * 100 : null;
  const marginPct     = curr?.inntekter && curr.inntekter > 0 && newEBIT !== null ? (newEBIT/curr.inntekter)*100 : null;
  const verdict       = marginPct === null ? null : marginPct > 10 ? 'go' : marginPct > 0 ? 'caution' : 'stop';
  const runAI = async () => {
    if (!curr || !numAmt) return;
    setAiLoading(true);
    try {
      const prev3 = [...allData].sort((a,b)=>b.month.localeCompare(a.month)).slice(0,3);
      const text = await callAI(
        `Du er norsk regnskapsrådgiver. Gi konkret råd i maks 3 setninger. Svar med JSON uten markdown: {"råd": "..."}`,
        `Scenario: "${name||'Ny kostnad'}" — ${formatNOK(numAmt)}/mnd. Nåværende EBIT: ${formatNOK(currDr?.driftsresultat||0)}. Ny EBIT: ${formatNOK(newEBIT||0)}. Ny lønnsandel: ${formatPct(newLønnsandel||0)}. Siste ${prev3.length} måneder: ${JSON.stringify(prev3.map(d=>({måned:fmtMonthFull(d.month),inntekter:d.inntekter,driftsresultat:calcDerived(d)?.driftsresultat})))}`,
        350
      );
      const m2 = text.trim().match(/\{[\s\S]*\}/);
      if (!m2) throw new Error('Ugyldig respons');
      const parsed = JSON.parse(m2[0]) as { råd?: string };
      setAiText(parsed.råd || null);
      const scen = { name:name||'Kostnad', amount:numAmt, verdict, newEBIT:newEBIT||null, savedAt:new Date().toISOString() };
      const updated = [scen, ...scenarios].slice(0,5);
      setScenarios(updated); lsSet(SSCEN, updated);
    } catch(e) { console.error(e); }
    finally { setAiLoading(false); }
  };
  const vc = verdict ? VC[verdict as keyof typeof VC] : null;
  const IStyle: React.CSSProperties = { width:'100%', background:C.navy, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:14, color:C.white, outline:'none', marginBottom:14 };
  return (
    <div className="fade-in">
      <div className="two-col">
        <Card hover={false}>
          <h3 style={{ fontSize:20, fontWeight:800, marginBottom:6 }}>Tåler jeg dette?</h3>
          <p style={{ color:C.gray, fontSize:12, marginBottom:20, lineHeight:1.6 }}>Legg inn en potensiell ny kostnad og se konsekvensene for {fmtMonthFull(currentMonth)}.</p>
          {!curr && <div style={{ padding:'12px 14px', background:`${C.red}14`, border:`1px solid ${C.red}35`, borderRadius:10, fontSize:13, color:C.red, marginBottom:16 }}>Fyll inn data for {fmtMonthFull(currentMonth)} først.</div>}
          <label style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.12em', color:C.gray, display:'block', marginBottom:5 }}>Navn på kostnad</label>
          <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="F.eks. Ny ansatt"
            style={IStyle} onFocus={e=>(e.target as HTMLInputElement).style.borderColor=C.white} onBlur={e=>(e.target as HTMLInputElement).style.borderColor=C.border}/>
          <label style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.12em', color:C.gray, display:'block', marginBottom:5 }}>Månedlig beløp</label>
          <div style={{ position:'relative', marginBottom:14 }}>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"
              style={{ ...IStyle, margin:0, paddingRight:45 }} onFocus={e=>(e.target as HTMLInputElement).style.borderColor=C.white} onBlur={e=>(e.target as HTMLInputElement).style.borderColor=C.border}/>
            <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:C.grayD, fontSize:11, pointerEvents:'none' }}>kr</span>
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:C.gray, marginBottom:20, marginTop:6 }}>
            <input type="checkbox" checked={isPayroll} onChange={e=>setIsPayroll(e.target.checked)} style={{ accentColor:C.white, width:14, height:14 }}/>
            Er dette en lønnskostnad?
          </label>
          {vc && numAmt > 0 && (
            <div style={{ padding:'18px', background:`${vc.color}10`, border:`2px solid ${vc.color}40`, borderRadius:12, textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:20, marginBottom:6 }}>{vc.emoji}</div>
              <div style={{ fontSize:18, fontWeight:800, color:vc.color }}>{vc.text}</div>
              <div style={{ fontSize:12, color:C.gray, marginTop:4 }}>{vc.sub}</div>
            </div>
          )}
          {numAmt > 0 && curr && (
            <button onClick={runAI} disabled={aiLoading}
              style={{ width:'100%', padding:'11px', background:aiLoading?C.navyB:C.white, color:C.navy, border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:aiLoading?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              {aiLoading && <span style={{ width:10, height:10, borderRadius:'50%', border:`2px solid ${C.navy}`, borderTopColor:'transparent', animation:'spin 0.7s linear infinite', display:'inline-block' }}/>}
              {aiLoading ? 'Analyserer…' : '🤖 Få AI-råd'}
            </button>
          )}
        </Card>
        <div>
          {numAmt > 0 && curr && (
            <Card hover={false} style={{ marginBottom:16 }}>
              <h3 style={{ fontSize:16, fontWeight:800, marginBottom:16 }}>Konsekvensanalyse</h3>
              {[
                { label:'Ny EBIT',          val:newEBIT||0,        fmt:formatNOK, color:(newEBIT||0)>=0?C.green:C.red },
                { label:'Ny lønnsandel',    val:newLønnsandel||0,  fmt:formatPct, color:(newLønnsandel||0)>70?C.red:(newLønnsandel||0)>50?'#F5A623':C.green },
                { label:'Buffer igjen/mnd', val:newEBIT||0,        fmt:formatNOK, color:(newEBIT||0)>=0?C.green:C.red },
              ].map(({label,val,fmt,color}) => (
                <div key={label} style={{ padding:'12px 16px', background:C.navy, borderRadius:10, borderLeft:`3px solid ${color}`, marginBottom:10 }}>
                  <div style={{ fontSize:10, color:C.gray, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:20, color, fontWeight:700 }}>{fmt(val)}</div>
                </div>
              ))}
            </Card>
          )}
          {aiText && !aiLoading && (
            <Card hover={false} style={{ marginBottom:16 }}>
              <h3 style={{ fontSize:16, fontWeight:800, marginBottom:12 }}>AI-vurdering</h3>
              <div style={{ padding:'16px', background:C.navy, borderRadius:10, borderLeft:`3px solid ${C.indigo}` }}>
                <p style={{ color:C.white, fontSize:14, lineHeight:1.8, margin:0, fontStyle:'italic' }}>"{aiText}"</p>
              </div>
            </Card>
          )}
          {scenarios.length > 0 && (
            <Card hover={false}>
              <h3 style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>Tidligere scenarioer</h3>
              {scenarios.map((s,i) => {
                const vc2 = s.verdict ? VC[s.verdict as keyof typeof VC] : null;
                return (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:C.navy, borderRadius:9, marginBottom:8, borderLeft:`3px solid ${vc2?.color||C.grayD}` }}>
                    <div>
                      <div style={{ fontSize:13, color:C.white, fontWeight:600 }}>{s.name}</div>
                      <div style={{ fontSize:11, color:C.grayD, marginTop:2 }}>{formatNOK(s.amount)}/mnd → EBIT {formatNOK(s.newEBIT||0)}</div>
                    </div>
                    <span style={{ fontSize:16 }}>{vc2?.emoji||'—'}</span>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Faste Settings ───────────────────────────────────────────────────────────
const FASTE_FIELDS_DEF = [
  { key:'husleie',           label:'Husleie',           placeholder:'15 000' },
  { key:'strøm',             label:'Strøm',             placeholder:'2 000'  },
  { key:'internett',         label:'Internett',         placeholder:'500'    },
  { key:'betalingsterminal', label:'Betalingsterminal', placeholder:'300'    },
  { key:'forsikring',        label:'Forsikring',        placeholder:'1 200'  },
];

const FasteSettings = ({ faste, onChange }: { faste: Partial<FasteKostnader>; onChange: (f: FasteKostnader) => Promise<void> }) => {
  const [form,  setForm]  = useState<Record<string,string|number>>(() => ({ andreFasteNavn:'', andreFasteBeløp:'', ...faste }));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    const clean: Record<string,unknown> = { ...form };
    FASTE_FIELDS_DEF.forEach(f => { clean[f.key] = parseFloat(String(clean[f.key]))||0; });
    clean.andreFasteBeløp = parseFloat(String(clean.andreFasteBeløp))||0;
    await onChange(clean as unknown as FasteKostnader);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  const total = FASTE_FIELDS_DEF.reduce((s,f) => s+(parseFloat(String(form[f.key]))||0), 0) + (parseFloat(String(form.andreFasteBeløp))||0);
  const IBase: React.CSSProperties = { width:'100%', background:C.navy, border:`1px solid ${C.border}`, borderRadius:8, padding:'9px 46px 9px 12px', fontSize:14, color:C.white, outline:'none' };
  return (
    <Card hover={false} style={{ marginTop:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div>
          <h3 style={{ fontSize:20, fontWeight:800 }}>Faste kostnader</h3>
          <p style={{ color:C.gray, fontSize:12, marginTop:3 }}>Settes én gang — brukes automatisk hver måned.</p>
        </div>
        {total > 0 && <div style={{ textAlign:'right' }}><div style={{ fontSize:10, color:C.grayD, textTransform:'uppercase', letterSpacing:'0.1em' }}>Totalt / mnd</div><div style={{ fontSize:20, fontWeight:800, color:'#F5A623' }}>{formatNOK(total)}</div></div>}
      </div>
      <div className="form-grid">
        {FASTE_FIELDS_DEF.map(f => (
          <div key={f.key}>
            <label style={{ display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:C.gray, marginBottom:4 }}>{f.label}</label>
            <div style={{ position:'relative' }}>
              <input type="number" min="0" value={String(form[f.key]||'')} placeholder={f.placeholder}
                onChange={e=>upd(f.key, e.target.value)}
                onFocus={e=>(e.target as HTMLInputElement).style.borderColor=C.white} onBlur={e=>(e.target as HTMLInputElement).style.borderColor=C.border}
                style={IBase}/>
              <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color:C.grayD, pointerEvents:'none' }}>kr</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:C.gray, marginBottom:6 }}>Andre faste kostnader</div>
      <div className="form-grid" style={{ marginBottom:18 }}>
        <input type="text" value={String(form.andreFasteNavn||'')} placeholder="Navn (f.eks. Alarm)"
          onChange={e=>upd('andreFasteNavn', e.target.value)}
          onFocus={e=>(e.target as HTMLInputElement).style.borderColor=C.white} onBlur={e=>(e.target as HTMLInputElement).style.borderColor=C.border}
          style={{ ...IBase, paddingRight:12 }}/>
        <div style={{ position:'relative' }}>
          <input type="number" min="0" value={String(form.andreFasteBeløp||'')} placeholder="0"
            onChange={e=>upd('andreFasteBeløp', e.target.value)}
            onFocus={e=>(e.target as HTMLInputElement).style.borderColor=C.white} onBlur={e=>(e.target as HTMLInputElement).style.borderColor=C.border}
            style={IBase}/>
          <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color:C.grayD, pointerEvents:'none' }}>kr</span>
        </div>
      </div>
      <button onClick={save} disabled={saving}
        style={{ width:'100%', padding:'11px', background:saved?C.green:C.white, color:saved?'#fff':C.navy, border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.2s' }}>
        {saved ? '✓  Lagret' : saving ? '…' : 'Lagre faste kostnader'}
      </button>
    </Card>
  );
};

// ─── Ansatte Settings ─────────────────────────────────────────────────────────
const EMPTY_ANSATT = { navn:'', lønnstype:'måned' as 'måned'|'time', månedslønn:0, timelønn:0, estimerteTimer:160, stillingsprosent:100, ansatttype:'Fast' as 'Fast'|'Deltid'|'Tilkalling' };

const AnsattKort = ({ ansatt, onDelete }: { ansatt: Ansatt; onDelete: () => void }) => {
  const kostnad = ansattMndKostnad(ansatt);
  const brutto  = ansatt.lønnstype === 'time'
    ? (ansatt.timelønn||0) * (ansatt.estimerteTimer||160) * (ansatt.stillingsprosent||100) / 100
    : (ansatt.månedslønn||0) * (ansatt.stillingsprosent||100) / 100;
  const avg   = brutto * 0.141;
  const ferie = brutto * 0.102;
  const typeColor = ansatt.ansatttype==='Tilkalling' ? C.gray : ansatt.ansatttype==='Deltid' ? '#F5A623' : C.green;
  return (
    <div style={{ background:C.navy, border:`1px solid ${C.border}`, borderRadius:12, padding:'14px 16px', marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:C.white, marginBottom:3 }}>
            {ansatt.navn || 'Ansatt (uten navn)'}
            <span style={{ marginLeft:8, fontSize:10, color:typeColor, background:`${typeColor}18`, border:`1px solid ${typeColor}30`, borderRadius:10, padding:'2px 8px', fontWeight:500 }}>{ansatt.ansatttype} · {ansatt.stillingsprosent}%</span>
          </div>
          <div style={{ fontSize:13, color:C.gray }}>
            {ansatt.lønnstype==='time' ? `${formatNOK(ansatt.timelønn)}/t × ${ansatt.estimerteTimer} t` : `${formatNOK(ansatt.månedslønn)}/mnd brutto`}
          </div>
        </div>
        <button onClick={onDelete} style={{ background:'transparent', border:'none', color:C.grayD, cursor:'pointer', fontSize:16, padding:'0 4px', lineHeight:'1' }}
          onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.color=C.red} onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.color=C.grayD}>×</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:12 }}>
        {[{ l:'Bruttolønn', v:formatNOK(brutto) },{ l:'Arbeidsgiveravgift', v:formatNOK(avg) },{ l:'Feriepenger (÷12)', v:formatNOK(ferie/12) }].map(({l,v}) => (
          <div key={l} style={{ background:C.navyM, borderRadius:8, padding:'8px 10px' }}>
            <div style={{ fontSize:9, color:C.grayD, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>{l}</div>
            <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:10, padding:'10px 14px', background:C.navyM, borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:12, color:C.gray }}>{formatNOK(brutto)} lønn →</span>
        <span style={{ fontSize:15, fontWeight:800, color:C.green }}>koster deg {formatNOK(kostnad)}/mnd</span>
      </div>
    </div>
  );
};

interface AnsatteSettingsProps {
  ansatte: Ansatt[];
  onAdd: (a: Omit<Ansatt,'id'>) => Promise<Ansatt>;
  onDelete: (id: string) => Promise<void>;
}
const AnsatteSettings = ({ ansatte, onAdd, onDelete }: AnsatteSettingsProps) => {
  const [form,     setForm]     = useState<typeof EMPTY_ANSATT & Record<string,unknown>>({ ...EMPTY_ANSATT });
  const [showForm, setShowForm] = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [saving,   setSaving]   = useState(false);
  const upd = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const addAnsatt = async () => {
    setSaving(true);
    await onAdd({ ...form, lønnstype: form.lønnstype as 'måned'|'time', ansatttype: form.ansatttype as 'Fast'|'Deltid'|'Tilkalling' });
    setSaving(false); setForm({ ...EMPTY_ANSATT }); setShowForm(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const totalKostnad = ansatteTotalKostnad(ansatte);
  const IBase: React.CSSProperties = { width:'100%', background:C.navyM, border:`1px solid ${C.border}`, borderRadius:8, padding:'9px 12px', fontSize:13, color:C.white, outline:'none' };
  const previewKostnad = ansattMndKostnad(form as unknown as Partial<Ansatt>);
  return (
    <Card hover={false} style={{ marginTop:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div>
          <h3 style={{ fontSize:20, fontWeight:800 }}>Ansatte</h3>
          <p style={{ color:C.gray, fontSize:12, marginTop:3 }}>Beregn reell månedskostnad per ansatt inkl. avgifter.</p>
        </div>
        {ansatte.length > 0 && <div style={{ textAlign:'right' }}><div style={{ fontSize:10, color:C.grayD, textTransform:'uppercase', letterSpacing:'0.1em' }}>{ansatte.length} ansatte · total</div><div style={{ fontSize:20, fontWeight:800, color:C.green }}>{formatNOK(totalKostnad)}/mnd</div></div>}
      </div>
      {ansatte.map(a => <AnsattKort key={a.id} ansatt={a} onDelete={()=>onDelete(a.id)}/>)}
      {ansatte.length === 0 && !showForm && <div style={{ textAlign:'center', padding:'28px 0', color:C.grayD, fontSize:13 }}>Ingen ansatte registrert ennå.</div>}
      {!showForm ? (
        <button onClick={()=>setShowForm(true)}
          style={{ width:'100%', padding:'10px', background:'transparent', border:`1px dashed ${C.border}`, borderRadius:8, color:C.gray, fontSize:13, cursor:'pointer', transition:'all 0.15s' }}
          onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.white;(e.currentTarget as HTMLButtonElement).style.color=C.white;}}
          onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.border;(e.currentTarget as HTMLButtonElement).style.color=C.gray;}}>
          {saved ? '✓ Lagt til' : '+ Legg til ansatt'}
        </button>
      ) : (
        <div style={{ background:C.navyM, borderRadius:12, padding:'18px', border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:15, fontWeight:800, marginBottom:16 }}>Ny ansatt</div>
          <div className="form-grid">
            <div>
              <label style={{ display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:C.gray, marginBottom:4 }}>Navn (valgfritt)</label>
              <input type="text" value={String(form.navn)} onChange={e=>upd('navn',e.target.value)} placeholder="F.eks. Per Olsen"
                onFocus={e=>(e.target as HTMLInputElement).style.borderColor=C.white} onBlur={e=>(e.target as HTMLInputElement).style.borderColor=C.border} style={IBase}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:C.gray, marginBottom:4 }}>Ansatttype</label>
              <select value={String(form.ansatttype)} onChange={e=>upd('ansatttype',e.target.value)}
                onFocus={e=>(e.target as HTMLSelectElement).style.borderColor=C.white} onBlur={e=>(e.target as HTMLSelectElement).style.borderColor=C.border}
                style={{ ...IBase, cursor:'pointer', appearance:'none' as unknown as undefined }}>
                <option>Fast</option><option>Deltid</option><option>Tilkalling</option>
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div>
              <label style={{ display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:C.gray, marginBottom:4 }}>Lønnstype</label>
              <select value={String(form.lønnstype)} onChange={e=>upd('lønnstype',e.target.value)}
                style={{ ...IBase, cursor:'pointer', appearance:'none' as unknown as undefined }}>
                <option value="måned">Månedslønn</option><option value="time">Timelønn</option>
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:C.gray, marginBottom:4 }}>Stillingsprosent</label>
              <div style={{ position:'relative' }}>
                <input type="number" min="1" max="100" value={Number(form.stillingsprosent)} onChange={e=>upd('stillingsprosent',parseFloat(e.target.value)||100)}
                  style={{ ...IBase, paddingRight:30 }}/>
                <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color:C.grayD, pointerEvents:'none' }}>%</span>
              </div>
            </div>
          </div>
          {form.lønnstype === 'måned' ? (
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:C.gray, marginBottom:4 }}>Månedslønn (brutto)</label>
              <div style={{ position:'relative' }}>
                <input type="number" min="0" value={Number(form.månedslønn)||''} onChange={e=>upd('månedslønn',parseFloat(e.target.value)||0)} placeholder="35 000"
                  style={{ ...IBase, paddingRight:30 }}/>
                <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color:C.grayD, pointerEvents:'none' }}>kr</span>
              </div>
            </div>
          ) : (
            <div className="form-grid">
              <div>
                <label style={{ display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:C.gray, marginBottom:4 }}>Timelønn</label>
                <div style={{ position:'relative' }}>
                  <input type="number" min="0" value={Number(form.timelønn)||''} onChange={e=>upd('timelønn',parseFloat(e.target.value)||0)} placeholder="220"
                    style={{ ...IBase, paddingRight:40 }}/>
                  <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color:C.grayD, pointerEvents:'none' }}>kr/t</span>
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:C.gray, marginBottom:4 }}>Est. timer/mnd</label>
                <input type="number" min="0" value={Number(form.estimerteTimer)} onChange={e=>upd('estimerteTimer',parseFloat(e.target.value)||160)} style={IBase}/>
              </div>
            </div>
          )}
          {previewKostnad > 0 && (
            <div style={{ padding:'10px 14px', background:C.navy, borderRadius:8, marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, color:C.gray }}>Estimert månedskostnad:</span>
              <span style={{ fontSize:16, fontWeight:800, color:C.green }}>{formatNOK(previewKostnad)}/mnd</span>
            </div>
          )}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={addAnsatt} disabled={saving || !(Number(form.månedslønn)||Number(form.timelønn))}
              style={{ flex:1, padding:'10px', background:(Number(form.månedslønn)||Number(form.timelønn))&&!saving?C.white:C.grayD, color:C.navy, border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:(Number(form.månedslønn)||Number(form.timelønn))?'pointer':'not-allowed' }}>
              {saving ? '…' : 'Legg til'}
            </button>
            <button onClick={()=>{ setShowForm(false); setForm({ ...EMPTY_ANSATT }); }}
              style={{ flex:1, padding:'10px', background:'transparent', color:C.gray, border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>
              Avbryt
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

// ─── Onboarding ───────────────────────────────────────────────────────────────
interface OnboardingProps { onComplete: (p: Profil) => Promise<void>; }
const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [step, setStep] = useState(1);
  const [profil, setProfil] = useState({ bedriftsnavn:'', eierNavn:'', bedriftstype:'', bedriftstypeAnnet:'', selskapsform:'' as 'AS'|'ENK'|'', antallAnsatte:'' });
  const [focus, setFocusState] = useState<Record<string,boolean>>({});
  const [completing, setCompleting] = useState(false);
  const upd = (k: string, v: unknown) => setProfil(p => ({ ...p, [k]: v }));
  const sf = (k: string, v: boolean) => setFocusState(p => ({ ...p, [k]: v }));
  const InputStyle = (f: boolean): React.CSSProperties => ({ width:'100%', background:C.navyM, border:`1px solid ${f?C.white:C.border}`, borderRadius:8, padding:'12px 14px', fontSize:15, color:C.white, outline:'none', transition:'border-color 0.15s', marginBottom:14, boxSizing:'border-box' });
  const BtnPrimary = (disabled: boolean): React.CSSProperties => ({ padding:'13px 28px', background:disabled?C.grayD:C.white, color:C.navy, border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:disabled?'not-allowed':'pointer', transition:'all 0.2s' });
  const BtnGhost: React.CSSProperties = { padding:'13px 20px', background:'transparent', color:C.gray, border:`1px solid ${C.border}`, borderRadius:10, fontSize:14, fontWeight:500, cursor:'pointer', transition:'all 0.2s' };
  const btypeLabel = BEDRIFTSTYPER.find(b=>b.id===profil.bedriftstype)?.label || '';
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', background:C.navy, position:'relative' }}>
      <div style={{ position:'fixed', top:0, left:0, right:0, height:3, background:C.navyB, zIndex:100 }}>
        <div style={{ height:'100%', background:C.amber, width:`${(step/6)*100}%`, transition:'width 0.4s ease' }}/>
      </div>
      <div style={{ position:'fixed', top:16, right:24, fontSize:10, color:C.gray, letterSpacing:'0.14em', textTransform:'uppercase' }}>Steg {step} av 6</div>
      <div key={step} className="fade-in" style={{ maxWidth:480, width:'100%', padding:32 }}>
        {step === 1 && (
          <div style={{ textAlign:'center' }}>
            <div style={{ width:56, height:56, background:C.amber, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:700, color:C.navy, margin:'0 auto 24px' }}>F</div>
            <h1 style={{ fontSize:40, fontWeight:800, color:C.white, marginBottom:12 }}>FinanceIQ</h1>
            <p style={{ color:C.gray, fontSize:16, marginBottom:40, lineHeight:1.6 }}>Økonomisk oversikt, tilpasset din bedrift</p>
            <button onClick={()=>setStep(2)} style={{ ...BtnPrimary(false), fontSize:16, padding:'15px 40px' }}>Kom i gang →</button>
          </div>
        )}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize:26, fontWeight:800, color:C.white, marginBottom:28 }}>Fortell oss om bedriften din</h2>
            <label style={{ display:'block', fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color:C.gray, marginBottom:6 }}>Bedriftsnavn</label>
            <input type="text" value={profil.bedriftsnavn} onChange={e=>upd('bedriftsnavn',e.target.value)} placeholder="F.eks. Kafé Solberg AS"
              onFocus={()=>sf('bedriftsnavn',true)} onBlur={()=>sf('bedriftsnavn',false)} style={InputStyle(focus.bedriftsnavn||false)}/>
            <label style={{ display:'block', fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color:C.gray, marginBottom:6 }}>Ditt navn</label>
            <input type="text" value={profil.eierNavn} onChange={e=>upd('eierNavn',e.target.value)} placeholder="F.eks. Kari Nordmann"
              onFocus={()=>sf('eierNavn',true)} onBlur={()=>sf('eierNavn',false)} style={InputStyle(focus.eierNavn||false)}/>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
              <button onClick={()=>setStep(1)} style={BtnGhost}>← Tilbake</button>
              <button onClick={()=>setStep(3)} disabled={!profil.bedriftsnavn.trim()} style={BtnPrimary(!profil.bedriftsnavn.trim())}>Fortsett →</button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize:26, fontWeight:800, color:C.white, marginBottom:24 }}>Hva slags bedrift driver du?</h2>
            <div className="btype-grid">
              {BEDRIFTSTYPER.map(b => (
                <div key={b.id} onClick={()=>upd('bedriftstype',b.id)} style={{ padding:'16px 12px', background:profil.bedriftstype===b.id?C.navyM:C.navyL, border:profil.bedriftstype===b.id?`2px solid ${C.white}`:`1px solid ${C.border}`, borderRadius:12, cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>{b.icon}</div>
                  <div style={{ fontSize:12, color:C.white, lineHeight:1.3 }}>{b.label}</div>
                </div>
              ))}
            </div>
            {profil.bedriftstype === 'annet' && (
              <input type="text" value={profil.bedriftstypeAnnet} onChange={e=>upd('bedriftstypeAnnet',e.target.value)} placeholder="Beskriv bedriftstype"
                onFocus={()=>sf('btypeAnnet',true)} onBlur={()=>sf('btypeAnnet',false)} style={{ ...InputStyle(focus.btypeAnnet||false), marginBottom:16 }}/>
            )}
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <button onClick={()=>setStep(2)} style={BtnGhost}>← Tilbake</button>
              <button onClick={()=>setStep(4)} disabled={!profil.bedriftstype} style={BtnPrimary(!profil.bedriftstype)}>Fortsett →</button>
            </div>
          </div>
        )}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize:26, fontWeight:800, color:C.white, marginBottom:24 }}>Hvilken selskapsform har du?</h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
              {[{ id:'AS', label:'AS', sub:'Aksjeselskap — begrenset ansvar' },{ id:'ENK', label:'ENK', sub:'Enkeltpersonforetak — du er ansvarlig' }].map(sf2 => (
                <div key={sf2.id} onClick={()=>{ upd('selskapsform',sf2.id); setStep(5); }} style={{ padding:'28px 20px', background:profil.selskapsform===sf2.id?C.navyM:C.navyL, border:profil.selskapsform===sf2.id?`2px solid ${C.white}`:`1px solid ${C.border}`, borderRadius:14, cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}>
                  <div style={{ fontSize:24, fontWeight:700, color:C.white, marginBottom:8 }}>{sf2.label}</div>
                  <div style={{ fontSize:12, color:C.gray, lineHeight:1.4 }}>{sf2.sub}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>setStep(3)} style={BtnGhost}>← Tilbake</button>
          </div>
        )}
        {step === 5 && (
          <div>
            <h2 style={{ fontSize:26, fontWeight:800, color:C.white, marginBottom:24 }}>Hvor mange jobber i bedriften?</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              {['Bare meg selv','1–3 ansatte','4–10 ansatte','10+ ansatte'].map(opt => (
                <div key={opt} onClick={()=>{ upd('antallAnsatte',opt); setStep(6); }} style={{ padding:'14px 16px', borderRadius:10, border:profil.antallAnsatte===opt?`2px solid ${C.white}`:`1px solid ${C.border}`, background:profil.antallAnsatte===opt?C.navyM:C.navyL, cursor:'pointer', transition:'all 0.15s', fontSize:15, color:C.white }}>
                  {opt}
                </div>
              ))}
            </div>
            <button onClick={()=>setStep(4)} style={BtnGhost}>← Tilbake</button>
          </div>
        )}
        {step === 6 && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:20 }}>✅</div>
            <h2 style={{ fontSize:30, fontWeight:800, color:C.white, marginBottom:12 }}>Velkommen, {profil.eierNavn||profil.bedriftsnavn}!</h2>
            <p style={{ color:C.gray, fontSize:15, marginBottom:40, lineHeight:1.6 }}>Din {btypeLabel}-profil er klar og klar til bruk.</p>
            <button disabled={completing} onClick={async()=>{ setCompleting(true); await onComplete({ bedriftsnavn:profil.bedriftsnavn, eierNavn:profil.eierNavn, bedriftstype:profil.bedriftstype, selskapsform:profil.selskapsform as 'AS'|'ENK', antallAnsatte:profil.antallAnsatte, opprettet:new Date().toISOString() }); }}
              style={{ ...BtnPrimary(completing), fontSize:16, padding:'15px 40px' }}>
              {completing ? '…' : 'Åpne FinanceIQ →'}
            </button>
            <div style={{ marginTop:20 }}><button onClick={()=>setStep(5)} style={BtnGhost}>← Tilbake</button></div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Profil Kort ──────────────────────────────────────────────────────────────
const ProfilKort = ({ profil, onEdit, onResetAll }: { profil: Profil; onEdit:()=>void; onResetAll:()=>Promise<void> }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const btype = BEDRIFTSTYPER.find(b=>b.id===profil?.bedriftstype);
  return (
    <Card hover={false}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div style={{ fontSize:20, fontWeight:800, color:C.white }}>{profil?.bedriftsnavn||'—'}</div>
        {profil?.selskapsform && <span style={{ padding:'3px 10px', background:`${C.amber}18`, border:`1px solid ${C.amber}35`, borderRadius:20, fontSize:11, color:C.amber, fontWeight:500 }}>{profil.selskapsform}</span>}
      </div>
      {profil?.eierNavn && <div style={{ color:C.gray, fontSize:13, marginBottom:12 }}>{profil.eierNavn}</div>}
      <div style={{ display:'flex', gap:16, marginBottom:20, flexWrap:'wrap' }}>
        {btype && <span style={{ fontSize:13, color:C.white }}><span style={{ marginRight:5 }}>{btype.icon}</span>{btype.label}</span>}
        {profil?.antallAnsatte && <span style={{ fontSize:13, color:C.gray }}>{profil.antallAnsatte}</span>}
      </div>
      {!confirmReset ? (
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onEdit} style={{ padding:'9px 18px', background:'transparent', color:C.gray, border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer' }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.white;(e.currentTarget as HTMLButtonElement).style.color=C.white;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.border;(e.currentTarget as HTMLButtonElement).style.color=C.gray;}}>
            Rediger profil
          </button>
          <button onClick={()=>setConfirmReset(true)} style={{ padding:'9px 18px', background:'transparent', color:C.red, border:`1px solid ${C.red}40`, borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer' }}>
            Nullstill all data
          </button>
        </div>
      ) : (
        <div style={{ padding:'14px 16px', background:`${C.red}10`, border:`1px solid ${C.red}35`, borderRadius:10 }}>
          <div style={{ fontSize:13, color:C.red, marginBottom:12, fontWeight:600 }}>Er du sikker? Dette sletter ALL data.</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={async()=>{ setResetting(true); await onResetAll(); }}
              disabled={resetting} style={{ flex:1, padding:'9px', background:C.red, border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              {resetting ? '…' : 'Ja, nullstill'}
            </button>
            <button onClick={()=>setConfirmReset(false)}
              style={{ flex:1, padding:'9px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:7, color:C.gray, fontSize:12, cursor:'pointer' }}>
              Avbryt
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

// ─── BankSettings ─────────────────────────────────────────────────────────────
type BankConn = { bank_name: string | null; last_synced: string | null };

const BankSettings = () => {
  const supabase = createClient();
  const [conn,    setConn]    = useState<BankConn | null | undefined>(undefined); // undefined = loading
  const [syncing, setSyncing] = useState(false);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // Load connection + handle ?tink= redirect param
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setConn(null); return; }
      const { data } = await supabase
        .from('user_bank_connections')
        .select('bank_name, last_synced')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      setConn(data ?? null);

      // Handle redirect from Tink callback
      const params = new URLSearchParams(window.location.search);
      const tinkParam = params.get('tink');
      if (tinkParam === 'success') {
        showToast('Bank tilkoblet!', true);
        window.history.replaceState({}, '', window.location.pathname);
        // Re-fetch after success
        const { data: fresh } = await supabase
          .from('user_bank_connections')
          .select('bank_name, last_synced')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        setConn(fresh ?? null);
      } else if (tinkParam === 'error') {
        showToast('Tilkobling feilet. Prøv igjen.', false);
        window.history.replaceState({}, '', window.location.pathname);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    const res = await fetch('/api/tink/create-link', { method: 'POST' });
    if (!res.ok) { showToast('Kunne ikke starte tilkobling', false); return; }
    const { url } = await res.json() as { url: string };
    window.location.href = url;
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/tink/sync', { method: 'POST' });
      const data = await res.json() as { matched?: number; total?: number; error?: string };
      if (!res.ok) { showToast(data.error ?? 'Synkronisering feilet', false); return; }
      showToast(
        data.matched === 0
          ? `Ingen nye treff blant ${data.total} fakturaer`
          : `${data.matched} faktura${data.matched === 1 ? '' : 'er'} automatisk markert som betalt!`,
        true,
      );
      // Refresh last_synced
      setConn(c => c ? { ...c, last_synced: new Date().toISOString() } : c);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    const res = await fetch('/api/tink/disconnect', { method: 'DELETE' });
    setDisconnecting(false);
    if (res.ok) { setConn(null); showToast('Bank frakoblet', true); }
    else showToast('Kunne ikke koble fra', false);
  };

  const timeSince = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 1)  return 'akkurat nå';
    if (mins < 60) return `${mins} min siden`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs} t siden`;
    return `${Math.floor(hrs / 24)} d siden`;
  };

  return (
    <Card hover={false} style={{ marginTop:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ fontSize:18 }}>Bankintegrasjon</h3>
        <span style={{ fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color:C.green, background:`${C.green}18`, padding:'3px 8px', borderRadius:5, fontWeight:700 }}>Tink</span>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ marginBottom:12, padding:'10px 14px', borderRadius:8, fontSize:12, fontWeight:600,
          background: toast.ok ? `${C.green}18` : `${C.red}18`,
          color:      toast.ok ? C.green        : C.red,
          border:     `1px solid ${toast.ok ? C.green : C.red}35`,
        }}>
          {toast.msg}
        </div>
      )}

      {conn === undefined ? (
        /* Loading skeleton */
        <div style={{ height:40, borderRadius:8, background:`linear-gradient(90deg,${C.navyM} 25%,${C.navyB} 50%,${C.navyM} 75%)`, backgroundSize:'200% 100%', animation:'skeleton-shimmer 1.5s infinite' }}/>
      ) : conn === null ? (
        /* Not connected */
        <div>
          <p style={{ fontSize:13, color:C.gray, marginBottom:16, lineHeight:1.65 }}>
            Koble til banken din for å synkronisere betalinger automatisk.
            Fakturaer som matches mot banktransaksjoner markeres som betalt uten manuelt arbeid.
          </p>
          <button onClick={handleConnect}
            style={{ padding:'11px 22px', background:C.green, color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:8, transition:'opacity 0.15s' }}
            onMouseEnter={e=>(e.currentTarget.style.opacity='0.85')}
            onMouseLeave={e=>(e.currentTarget.style.opacity='1')}>
            🏦 Koble til bank
          </button>
          <p style={{ fontSize:11, color:C.grayD, marginTop:10 }}>
            Powered by Tink · Les-tilgang kun · Ingen skrivetilgang til konto
          </p>
        </div>
      ) : (
        /* Connected */
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, padding:'12px 14px', background:`${C.green}10`, border:`1px solid ${C.green}30`, borderRadius:10 }}>
            <span style={{ fontSize:20 }}>✅</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{conn.bank_name ?? 'Bank'}</div>
              <div style={{ fontSize:11, color:C.gray, marginTop:2 }}>
                {conn.last_synced
                  ? `Sist synkronisert: ${timeSince(conn.last_synced)}`
                  : 'Aldri synkronisert'}
              </div>
            </div>
          </div>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={handleSync} disabled={syncing}
              style={{ padding:'9px 20px', background:syncing?C.navyB:C.white, color:C.navy, border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:syncing?'not-allowed':'pointer', display:'inline-flex', alignItems:'center', gap:6, transition:'all 0.15s' }}>
              {syncing && <span style={{ width:10, height:10, borderRadius:'50%', border:`2px solid ${C.navy}`, borderTopColor:'transparent', animation:'spin 0.7s linear infinite', display:'inline-block' }}/>}
              {syncing ? 'Synkroniserer…' : '↺ Synkroniser nå'}
            </button>
            <button onClick={handleDisconnect} disabled={disconnecting}
              style={{ padding:'9px 18px', background:'transparent', color:disconnecting?C.grayD:C.red, border:`1px solid ${disconnecting?C.border:C.red}40`, borderRadius:8, fontSize:12, fontWeight:500, cursor:disconnecting?'not-allowed':'pointer', transition:'all 0.15s' }}>
              {disconnecting ? '…' : 'Koble fra'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

// ─── Settings ─────────────────────────────────────────────────────────────────
interface SettingsProps {
  faste: Partial<FasteKostnader>; onFasteChange: (f:FasteKostnader)=>Promise<void>;
  ansatte: Ansatt[]; onAddAnsatt: (a:Omit<Ansatt,'id'>)=>Promise<Ansatt>; onDeleteAnsatt: (id:string)=>Promise<void>;
  profil: Profil|null; onEditProfil: ()=>void; onResetAll: ()=>Promise<void>;
}
const Settings = ({ faste, onFasteChange, ansatte, onAddAnsatt, onDeleteAnsatt, profil, onEditProfil, onResetAll }: SettingsProps) => {
  return (
    <div className="fade-in" style={{ maxWidth:620 }}>
      {profil && <ProfilKort profil={profil} onEdit={onEditProfil} onResetAll={onResetAll}/>}
      <div style={{ height:profil?16:0 }}/>
      <FasteSettings faste={faste} onChange={onFasteChange}/>
      {profil?.antallAnsatte !== 'Bare meg selv' && <AnsatteSettings ansatte={ansatte} onAdd={onAddAnsatt} onDelete={onDeleteAnsatt}/>}
      <BankSettings />
      <Card hover={false} style={{ marginTop:16 }}>
        <h3 style={{ fontSize:18, marginBottom:12 }}>Om FinanceIQ</h3>
        <div style={{ color:C.gray, fontSize:13, lineHeight:1.8 }}>
          <p style={{ marginBottom:8 }}>FinanceIQ er et enkelt regnskapsverktøy for norske småbedrifter.</p>
          <ul style={{ paddingLeft:20, color:C.grayD }}>
            <li>Data lagres i Supabase per bruker</li>
            <li>AI-analyse via Anthropic Claude (claude-sonnet-4-20250514)</li>
            <li>Valuta: NOK</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id:'dashboard',  label:'Oversikt'         },
  { id:'months',     label:'Måneder'          },
  { id:'entry',      label:'Datainntasting'   },
  { id:'ai',         label:'AI-analyse'       },
  { id:'likviditet', label:'Likviditet'       },
  { id:'kalkulator', label:'Tåler jeg dette?' },
  { id:'history',    label:'Historikk'        },
  { id:'settings',   label:'Innstillinger'    },
];

// ─── APP SHELL ────────────────────────────────────────────────────────────────
interface AppShellProps {
  user: User;
  currentMonth: string;
  initialProfil: Record<string,unknown> | null;
  initialMaaneder: Record<string,unknown>[];
  initialFaste: Record<string,unknown> | null;
  initialAnsatte: Record<string,unknown>[];
}

export default function AppShell({ user, currentMonth, initialProfil, initialMaaneder, initialFaste, initialAnsatte }: AppShellProps) {
  const supabase = createClient();
  const [tab,            setTab]            = useState('dashboard');
  const [month,          setMonth]          = useState(currentMonth);
  const [allData,        setAllData]        = useState<MonthData[]>(() => initialMaaneder.map(mapDbMonth));
  const [faste,          setFaste]          = useState<Partial<FasteKostnader>>(() => initialFaste ? mapDbFaste(initialFaste) : {});
  const [ansatte,        setAnsatte]        = useState<Ansatt[]>(() => initialAnsatte.map(mapDbAnsatt));
  const [profil,         setProfil]         = useState<Profil|null>(() => initialProfil ? mapDbProfil(initialProfil) : null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tourAutoStart,  setTourAutoStart]  = useState(false);

  // Trigger auto-start once the component mounts (needs to run client-side)
  useEffect(() => { setTourAutoStart(true); }, []);

  const saved = allData.map(d => d.month);
  const currentData = allData.find(d => d.month === month) || null;

  const dashboardWarnings = (() => {
    if (!currentData) return [];
    const sorted = [...allData].sort((a,b)=>a.month.localeCompare(b.month));
    const fasteSum = getFasteSum(faste||{});
    const currDr = calcDerived(currentData, fasteSum);
    const cidx = sorted.findIndex(d=>d.month===month);
    const prev = cidx > 0 ? sorted[cidx-1] : null;
    const prevDr = prev ? calcDerived(prev, fasteSum) : null;
    return computeWarnings(currentData, currDr, prev, prevDr, profil?.bedriftstype || '');
  })();

  // ── Supabase operations ───
  const handleSaveMonth = useCallback(async (m: string, data: Record<string,number>) => {
    const { error } = await supabase.from('maaneder').upsert({
      user_id: user.id, month: m,
      inntekter: data.inntekter||0, varekostnader: data.varekostnader||0,
      lonnskostnader: data['lønnskostnader']||0, andre_kostnader: data.andreKostnader||0,
      mva_innbetalt: data.mvaInnbetalt||0, lagret_at: new Date().toISOString(),
    }, { onConflict: 'user_id,month' });
    if (error) { console.error('saveMonth', error); return; }
    const updated: MonthData = { month:m, inntekter:data.inntekter||0, varekostnader:data.varekostnader||0, lønnskostnader:data['lønnskostnader']||0, andreKostnader:data.andreKostnader||0, mvaInnbetalt:data.mvaInnbetalt||0, savedAt:new Date().toISOString() };
    setAllData(prev => { const idx = prev.findIndex(d=>d.month===m); return idx >= 0 ? prev.map((d,i)=>i===idx?updated:d) : [...prev, updated].sort((a,b)=>a.month.localeCompare(b.month)); });
  }, [user.id]);

  const handleDeleteMonth = useCallback(async (m: string) => {
    await supabase.from('maaneder').delete().eq('user_id', user.id).eq('month', m);
    setAllData(prev => prev.filter(d => d.month !== m));
  }, [user.id]);

  const handleFasteChange = useCallback(async (f: FasteKostnader) => {
    const { error } = await supabase.from('faste_kostnader').upsert({
      user_id: user.id, husleie:f.husleie||0, strom:f.strøm||0, internett:f.internett||0,
      betalingsterminal:f.betalingsterminal||0, forsikring:f.forsikring||0,
      andre_faste_navn:f.andreFasteNavn||'', andre_faste_belop:f.andreFasteBeløp||0,
    }, { onConflict: 'user_id' });
    if (error) { console.error('saveFaste', error); return; }
    setFaste(f);
  }, [user.id]);

  const handleAddAnsatt = useCallback(async (a: Omit<Ansatt,'id'>): Promise<Ansatt> => {
    const { data, error } = await supabase.from('ansatte').insert({
      user_id: user.id, navn:a.navn, lonnstype:a.lønnstype, manedslonn:a.månedslønn,
      timelonn:a.timelønn, estimerte_timer:a.estimerteTimer, stillingsprosent:a.stillingsprosent, ansatttype:a.ansatttype,
    }).select().single();
    if (error || !data) { console.error('addAnsatt', error); throw error; }
    const newA = mapDbAnsatt(data as Record<string,unknown>);
    setAnsatte(prev => [...prev, newA]);
    return newA;
  }, [user.id]);

  const handleDeleteAnsatt = useCallback(async (id: string) => {
    await supabase.from('ansatte').delete().eq('id', id).eq('user_id', user.id);
    setAnsatte(prev => prev.filter(a => a.id !== id));
  }, [user.id]);

  const handleSaveProfil = useCallback(async (p: Profil) => {
    const { error } = await supabase.from('profiler').upsert({
      id: user.id, bedriftsnavn:p.bedriftsnavn, eier_navn:p.eierNavn, bedriftstype:p.bedriftstype,
      selskapsform:p.selskapsform, antall_ansatte:p.antallAnsatte, opprettet:p.opprettet||new Date().toISOString(),
    }, { onConflict: 'id' });
    if (error) { console.error('saveProfil', error); return; }
    setProfil(p);
  }, [user.id]);

  const handleResetAll = useCallback(async () => {
    await Promise.all([
      supabase.from('maaneder').delete().eq('user_id', user.id),
      supabase.from('faste_kostnader').delete().eq('user_id', user.id),
      supabase.from('ansatte').delete().eq('user_id', user.id),
      supabase.from('profiler').delete().eq('id', user.id),
    ]);
    setAllData([]); setFaste({}); setAnsatte([]); setProfil(null); setShowOnboarding(false);
  }, [user.id]);

  const handleOnboardingComplete = useCallback(async (p: Profil) => {
    await handleSaveProfil(p);
    setShowOnboarding(false);
    const hasFaste = Object.values(faste).some(v => Number(v) > 0);
    if (!hasFaste && p.bedriftstype && FASTE_DEFAULTS[p.bedriftstype]) {
      const defaults = FASTE_DEFAULTS[p.bedriftstype];
      if (Object.keys(defaults).length > 0) {
        await handleFasteChange({ husleie:0, strøm:0, internett:0, betalingsterminal:0, forsikring:0, andreFasteNavn:'', andreFasteBeløp:0, ...defaults });
      }
    }
  }, [faste, handleSaveProfil, handleFasteChange]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (!profil || showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete}/>;
  }

  const btypeEntry = BEDRIFTSTYPER.find(b => b.id === profil.bedriftstype);

  return (
    <div style={{ minHeight:'100vh', background:C.navy }}>
      {/* Header */}
      <header style={{ position:'sticky', top:0, zIndex:50, borderBottom:`1px solid ${C.border}`, padding:'0 32px', height:64, display:'flex', justifyContent:'space-between', alignItems:'center', background:`${C.navy}E8`, backdropFilter:'blur(14px)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:34, height:34, background:C.amber, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:C.navy }}>F</div>
          <div>
            <div style={{ fontSize:19, letterSpacing:'-0.02em', lineHeight:1.1 }}>{profil?.bedriftsnavn||'FinanceIQ'}</div>
            <div style={{ fontSize:9, color:C.grayD, letterSpacing:'0.14em', textTransform:'uppercase' }}>{btypeEntry ? `${btypeEntry.icon} ${profil.selskapsform||''}` : 'FinanceIQ'}</div>
          </div>
        </div>
        <div className="header-month">
          <MonthSelector month={month} onChange={setMonth} saved={saved}/>
        </div>
        <div className="header-right" style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ fontSize:11, color:C.grayD, textAlign:'right', lineHeight:1.6 }}>
            {saved.length > 0 ? `${saved.length} mnd. lagret` : 'Ingen data ennå'}
          </div>
          <button id="tour-help-btn"
            onClick={() => (window as Window & { __fiqStartTour?: () => void }).__fiqStartTour?.()}
            title="Vis tutorial"
            style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:`1px solid ${C.border}`, borderRadius:7, color:C.grayD, fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 0.15s', flexShrink:0 }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.amber;(e.currentTarget as HTMLButtonElement).style.color=C.amber;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.border;(e.currentTarget as HTMLButtonElement).style.color=C.grayD;}}>
            ?
          </button>
          <button onClick={handleLogout}
            style={{ padding:'7px 14px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:7, color:C.grayD, fontSize:11, cursor:'pointer', transition:'all 0.15s' }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.red;(e.currentTarget as HTMLButtonElement).style.color=C.red;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=C.border;(e.currentTarget as HTMLButtonElement).style.color=C.grayD;}}>
            Logg ut
          </button>
        </div>
      </header>

      {/* Nav */}
      <nav className="nav-tabs" style={{ borderBottom:`1px solid ${C.border}`, padding:'0 8px' }}>
        {TABS.map(t => (
          <button key={t.id} id={t.id === 'dashboard' ? 'tour-dashboard-tab' : t.id === 'ai' ? 'tour-ai-tab' : undefined} onClick={()=>setTab(t.id)} className="nav-tab-btn" style={{ padding:'13px 18px', background:'transparent', border:'none', borderBottom:tab===t.id?`2px solid ${C.amber}`:'2px solid transparent', color:tab===t.id?C.amber:C.gray, cursor:'pointer', fontSize:13, letterSpacing:'0.03em', transition:'all 0.15s', marginBottom:-1, display:'flex', alignItems:'center', gap:6 }}>
            {t.label}
            {t.id==='dashboard' && dashboardWarnings.some(w=>w.level==='red') && <span style={{ width:6, height:6, borderRadius:'50%', background:C.red, display:'inline-block', animation:'pulse-dot 2s infinite' }}/>}
            {t.id==='entry' && saved.includes(month) && <span style={{ width:5, height:5, borderRadius:'50%', background:C.amber, display:'inline-block' }}/>}
          </button>
        ))}
        <a id="tour-faktura-link" href="/app/admin/test-parsing" className="nav-tab-btn" style={{ padding:'13px 18px', background:'transparent', border:'none', borderBottom:'2px solid transparent', color:C.gray, cursor:'pointer', fontSize:13, letterSpacing:'0.03em', transition:'all 0.15s', marginBottom:-1, display:'flex', alignItems:'center', gap:6, textDecoration:'none' }}
          onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.color=C.amber;}}
          onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.color=C.gray;}}>
          Fakturaer
        </a>
      </nav>

      {/* Content */}
      <main className="main-content">
        {tab==='dashboard'  && <Dashboard    allData={allData} month={month} faste={faste} profil={profil}/>}
        {tab==='months'     && <MonthCalendar allData={allData} month={month} onNavigate={m=>{setMonth(m);setTab('entry');}}/>}
        {tab==='entry'      && <DataEntry     month={month} currentData={currentData} faste={faste} ansatte={ansatte} onSave={handleSaveMonth} onDelete={handleDeleteMonth}/>}
        {tab==='ai'         && <AIPanel       month={month} allData={allData} currentData={currentData} faste={faste} ansatte={ansatte} profil={profil}/>}
        {tab==='likviditet' && <LikviditetPanel allData={allData}/>}
        {tab==='kalkulator' && <KalkulatorPanel allData={allData} currentMonth={month}/>}
        {tab==='history'    && <HistoryTable    allData={allData}/>}
        {tab==='settings'   && <Settings
          faste={faste} onFasteChange={handleFasteChange}
          ansatte={ansatte} onAddAnsatt={handleAddAnsatt} onDeleteAnsatt={handleDeleteAnsatt}
          profil={profil} onEditProfil={()=>setShowOnboarding(true)} onResetAll={handleResetAll}
        />}
      </main>

      {/* Footer */}
      <footer style={{ borderTop:`1px solid ${C.border}`, padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, color:C.grayD }}>
        <span>FinanceIQ v1.0 — Norsk regnskapsverktøy for småbedrifter</span>
        <span id="tour-invoice-email" style={{ display:'flex', alignItems:'center', gap:6 }}>
          📧 <span style={{ fontWeight:700, color:C.grayD, letterSpacing:'0.01em' }}>fakturaer@financeiq.no</span>
        </span>
        <span>{user.email} · NOK</span>
      </footer>

      {/* Product Tour */}
      <ProductTour autoStart={tourAutoStart} />
    </div>
  );
}
