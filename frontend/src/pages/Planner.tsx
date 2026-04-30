import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, ComposedChart, ReferenceLine
} from 'recharts';

// ── Access Control ──────────────────────────────────────────────
const ALLOWED_EMAILS = (import.meta.env.VITE_PLANNER_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

export function canAccessPlanner(email?: string | null): boolean {
  if (!email || ALLOWED_EMAILS.length === 0) return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}

// ── Monte Carlo Engine ──────────────────────────────────────────
interface SimParams {
  initialUsers: number; monthlyGrowthMin: number; monthlyGrowthMax: number; growthStdDev: number;
  viralProb: number; viralBoostMin: number; viralBoostMax: number;
  churnProb: number; churnMin: number; churnMax: number;
  bookingRateMin: number; bookingRateMax: number; avgBookingValue: number; bookingValueStd: number;
  commissionMin: number; commissionMax: number;
  partTimeThreshold: number; fullTimeThreshold: number; teamThreshold: number;
  partTimeSalary: number; fullTimeSalary: number; teamSalary: number;
}

function gaussRandom() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pct(sorted: number[], p: number) {
  return sorted[Math.floor(sorted.length * p / 100)];
}

function percCalc(uS: number[][], rS: number[][], cS: number[][], pS: number[][], months: number) {
  const data = [];
  for (let m = 0; m < months; m++) {
    const u = uS.map(s => s[m]).sort((a, b) => a - b);
    const r = rS.map(s => s[m]).sort((a, b) => a - b);
    const c = cS.map(s => s[m]).sort((a, b) => a - b);
    const p = pS.map(s => s[m]).sort((a, b) => a - b);
    data.push({
      month: m,
      users_p5: pct(u, 5), users_p25: pct(u, 25), users_p50: pct(u, 50), users_p75: pct(u, 75), users_p95: pct(u, 95),
      rev_p25: pct(r, 25), rev_p50: pct(r, 50), rev_p75: pct(r, 75),
      cost_p25: pct(c, 25), cost_p50: pct(c, 50), cost_p75: pct(c, 75),
      profit_p25: pct(p, 25), profit_p50: pct(p, 50), profit_p75: pct(p, 75),
    });
  }
  return data;
}

function runMonteCarlo(params: SimParams, nSim = 1500) {
  const { initialUsers, monthlyGrowthMin, monthlyGrowthMax, growthStdDev, viralProb, viralBoostMin, viralBoostMax, churnProb, churnMin, churnMax, bookingRateMin, bookingRateMax, avgBookingValue, bookingValueStd, commissionMin, commissionMax, partTimeThreshold, fullTimeThreshold, teamThreshold, partTimeSalary, fullTimeSalary, teamSalary } = params;
  const months = 25;
  const allU: number[][] = [], allR: number[][] = [], allC: number[][] = [], allP: number[][] = [];
  for (let s = 0; s < nSim; s++) {
    const uP = [initialUsers], rP = [0], cP = [7], pP = [-7];
    let users = initialUsers;
    for (let m = 1; m < months; m++) {
      let growth = monthlyGrowthMin + Math.random() * (monthlyGrowthMax - monthlyGrowthMin) + gaussRandom() * growthStdDev;
      if (Math.random() < viralProb) growth += viralBoostMin + Math.random() * (viralBoostMax - viralBoostMin);
      if (Math.random() < churnProb) growth -= churnMin + Math.random() * (churnMax - churnMin);
      users = Math.max(users * (1 + Math.max(growth, -0.15)), users * 0.85);
      const rev = users * (bookingRateMin + Math.random() * (bookingRateMax - bookingRateMin)) * Math.max(avgBookingValue + gaussRandom() * bookingValueStd, 150) * (commissionMin + Math.random() * (commissionMax - commissionMin));
      const infra = users < 1000 ? 7 : users < 5000 ? 25 + (users / 5000) * 35 : users < 10000 ? 60 + (users / 10000) * 60 : users < 25000 ? 120 + (users / 25000) * 105 : users < 50000 ? 225 + (users / 50000) * 210 : users < 100000 ? 435 + (users / 100000) * 340 : 775 + (users / 250000) * 1100;
      const salary = users >= teamThreshold ? teamSalary : users >= fullTimeThreshold ? fullTimeSalary : users >= partTimeThreshold ? partTimeSalary : 0;
      uP.push(users); rP.push(rev); cP.push(infra + salary); pP.push(rev - infra - salary);
    }
    allU.push(uP); allR.push(rP); allC.push(cP); allP.push(pP);
  }
  return percCalc(allU, allR, allC, allP, months);
}

interface StrategyCommissions {
  profitFirst: number;
  growthFirst: number;
  growthFirstPost: number;
  hybrid: number;
  hybridPost: number;
}

function runStrategyComparison(fundingAmount: number, marketingMonthly: number, growthBoost: number, commissionDelay: number, bp: SimParams, comms: StrategyCommissions) {
  const nSim = 1200, months = 25;
  const strategies = [
    { name: "Profit-First", commission: comms.profitFirst, postComm: comms.profitFirst, mkt: 0, boost: 0, delay: 0 },
    { name: "Growth-First", commission: comms.growthFirst, postComm: comms.growthFirstPost, mkt: marketingMonthly, boost: growthBoost, delay: commissionDelay },
    { name: "Hybrid", commission: comms.hybrid, postComm: comms.hybridPost, mkt: marketingMonthly * 0.5, boost: growthBoost * 0.5, delay: Math.floor(commissionDelay * 0.75) },
  ];
  const results: Record<string, any[]> = {};
  const runway = fundingAmount / Math.max(marketingMonthly + 200, 1);
  for (const st of strategies) {
    const uS: number[][] = [], cumS: number[][] = [], rS: number[][] = [], costS: number[][] = [], profS: number[][] = [];
    for (let s = 0; s < nSim; s++) {
      const uP = [bp.initialUsers], cumP = [0], rP = [0], costP = [7], profP = [-7];
      let users = bp.initialUsers, cum = 0;
      for (let m = 1; m < months; m++) {
        const inR = m < runway, mktOn = inR && st.mkt > 0, commOn = m >= st.delay;
        const effComm = commOn ? st.postComm : st.commission;
        let growth = Math.random() * bp.monthlyGrowthMax + gaussRandom() * bp.growthStdDev;
        if (mktOn) growth += st.boost;
        if (Math.random() < bp.viralProb) growth += 0.3 + Math.random() * 0.5;
        if (Math.random() < bp.churnProb) growth -= 0.05 + Math.random() * 0.1;
        users = users * (1 + Math.max(growth, -0.15));
        const rev = users * (Math.random() * bp.bookingRateMax) * Math.max(bp.avgBookingValue + gaussRandom() * bp.bookingValueStd, 200) * effComm;
        const infra = users < 1000 ? 7 : users < 10000 ? 25 + (users / 10000) * 100 : users < 50000 ? 125 + (users / 50000) * 400 : 525 + (users / 100000) * 600;
        const sal = users < 20000 ? 0 : users < 50000 ? 4000 : 8000 + (users / 100000) * 8000;
        const mktS = mktOn ? st.mkt : 0;
        const totalCost = infra + sal + mktS;
        cum += rev - totalCost;
        uP.push(users); cumP.push(cum); rP.push(rev); costP.push(totalCost); profP.push(rev - totalCost);
      }
      uS.push(uP); cumS.push(cumP); rS.push(rP); costS.push(costP); profS.push(profP);
    }
    const data = [];
    for (let m = 0; m < months; m++) {
      const uV = uS.map(s => s[m]).sort((a, b) => a - b);
      const cV = cumS.map(s => s[m]).sort((a, b) => a - b);
      const rV = rS.map(s => s[m]).sort((a, b) => a - b);
      const costV = costS.map(s => s[m]).sort((a, b) => a - b);
      const profV = profS.map(s => s[m]).sort((a, b) => a - b);
      data.push({ month: m, users_p25: pct(uV, 25), users_p50: pct(uV, 50), users_p75: pct(uV, 75), cum_p25: pct(cV, 25), cum_p50: pct(cV, 50), cum_p75: pct(cV, 75), rev_p50: pct(rV, 50), rev_p25: pct(rV, 25), rev_p75: pct(rV, 75), cost_p50: pct(costV, 50), cost_p25: pct(costV, 25), cost_p75: pct(costV, 75), profit_p50: pct(profV, 50), profit_p25: pct(profV, 25), profit_p75: pct(profV, 75) });
    }
    results[st.name] = data;
  }
  return results;
}

function runFundingScenarios(bp: SimParams) {
  const nSim = 1000, months = 25;
  const scenarios = [
    { name: "Bootstrapped", funding: 0, monthly: 0, boost: 0, color: "#6b7280" },
    { name: "Pre-Seed ($25K)", funding: 25000, monthly: 1500, boost: 0.04, color: "#0f3460" },
    { name: "Angel ($75K)", funding: 75000, monthly: 3500, boost: 0.08, color: "#f59e0b" },
    { name: "Seed ($250K)", funding: 250000, monthly: 8000, boost: 0.15, color: "#e94560" },
  ];
  const results: Record<string, { data: any[]; color: string; funding: number; monthly: number }> = {};
  for (const sc of scenarios) {
    const runway = sc.funding / Math.max(sc.monthly + 200, 1);
    const sims: number[][] = [];
    for (let s = 0; s < nSim; s++) {
      const path = [bp.initialUsers]; let users = bp.initialUsers;
      for (let m = 1; m < months; m++) {
        let growth = Math.random() * bp.monthlyGrowthMax + gaussRandom() * bp.growthStdDev + (m < runway ? sc.boost : 0);
        if (Math.random() < bp.viralProb) growth += 0.3 + Math.random() * 0.5;
        if (Math.random() < bp.churnProb) growth -= 0.05 + Math.random() * 0.1;
        users = users * (1 + Math.max(growth, -0.15)); path.push(users);
      }
      sims.push(path);
    }
    const data = [];
    for (let m = 0; m < months; m++) { const v = sims.map(s => s[m]).sort((a, b) => a - b); data.push({ month: m, p25: pct(v, 25), p50: pct(v, 50), p75: pct(v, 75) }); }
    results[sc.name] = { data, color: sc.color, funding: sc.funding, monthly: sc.monthly };
  }
  return results;
}

// ── Helpers ─────────────────────────────────────────────────────
function getCostBreakdown(users: number) {
  const h = users <= 1000 ? 7 : users <= 10000 ? 25 : users <= 50000 ? 85 : users <= 100000 ? 250 : 600;
  const d = users <= 1000 ? 0 : users <= 10000 ? 20 : users <= 50000 ? 50 : users <= 100000 ? 200 : 500;
  const ca = users <= 5000 ? 0 : users <= 50000 ? 15 : users <= 100000 ? 45 : 120;
  const cd = users <= 1000 ? 0 : users <= 10000 ? 10 : users <= 50000 ? 35 : users <= 100000 ? 80 : 200;
  const mo = users <= 10000 ? 0 : users <= 50000 ? 25 : users <= 100000 ? 50 : 100;
  const tp = users <= 5000 ? 0 : users <= 50000 ? 50 : users <= 100000 ? 150 : 350;
  // Dev salaries at recommended thresholds
  const sal = users < 25000 ? 0 : users < 50000 ? 4000 : users < 100000 ? 8000 : users < 200000 ? 24000 : 60000;
  const infraTotal = h + d + ca + cd + mo + tp;
  return { hosting: h, database: d, cache: ca, cdn: cd, monitoring: mo, thirdParty: tp, salary: sal, total: infraTotal + sal, infraOnly: infraTotal };
}

const costBD = [100, 500, 1000, 5000, 10000, 25000, 50000, 100000, 250000].map(u => ({
  users: u, label: u >= 1000 ? `${u / 1000}K` : String(u), ...getCostBreakdown(u),
}));

const defaultParams: SimParams = {
  initialUsers: 50, monthlyGrowthMin: 0, monthlyGrowthMax: 0.25, growthStdDev: 0.08,
  viralProb: 0.03, viralBoostMin: 0.3, viralBoostMax: 0.8,
  churnProb: 0.05, churnMin: 0, churnMax: 0.15,
  bookingRateMin: 0, bookingRateMax: 0.08, avgBookingValue: 800, bookingValueStd: 200,
  commissionMin: 0, commissionMax: 0.15,
  partTimeThreshold: 25000, fullTimeThreshold: 50000, teamThreshold: 100000,
  partTimeSalary: 4000, fullTimeSalary: 8000, teamSalary: 24000,
};

const milestones = [
  { q: "Q1 2026", title: "Foundation & Launch", users: "0-500", cost: "$7-25/mo", color: "#10b981", items: ["Complete MVP", "Stripe payments", "Beta 10-20 providers", "Growth-first: 0-5% commission", "Begin angel conversations"] },
  { q: "Q2 2026", title: "Growth & Optimisation", users: "500-2K", cost: "$25-60 + mkt", color: "#0f3460", items: ["Redis caching (40x speed)", "Deploy marketing ($1-3K/mo)", "Referral program", "Real-time messaging", "Content & SEO"] },
  { q: "Q3 2026", title: "Market Expansion", users: "2K-8K", cost: "$60-150 + mkt", color: "#8b5cf6", items: ["Expand categories", "Advanced search", "Scale referrals", "PWA / React Native", "Evaluate commission increase"] },
  { q: "Q4 2026", title: "Monetisation Ramp", users: "8K-20K", cost: "$150-300", color: "#f59e0b", items: ["Full commission (10-15%)", "Promoted listings", "Read replica", "Admin dashboard", "Evaluate first hire"] },
  { q: "H1 2027", title: "Maturation", users: "20K-50K", cost: "$300-800 + dev", color: "#e94560", items: ["Part-time dev ($3-5K)", "Elasticsearch", "API versioning", "Mobile apps", "Seed metrics"] },
  { q: "H2 2027", title: "Enterprise", users: "50K-100K+", cost: "$800-2K + FTE", color: "#1a1a2e", items: ["Full-time dev ($7-10K)", "Cloud migration eval", "ML recommendations", "Corp portal", "Series A prep"] },
];

const fmt = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : Math.round(n).toLocaleString();
const fmtD = (n: number) => `$${n >= 1000 ? `${(n / 1000).toFixed(1)}K` : Math.round(n).toLocaleString()}`;

// ── Sub-components ──────────────────────────────────────────────
function Sl({ label, value, onChange, min, max, step, format = "number" }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; format?: string;
}) {
  const d = format === "percent" ? `${(value * 100).toFixed(1)}%` : format === "dollar" ? `$${value.toLocaleString()}` : format === "users" ? fmt(value) : String(value);
  const p = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{label}</label>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", fontFamily: "monospace" }}>{d}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", height: 4, appearance: "none", background: `linear-gradient(to right,#e94560 0%,#e94560 ${p}%,#e5e7eb ${p}%,#e5e7eb 100%)`, borderRadius: 4, outline: "none", cursor: "pointer" }} />
    </div>
  );
}

function TabBtn({ active, onClick, children, icon }: { active: boolean; onClick: () => void; children: React.ReactNode; icon: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 14px", border: "none", borderBottom: active ? "3px solid #e94560" : "3px solid transparent",
      background: active ? "rgba(233,69,96,0.06)" : "transparent", cursor: "pointer",
      fontWeight: active ? 700 : 500, color: active ? "#e94560" : "#6b7280",
      fontSize: 12, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" as const,
    }}><span style={{ fontSize: 15 }}>{icon}</span>{children}</button>
  );
}

function CC({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #f0f0f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <h3 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>{title}</h3>
      {subtitle && <p style={{ margin: "0 0 12px", fontSize: 11, color: "#9ca3af" }}>{subtitle}</p>}
      {children}
    </div>
  );
}

function SL({ color, children }: { color: string; children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 8, marginTop: 12, paddingBottom: 4, borderBottom: "1px solid #f3f4f6" }}>{children}</div>;
}

// ── Main Component ──────────────────────────────────────────────
export default function Planner() {
  const { user } = useAuth();

  // Access guard
  if (!canAccessPlanner(user?.email)) {
    return <Navigate to="/" replace />;
  }

  const [tab, setTab] = useState("simulation");
  const [params, setParams] = useState<SimParams>(defaultParams);
  const [simData, setSimData] = useState<any[] | null>(null);
  const [running, setRunning] = useState(false);
  const [stratData, setStratData] = useState<Record<string, any[]> | null>(null);
  const [fundData, setFundData] = useState<Record<string, any> | null>(null);
  const [fundingAmount, setFundingAmount] = useState(75000);
  const [marketingMonthly, setMarketingMonthly] = useState(3500);
  const [growthBoost, setGrowthBoost] = useState(0.08);
  const [commissionDelay, setCommissionDelay] = useState(12);

  // Independent commission rates per strategy
  const [profitCommission, setProfitCommission] = useState(0.12);
  const [growthCommission, setGrowthCommission] = useState(0);
  const [growthPostCommission, setGrowthPostCommission] = useState(0.12);
  const [hybridCommission, setHybridCommission] = useState(0.05);
  const [hybridPostCommission, setHybridPostCommission] = useState(0.12);

  // Detail chart strategy selector
  const [detailStrategy, setDetailStrategy] = useState<string>("Profit-First");

  const up = useCallback((k: keyof SimParams, v: number) => setParams(p => ({ ...p, [k]: v })), []);

  const runSim = useCallback(() => {
    setRunning(true);
    setTimeout(() => { setSimData(runMonteCarlo(params, 1500)); setRunning(false); }, 50);
  }, [params]);

  const comms: StrategyCommissions = useMemo(() => ({
    profitFirst: profitCommission,
    growthFirst: growthCommission,
    growthFirstPost: growthPostCommission,
    hybrid: hybridCommission,
    hybridPost: hybridPostCommission,
  }), [profitCommission, growthCommission, growthPostCommission, hybridCommission, hybridPostCommission]);

  const runStrat = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      setStratData(runStrategyComparison(fundingAmount, marketingMonthly, growthBoost, commissionDelay, params, comms));
      setFundData(runFundingScenarios(params));
      setRunning(false);
    }, 50);
  }, [fundingAmount, marketingMonthly, growthBoost, commissionDelay, params, comms]);

  useEffect(() => { runSim(); }, []);
  useEffect(() => { if (tab === "strategy") runStrat(); }, [tab]);

  const breakeven = useMemo(() => {
    if (!simData) return null;
    for (let i = 0; i < simData.length; i++) { if (simData[i].rev_p50 > simData[i].cost_p50) return i; }
    return null;
  }, [simData]);

  const m24 = simData ? simData[simData.length - 1] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)", padding: "28px 24px 24px", borderBottom: "4px solid #e94560" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ color: "white", margin: 0, fontSize: 24, fontWeight: 700 }}>
                CaterEase <span style={{ color: "#e94560" }}>|</span> <span style={{ fontWeight: 400, fontSize: 18, opacity: 0.8 }}>Fetes</span>
              </h1>
              <p style={{ color: "rgba(255,255,255,0.5)", margin: "4px 0 0", fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                Technical Whitepaper — Interactive Planning Tool v2
              </p>
            </div>
            {m24 && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  { l: "24-Mo Users", v: fmt(m24.users_p50), c: "#e94560" },
                  { l: "24-Mo Rev", v: fmtD(m24.rev_p50) + "/mo", c: "#10b981" },
                  { l: "Breakeven", v: breakeven ? `Month ${breakeven}` : ">24", c: "#f59e0b" },
                ].map(({ l, v, c }) => (
                  <div key={l} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: "8px 16px", borderLeft: `3px solid ${c}` }}>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, textTransform: "uppercase" as const }}>{l}</div>
                    <div style={{ color: "white", fontSize: 18, fontWeight: 700, fontFamily: "monospace" }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Nav */}
      <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 64, zIndex: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", overflowX: "auto" }}>
          <TabBtn active={tab === "simulation"} onClick={() => setTab("simulation")} icon="🎲">Monte Carlo</TabBtn>
          <TabBtn active={tab === "strategy"} onClick={() => setTab("strategy")} icon="🚀">Growth Strategy</TabBtn>
          <TabBtn active={tab === "costs"} onClick={() => setTab("costs")} icon="💰">Cost Model</TabBtn>
          <TabBtn active={tab === "architecture"} onClick={() => setTab("architecture")} icon="🏗️">Architecture</TabBtn>
          <TabBtn active={tab === "roadmap"} onClick={() => setTab("roadmap")} icon="🗺️">Roadmap</TabBtn>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px" }}>
        {/* ─── MONTE CARLO TAB ─── */}
        {tab === "simulation" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, alignItems: "start" }}>
            <div style={{ background: "white", borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #f0f0f0", position: "sticky", top: 120, maxHeight: "calc(100vh - 140px)", overflowY: "auto" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700 }}>Simulation Parameters</h3>
              <p style={{ margin: "0 0 14px", fontSize: 10, color: "#9ca3af" }}>All minimums at 0 for worst-case modeling</p>
              <SL color="#e94560">Growth</SL>
              <Sl label="Initial Users" value={params.initialUsers} onChange={v => up("initialUsers", v)} min={10} max={500} step={10} />
              <Sl label="Min Monthly Growth" value={params.monthlyGrowthMin} onChange={v => up("monthlyGrowthMin", v)} min={0} max={0.30} step={0.01} format="percent" />
              <Sl label="Max Monthly Growth" value={params.monthlyGrowthMax} onChange={v => up("monthlyGrowthMax", v)} min={0} max={0.60} step={0.01} format="percent" />
              <Sl label="Growth Volatility" value={params.growthStdDev} onChange={v => up("growthStdDev", v)} min={0} max={0.20} step={0.01} format="percent" />
              <SL color="#0f3460">Events</SL>
              <Sl label="Viral Spike Prob" value={params.viralProb} onChange={v => up("viralProb", v)} min={0} max={0.15} step={0.01} format="percent" />
              <Sl label="Churn Event Prob" value={params.churnProb} onChange={v => up("churnProb", v)} min={0} max={0.20} step={0.01} format="percent" />
              <SL color="#10b981">Revenue</SL>
              <Sl label="Min Booking Rate" value={params.bookingRateMin} onChange={v => up("bookingRateMin", v)} min={0} max={0.15} step={0.005} format="percent" />
              <Sl label="Max Booking Rate" value={params.bookingRateMax} onChange={v => up("bookingRateMax", v)} min={0} max={0.25} step={0.005} format="percent" />
              <Sl label="Avg Booking Value" value={params.avgBookingValue} onChange={v => up("avgBookingValue", v)} min={200} max={2000} step={50} format="dollar" />
              <Sl label="Min Commission" value={params.commissionMin} onChange={v => up("commissionMin", v)} min={0} max={0.20} step={0.01} format="percent" />
              <Sl label="Max Commission" value={params.commissionMax} onChange={v => up("commissionMax", v)} min={0} max={0.30} step={0.01} format="percent" />
              <SL color="#f59e0b">Personnel</SL>
              <Sl label="Part-Time Hire At" value={params.partTimeThreshold} onChange={v => up("partTimeThreshold", v)} min={0} max={50000} step={1000} format="users" />
              <Sl label="Part-Time Salary" value={params.partTimeSalary} onChange={v => up("partTimeSalary", v)} min={0} max={8000} step={500} format="dollar" />
              <Sl label="Full-Time Hire At" value={params.fullTimeThreshold} onChange={v => up("fullTimeThreshold", v)} min={0} max={100000} step={5000} format="users" />
              <Sl label="Full-Time Salary" value={params.fullTimeSalary} onChange={v => up("fullTimeSalary", v)} min={0} max={15000} step={500} format="dollar" />
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={runSim} disabled={running} style={{ flex: 1, padding: "10px 0", background: running ? "#d1d5db" : "linear-gradient(135deg,#e94560,#d63851)", color: "white", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: running ? "wait" : "pointer" }}>{running ? "Running..." : "Run Simulation"}</button>
                <button onClick={() => { setParams(defaultParams); setTimeout(runSim, 100); }} style={{ padding: "10px 12px", background: "#f3f4f6", color: "#6b7280", border: "none", borderRadius: 8, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Reset</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {simData && <>
                <CC title="User Growth Projection" subtitle="Fan chart: P5-P95 (zero-min = wider bands)">
                  <ResponsiveContainer width="100%" height={300}><AreaChart data={simData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} /><YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={fmt} /><Tooltip formatter={(v: any) => [fmt(v), ""]} contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Area dataKey="users_p95" stroke="none" fill="#e94560" fillOpacity={0.08} name="P95" /><Area dataKey="users_p75" stroke="none" fill="#e94560" fillOpacity={0.12} name="P75" /><Area dataKey="users_p50" stroke="#e94560" strokeWidth={2.5} fill="#e94560" fillOpacity={0.18} name="Median" /><Area dataKey="users_p25" stroke="none" fill="white" fillOpacity={1} /><Area dataKey="users_p5" stroke="none" fill="white" fillOpacity={1} /><Legend wrapperStyle={{ fontSize: 11 }} /></AreaChart></ResponsiveContainer>
                </CC>
                <CC title="Revenue vs. Costs" subtitle="Median with P25-P75 bands">
                  <ResponsiveContainer width="100%" height={300}><ComposedChart data={simData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} /><YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={fmtD} /><Tooltip formatter={(v: any) => [fmtD(v), ""]} contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Area dataKey="rev_p75" stroke="none" fill="#10b981" fillOpacity={0.1} /><Area dataKey="rev_p25" stroke="none" fill="white" fillOpacity={1} /><Line dataKey="rev_p50" stroke="#10b981" strokeWidth={2.5} dot={false} name="Revenue" /><Area dataKey="cost_p75" stroke="none" fill="#e94560" fillOpacity={0.1} /><Area dataKey="cost_p25" stroke="none" fill="white" fillOpacity={1} /><Line dataKey="cost_p50" stroke="#e94560" strokeWidth={2.5} dot={false} name="Costs" strokeDasharray="6 3" />{breakeven && <ReferenceLine x={breakeven} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `BE: Mo ${breakeven}`, fontSize: 11, fill: "#f59e0b" }} />}<Legend wrapperStyle={{ fontSize: 11 }} /></ComposedChart></ResponsiveContainer>
                </CC>
                <CC title="Net Profit / Loss" subtitle="Monthly P&L trajectory">
                  <ResponsiveContainer width="100%" height={240}><AreaChart data={simData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} /><YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={fmtD} /><Tooltip formatter={(v: any) => [fmtD(v), ""]} contentStyle={{ fontSize: 12, borderRadius: 8 }} /><ReferenceLine y={0} stroke="#1a1a2e" strokeWidth={1} /><Area dataKey="profit_p50" stroke="#1a1a2e" strokeWidth={2} fill="#10b981" fillOpacity={0.15} name="Net Profit" /><Legend wrapperStyle={{ fontSize: 11 }} /></AreaChart></ResponsiveContainer>
                </CC>
              </>}
            </div>
          </div>
        )}

        {/* ─── GROWTH STRATEGY TAB ─── */}
        {tab === "strategy" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, alignItems: "start" }}>
            <div style={{ background: "white", borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #f0f0f0", position: "sticky", top: 120 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700 }}>Funding Scenario</h3>
              <p style={{ margin: "0 0 14px", fontSize: 10, color: "#9ca3af" }}>Growth-first vs profit-first tradeoffs</p>
              <SL color="#e94560">Funding</SL>
              <Sl label="Funding Raised" value={fundingAmount} onChange={setFundingAmount} min={0} max={500000} step={5000} format="dollar" />
              <Sl label="Monthly Marketing" value={marketingMonthly} onChange={setMarketingMonthly} min={0} max={15000} step={500} format="dollar" />
              <div style={{ background: "#fef3c7", borderRadius: 8, padding: "8px 10px", fontSize: 10, color: "#92400e", marginBottom: 12 }}>Runway: <b>{Math.floor(fundingAmount / Math.max(marketingMonthly + 200, 1))} months</b></div>
              <SL color="#10b981">Growth Config</SL>
              <Sl label="Marketing Growth Boost" value={growthBoost} onChange={setGrowthBoost} min={0} max={0.25} step={0.01} format="percent" />
              <Sl label="Commission Delay (mo)" value={commissionDelay} onChange={setCommissionDelay} min={0} max={24} step={1} />

              <SL color="#e94560">Profit-First Commission</SL>
              <Sl label="Commission Rate" value={profitCommission} onChange={setProfitCommission} min={0} max={0.25} step={0.01} format="percent" />

              <SL color="#10b981">Growth-First Commission</SL>
              <Sl label={`During Delay (${commissionDelay}mo)`} value={growthCommission} onChange={setGrowthCommission} min={0} max={0.15} step={0.01} format="percent" />
              <Sl label="After Delay" value={growthPostCommission} onChange={setGrowthPostCommission} min={0} max={0.25} step={0.01} format="percent" />

              <SL color="#f59e0b">Hybrid Commission</SL>
              <Sl label={`During Delay (${Math.floor(commissionDelay * 0.75)}mo)`} value={hybridCommission} onChange={setHybridCommission} min={0} max={0.15} step={0.01} format="percent" />
              <Sl label="After Delay" value={hybridPostCommission} onChange={setHybridPostCommission} min={0} max={0.25} step={0.01} format="percent" />

              <button onClick={runStrat} disabled={running} style={{ width: "100%", padding: "10px 0", background: running ? "#d1d5db" : "linear-gradient(135deg,#10b981,#059669)", color: "white", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: running ? "wait" : "pointer", marginTop: 8 }}>{running ? "Running..." : "Run Strategy Analysis"}</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {stratData && <>
                <CC title="User Growth: Strategy Comparison" subtitle="How delaying profits accelerates acquisition">
                  <ResponsiveContainer width="100%" height={310}><ComposedChart margin={{ top: 5, right: 20, bottom: 5, left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} /><YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={fmt} /><Tooltip formatter={(v: any) => [fmt(v), ""]} contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Line data={stratData["Profit-First"]} dataKey="users_p50" stroke="#e94560" strokeWidth={2.5} dot={false} name="Profit-First" /><Line data={stratData["Growth-First"]} dataKey="users_p50" stroke="#10b981" strokeWidth={2.5} dot={false} name="Growth-First" /><Line data={stratData["Hybrid"]} dataKey="users_p50" stroke="#f59e0b" strokeWidth={2} dot={false} name="Hybrid" strokeDasharray="6 3" /><ReferenceLine x={commissionDelay} stroke="#10b981" strokeDasharray="3 3" label={{ value: "Commission starts", fontSize: 9, fill: "#10b981" }} /><Legend wrapperStyle={{ fontSize: 11 }} /></ComposedChart></ResponsiveContainer>
                </CC>
                <CC title="Cumulative P&L: The Cost of Growth" subtitle="Growth-first goes negative but builds larger revenue engine">
                  <ResponsiveContainer width="100%" height={310}><ComposedChart margin={{ top: 5, right: 20, bottom: 5, left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} /><YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={fmtD} /><Tooltip formatter={(v: any) => [fmtD(v), ""]} contentStyle={{ fontSize: 12, borderRadius: 8 }} /><ReferenceLine y={0} stroke="#1a1a2e" strokeWidth={1} /><Line data={stratData["Profit-First"]} dataKey="cum_p50" stroke="#e94560" strokeWidth={2.5} dot={false} name="Profit-First" /><Line data={stratData["Growth-First"]} dataKey="cum_p50" stroke="#10b981" strokeWidth={2.5} dot={false} name="Growth-First" /><Line data={stratData["Hybrid"]} dataKey="cum_p50" stroke="#f59e0b" strokeWidth={2} dot={false} name="Hybrid" strokeDasharray="6 3" /><Legend wrapperStyle={{ fontSize: 11 }} /></ComposedChart></ResponsiveContainer>
                </CC>
                <CC title="Strategy Detail: Revenue vs Cost vs Profit" subtitle="Monthly breakdown for a single strategy">
                  <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                    {(["Profit-First", "Growth-First", "Hybrid"] as const).map(s => {
                      const colors: Record<string, string> = { "Profit-First": "#e94560", "Growth-First": "#10b981", "Hybrid": "#f59e0b" };
                      const isActive = detailStrategy === s;
                      return (
                        <button key={s} onClick={() => setDetailStrategy(s)} style={{
                          flex: 1, padding: "8px 0", border: isActive ? `2px solid ${colors[s]}` : "2px solid #e5e7eb",
                          borderRadius: 8, background: isActive ? `${colors[s]}10` : "white",
                          color: isActive ? colors[s] : "#6b7280", fontWeight: isActive ? 700 : 500,
                          fontSize: 12, cursor: "pointer", transition: "all 0.15s",
                        }}>{s}</button>
                      );
                    })}
                  </div>
                  {stratData[detailStrategy] && (
                    <ResponsiveContainer width="100%" height={310}>
                      <ComposedChart data={stratData[detailStrategy]} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={fmtD} />
                        <Tooltip formatter={(v: any) => [fmtD(v), ""]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <ReferenceLine y={0} stroke="#1a1a2e" strokeWidth={1} />
                        <Area dataKey="rev_p75" stroke="none" fill="#10b981" fillOpacity={0.08} />
                        <Area dataKey="rev_p25" stroke="none" fill="white" fillOpacity={1} />
                        <Line dataKey="rev_p50" stroke="#10b981" strokeWidth={2.5} dot={false} name="Revenue" />
                        <Area dataKey="cost_p75" stroke="none" fill="#e94560" fillOpacity={0.08} />
                        <Area dataKey="cost_p25" stroke="none" fill="white" fillOpacity={1} />
                        <Line dataKey="cost_p50" stroke="#e94560" strokeWidth={2.5} dot={false} name="Total Cost" strokeDasharray="6 3" />
                        <Area dataKey="profit_p75" stroke="none" fill="#8b5cf6" fillOpacity={0.08} />
                        <Area dataKey="profit_p25" stroke="none" fill="white" fillOpacity={1} />
                        <Line dataKey="profit_p50" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Net Profit" />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </CC>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                  {[
                    { n: "Profit-First", c: "#e94560", d: `${(profitCommission*100).toFixed(0)}% from day 1. No marketing. Organic growth.`, k: "Profit-First" },
                    { n: "Growth-First", c: "#10b981", d: `${(growthCommission*100).toFixed(0)}% for ${commissionDelay}mo → ${(growthPostCommission*100).toFixed(0)}%. ${fmtD(marketingMonthly)}/mo mkt. Requires ${fmtD(fundingAmount)}.`, k: "Growth-First" },
                    { n: "Hybrid", c: "#f59e0b", d: `${(hybridCommission*100).toFixed(0)}% → ${(hybridPostCommission*100).toFixed(0)}%. Half mkt budget.`, k: "Hybrid" },
                  ].map(s => (
                    <div key={s.n} style={{ background: "white", borderRadius: 12, padding: 16, border: "1px solid #f0f0f0", borderTop: `4px solid ${s.c}` }}>
                      <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: s.c }}>{s.n}</h4>
                      <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, margin: "0 0 12px" }}>{s.d}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div style={{ background: "#fafafa", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase" as const }}>Users 24mo</div>
                          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace" }}>{fmt(stratData[s.k][stratData[s.k].length - 1]?.users_p50 || 0)}</div>
                        </div>
                        <div style={{ background: "#fafafa", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase" as const }}>Cum P&L</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: (stratData[s.k][stratData[s.k].length - 1]?.cum_p50 || 0) >= 0 ? "#10b981" : "#e94560", fontFamily: "monospace" }}>{fmtD(stratData[s.k][stratData[s.k].length - 1]?.cum_p50 || 0)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>}
              {fundData && (
                <CC title="Growth by Funding Level" subtitle="How raises translate to growth acceleration">
                  <ResponsiveContainer width="100%" height={310}><ComposedChart margin={{ top: 5, right: 20, bottom: 5, left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} /><YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={fmt} /><Tooltip formatter={(v: any) => [fmt(v), ""]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />{Object.entries(fundData).map(([n, { data: d, color: c }]: any) => (<Line key={n} data={d} dataKey="p50" stroke={c} strokeWidth={2} dot={false} name={n} />))}<Legend wrapperStyle={{ fontSize: 11 }} /></ComposedChart></ResponsiveContainer>
                </CC>
              )}
              <CC title="Funding Vehicles" subtitle="Capital mapped to strategy">
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#1a1a2e", color: "white" }}>
                        {["Vehicle", "Amount", "Terms", "What It Funds", "Runway"].map(h => <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontSize: 11 }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { v: "Bootstrapped", a: "$0", t: "N/A", f: "Hosting only. Organic.", r: "Indefinite", c: "#6b7280" },
                        { v: "Pre-Seed", a: "$15-50K", t: "SAFE, $1-2M cap", f: "6-12mo mkt ($1-2K/mo). Onboarding incentives.", r: "8-14 mo", c: "#0f3460" },
                        { v: "Angel", a: "$50-150K", t: "SAFE/note, $2-4M cap", f: "Dedicated mkt ($3-5K/mo). PR. 0% commission runway.", r: "12-18 mo", c: "#f59e0b" },
                        { v: "Seed", a: "$200-500K", t: "Equity, 15-20%", f: "Full mkt team. Mobile app. First FTE.", r: "18-24 mo", c: "#e94560" },
                      ].map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 ? "#fafafa" : "white" }}>
                          <td style={{ padding: "10px 8px", fontWeight: 700, color: r.c }}>{r.v}</td>
                          <td style={{ padding: "10px 8px", fontFamily: "monospace", fontWeight: 600 }}>{r.a}</td>
                          <td style={{ padding: "10px 8px", color: "#6b7280", fontSize: 11 }}>{r.t}</td>
                          <td style={{ padding: "10px 8px", color: "#4b5563", fontSize: 11 }}>{r.f}</td>
                          <td style={{ padding: "10px 8px", fontFamily: "monospace", fontWeight: 600 }}>{r.r}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CC>
              <CC title="Marketing Budget Allocation" subtitle="Most effective early-stage marketplace spend">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
                  {[
                    { c: "Provider Acquisition", r: "$500-1,500/mo", d: "Direct outreach, events, free photography", i: "🤝", im: "High" },
                    { c: "Content & SEO", r: "$300-800/mo", d: "Blogs, guides, social. Compounds.", i: "📝", im: "High (LT)" },
                    { c: "Referral Incentives", r: "$500-2,000/mo", d: "$25/referral. Highest marketplace ROI.", i: "🎁", im: "Very High" },
                    { c: "Local Partners", r: "$200-500/mo", d: "Event planners, venues, coordinators", i: "🏢", im: "Medium" },
                    { c: "Paid Ads", r: "$500-3,000/mo", d: "Google high-intent, IG/TikTok discovery", i: "📱", im: "Medium" },
                  ].map(m => (
                    <div key={m.c} style={{ padding: 14, background: "#fafafa", borderRadius: 10, border: "1px solid #f0f0f0" }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{m.i}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e" }}>{m.c}</div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: "#e94560", fontWeight: 600, margin: "2px 0" }}>{m.r}</div>
                      <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, margin: "4px 0 0" }}>{m.d}</p>
                      <span style={{ display: "inline-block", marginTop: 6, fontSize: 10, padding: "2px 8px", borderRadius: 10, background: m.im.includes("Very") ? "#dcfce7" : m.im.includes("High") ? "#fef3c7" : "#f3f4f6", color: m.im.includes("Very") ? "#166534" : m.im.includes("High") ? "#92400e" : "#6b7280", fontWeight: 600 }}>Impact: {m.im}</span>
                    </div>
                  ))}
                </div>
              </CC>
            </div>
          </div>
        )}

        {/* ─── COSTS TAB ─── */}
        {tab === "costs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <CC title="Total Cost Breakdown (Infra + Dev Salaries)" subtitle="Stacked by user scale — salary kicks in at 25K users">
              <ResponsiveContainer width="100%" height={360}><BarChart data={costBD} margin={{ top: 5, right: 20, bottom: 25, left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} /><YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(v: any) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : `${v}`} /><Tooltip formatter={(v: any) => [`${Number(v).toLocaleString()}/mo`, ""]} contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Bar dataKey="hosting" stackId="a" fill="#e94560" name="Hosting" /><Bar dataKey="database" stackId="a" fill="#0f3460" name="Database" /><Bar dataKey="cache" stackId="a" fill="#10b981" name="Cache" /><Bar dataKey="cdn" stackId="a" fill="#f59e0b" name="CDN" /><Bar dataKey="monitoring" stackId="a" fill="#8b5cf6" name="Monitoring" /><Bar dataKey="thirdParty" stackId="a" fill="#ec4899" name="3rd Party" /><Bar dataKey="salary" stackId="a" fill="#1a1a2e" name="Dev Salary" radius={[4, 4, 0, 0] as any} /><Legend wrapperStyle={{ fontSize: 11 }} /></BarChart></ResponsiveContainer>
            </CC>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              {[
                { s: "Free Tier", u: "0-500", infra: "$7", sal: "$0", total: "$7", d: "Render free. PostgreSQL free. Solo founder.", cl: "#10b981" },
                { s: "Starter", u: "500-5K", infra: "$60", sal: "$0", total: "$60", d: "Upgrade Render. Redis. CDN. Email API. Still solo.", cl: "#0f3460" },
                { s: "Growth", u: "5K-25K", infra: "$225", sal: "$0", total: "$225", d: "Read replica. Monitoring. Workers. Contractor help.", cl: "#8b5cf6" },
                { s: "Scale", u: "25K-100K", infra: "$775", sal: "$4-8K", total: "$4.8-8.8K", d: "Managed DB. Elasticsearch. PT→FT dev ($4-8K/mo).", cl: "#f59e0b" },
                { s: "Enterprise", u: "100K+", infra: "$1,870", sal: "$24K+", total: "$26K+", d: "Cloud migration. Dev team (3-5 devs, $24-60K/mo).", cl: "#e94560" },
              ].map(({ s, u, infra, sal, total, d, cl }) => (
                <div key={s} style={{ background: "white", borderRadius: 12, padding: 18, border: "1px solid #f0f0f0", borderLeft: `4px solid ${cl}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontWeight: 700, fontSize: 14 }}>{s}</span><span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 18, color: cl }}>{total}<span style={{ fontSize: 11, color: "#9ca3af" }}>/mo</span></span></div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>{u} users</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "#f3f4f6", color: "#6b7280", fontFamily: "monospace" }}>Infra: {infra}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: sal === "$0" ? "#f3f4f6" : "#1a1a2e", color: sal === "$0" ? "#9ca3af" : "white", fontFamily: "monospace" }}>Dev: {sal}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, margin: 0 }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── ARCHITECTURE TAB ─── */}
        {tab === "architecture" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { p: "Phase 1: Monolith", r: "0-10K", st: "CURRENT", c: "#10b981", l: [{ n: "React SPA", t: "TS + Tailwind", d: "Responsive SPA" }, { n: "Express API", t: "Node + Prisma", d: "REST, JWT, logic" }, { n: "PostgreSQL", t: "Render", d: "Single, 15 indexes" }], v: "Current. Handles 10K. No changes needed." },
              { p: "Phase 2: Cached", r: "10K-50K", st: "NEXT", c: "#f59e0b", l: [{ n: "SPA + CDN", t: "Cloudflare", d: "Edge static" }, { n: "Express + Redis", t: "BullMQ", d: "Cached, async" }, { n: "PG + Replica", t: "Pooling", d: "Write + read" }], v: "Add Redis ($15/mo), BG queue, CDN." },
              { p: "Phase 3: Services", r: "50K+", st: "FUTURE", c: "#e94560", l: [{ n: "SPA + CDN", t: "PWA/Native", d: "Multi-platform" }, { n: "Gateway + Workers", t: "Search/Book/Pay", d: "Isolated" }, { n: "PG+Redis+ES", t: "Event-driven", d: "Specialized" }], v: "Only on bottlenecks. Modular monolith first." },
            ].map(({ p, r, st, c, l, v }) => (
              <div key={p} style={{ background: "white", borderRadius: 12, padding: 22, border: "1px solid #f0f0f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div><h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{p}</h3><span style={{ fontSize: 12, color: "#9ca3af" }}>{r} users</span></div>
                  <span style={{ background: c, color: "white", padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{st}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {l.map((x, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: `${c}08`, borderRadius: 8, borderLeft: `3px solid ${c}` }}>
                      <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{x.n}</div><div style={{ fontSize: 11, color: "#6b7280" }}>{x.d}</div></div>
                      <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>{x.t}</span>
                    </div>
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#6b7280", padding: "10px 14px", background: "#fafafa", borderRadius: 8 }}><b style={{ color: "#1a1a2e" }}>Assessment:</b> {v}</p>
              </div>
            ))}
          </div>
        )}

        {/* ─── ROADMAP TAB ─── */}
        {tab === "roadmap" && (
          <div style={{ position: "relative", paddingLeft: 32 }}>
            <div style={{ position: "absolute", left: 15, top: 0, bottom: 0, width: 2, background: "linear-gradient(to bottom,#10b981,#0f3460,#e94560)", borderRadius: 2 }} />
            {milestones.map((ms, i) => (
              <div key={i} style={{ position: "relative", marginBottom: 22, paddingLeft: 20 }}>
                <div style={{ position: "absolute", left: -24, top: 6, width: 18, height: 18, borderRadius: "50%", background: ms.color, border: "3px solid white", boxShadow: `0 0 0 2px ${ms.color}33` }} />
                <div style={{ background: "white", borderRadius: 12, padding: 18, border: "1px solid #f0f0f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    <div><span style={{ fontSize: 11, fontWeight: 700, color: ms.color, textTransform: "uppercase" as const }}>{ms.q}</span><h3 style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 700 }}>{ms.title}</h3></div>
                    <div style={{ display: "flex", gap: 8 }}><span style={{ background: "#f3f4f6", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontFamily: "monospace" }}>{ms.users}</span><span style={{ background: `${ms.color}12`, padding: "3px 10px", borderRadius: 6, fontSize: 11, color: ms.color, fontWeight: 600, fontFamily: "monospace" }}>{ms.cost}</span></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 5 }}>
                    {ms.items.map((item, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 5, fontSize: 12, color: "#4b5563", lineHeight: 1.5 }}>
                        <span style={{ color: ms.color, fontSize: 14, lineHeight: 1.3 }}>›</span> {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ textAlign: "center", padding: "28px 16px", color: "#d1d5db", fontSize: 11 }}>CaterEase / Fetes — Planning Tool v2 — Feb 2026</div>
    </div>
  );
}
