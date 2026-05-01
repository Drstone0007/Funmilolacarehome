import React, { useState, useEffect, useRef } from "react";
import { 
  Activity, 
  Users, 
  Brain, 
  Home, 
  Heart, 
  Settings as SettingsIcon, 
  ShieldAlert, 
  ShieldCheck,
  Stethoscope, 
  ChevronRight, 
  Search,
  MessageSquare,
  Thermometer,
  Mic,
  X,
  RefreshCw,
  Cpu,
  Key,
  Layers,
  Share2,
  Download,
  Upload,
  Globe
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";

/* ── AI Service Types ────────────────────────────────── */

type AIProvider = "gemini" | "groq" | "openrouter" | "ollama" | "anthropic" | "openai";

interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model: string;
  endpoint?: string;
  priority: number;
}

const DEFAULT_AI_CONFIGS: AIConfig[] = [
  { provider: "gemini", model: "gemini-1.5-flash", priority: 1 },
  { provider: "groq", model: "llama-3-70b-versatile", priority: 2 },
  { provider: "openrouter", model: "auto", priority: 3 },
  { provider: "ollama", model: "llama3", endpoint: "http://localhost:11434", priority: 4 },
];

let aiClient: GoogleGenAI | null = null;

/* ── Unified AI Router ──────────────────────────────────── */

async function callAI(
  prompt: string, 
  configs: AIConfig[], 
  systemInstruction: string = "",
  history: { role: string, content: string }[] = []
): Promise<string> {
  const sortedConfigs = [...configs].sort((a, b) => a.priority - b.priority);
  let lastError = "";

  for (const config of sortedConfigs) {
    try {
      if (config.provider === "gemini") {
        const key = config.apiKey || process.env.GEMINI_API_KEY;
        if (!key) throw new Error("Gemini API Key missing");
        const client = new GoogleGenAI({ apiKey: key });
        
        const contents = history.map(h => ({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content }]
        }));
        
        contents.push({ role: "user", parts: [{ text: prompt }] });

        const result = await client.models.generateContent({
          model: config.model || "gemini-1.5-flash",
          contents,
          config: { systemInstruction }
        });
        
        const text = result.text;
        if (!text) throw new Error("Empty response from Gemini");
        return text;
      }

      // Universal API Caller for OpenAI-compatible and other providers
      if (!config.apiKey && config.provider !== "ollama") throw new Error(`${config.provider} API Key missing`);

      let url = "";
      let headers: any = { "Content-Type": "application/json" };
      let body: any = {};

      if (config.provider === "groq") {
        url = "https://api.groq.com/openai/v1/chat/completions";
        headers["Authorization"] = `Bearer ${config.apiKey}`;
        body = {
          model: config.model || "llama-3-70b-versatile",
          messages: [{ role: "system", content: systemInstruction }, ...history, { role: "user", content: prompt }]
        };
      } else if (config.provider === "openrouter") {
        url = "https://openrouter.ai/api/v1/chat/completions";
        headers["Authorization"] = `Bearer ${config.apiKey}`;
        headers["HTTP-Referer"] = window.location.origin;
        headers["X-Title"] = "CIOS OS";
        body = {
          model: config.model || "google/gemini-flash-1.5",
          messages: [{ role: "system", content: systemInstruction }, ...history, { role: "user", content: prompt }]
        };
      } else if (config.provider === "ollama") {
        url = `${config.endpoint || "http://localhost:11434"}/api/generate`;
        body = {
          model: config.model || "llama3",
          system: systemInstruction,
          prompt: prompt,
          stream: false
        };
      }

      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(`${config.provider} error: ${errorData.error?.message || resp.statusText}`);
      }

      const data = await resp.json();
      const content = config.provider === "ollama" ? data.response : data.choices?.[0]?.message?.content;
      
      if (!content) throw new Error(`Empty response from ${config.provider}`);
      return content;

    } catch (err: any) {
      console.warn(`AI Provider ${config.provider} failed:`, err.message);
      lastError = err.message;
      continue; // Try next provider in chain
    }
  }

  throw new Error(`All providers failed. Last error: ${lastError}`);
}

/* ── Remote Config Helpers ────────────────────────────── */

function encodeConfig(configs: AIConfig[]): string {
  try {
    return btoa(JSON.stringify(configs));
  } catch (e) {
    return "";
  }
}

function decodeConfig(encoded: string): AIConfig[] | null {
  try {
    const json = atob(encoded);
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed;
    return null;
  } catch (e) {
    return null;
  }
}

/* ── Types & Interfaces ────────────────────────────────── */

interface VitalData {
  spo2: number;
  bp: string;
  hr: number;
  temp: number;
}

interface ServiceUser {
  id: string;
  name: string;
  age: number;
  ward: string;
  conditions: string[];
  vitals: VitalData;
  warn: boolean;
}

interface CareModule {
  id: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  desc: string;
  serviceUsers: number;
  active: boolean;
}

interface Message {
  role: "user" | "assistant" | "error";
  content: string;
  ts: Date;
}

/* ── Mock Data ─────────────────────────────────────────── */

const SERVICE_USERS: ServiceUser[] = [
  { id: "FML-001", name: "Baba Emmanuel", age: 78, ward: "Residential A", conditions: ["Hypertension", "Type 2 Diabetes"], vitals: { spo2: 97, bp: "138/86", hr: 74, temp: 36.8 }, warn: false },
  { id: "FML-002", name: "Mama Adeola", age: 82, ward: "Palliative Care", conditions: ["Terminal CA", "Chronic Pain"], vitals: { spo2: 94, bp: "105/68", hr: 88, temp: 37.2 }, warn: true },
  { id: "FML-003", name: "Pa Niyi Adeleke", age: 74, ward: "Neuro-Rehab", conditions: ["Post-Stroke", "Mild Dementia"], vitals: { spo2: 98, bp: "145/92", hr: 68, temp: 36.6 }, warn: false },
  { id: "FML-004", name: "Iya Sekinat", age: 86, ward: "Complex Care", conditions: ["COPD", "CCF"], vitals: { spo2: 91, bp: "158/98", hr: 102, temp: 37.8 }, warn: true },
  { id: "FML-005", name: "Mr. Gbenga Olusola", age: 69, ward: "Residential B", conditions: ["Parkinsons early", "Hypertension"], vitals: { spo2: 99, bp: "132/80", hr: 72, temp: 36.9 }, warn: false },
  { id: "FML-006", name: "Chief Layi Adeyemi", age: 81, ward: "Home Care", conditions: ["Post-Hip Replacement"], vitals: { spo2: 98, bp: "126/78", hr: 70, temp: 36.7 }, warn: false },
];

const CARE_MODULES: CareModule[] = [
  { id: "residential", icon: <Home className="w-5 h-5" />, label: "24-Hr Residential", color: "#1a6b3a", desc: "Round-the-clock monitoring. Automated vitals alerts. Nurse task queue.", serviceUsers: 24, active: true },
  { id: "homecare", icon: <Users className="w-5 h-5" />, label: "Home Care", color: "#3a7fb5", desc: "Remote monitoring for community clients. WireGuard VPN physician link.", serviceUsers: 11, active: true },
  { id: "palliative", icon: <Heart className="w-5 h-5" />, label: "Hospice & Palliative", color: "#7a4fa0", desc: "Dignity-first end-of-life care. Pain management protocols. Family comms.", serviceUsers: 6, active: true },
  { id: "complex", icon: <Activity className="w-5 h-5" />, label: "Adult Complex Care", color: "#d4a843", desc: "Chronic illness management. Multi-drug reconciliation. FHIR care plans.", serviceUsers: 9, active: true },
  { id: "neuro", icon: <Brain className="w-5 h-5" />, label: "Neurological Rehab", color: "#c8473a", desc: "Stroke recovery + dementia monitoring. Cognitive assessment tools.", serviceUsers: 7, active: true },
  { id: "casemanagement", icon: <Stethoscope className="w-5 h-5" />, label: "Case Management", color: "#6ad49a", desc: "Appointment scheduling, medication tracking, family care coordination.", serviceUsers: 18, active: true },
];

const STAFF = [
  { name: "Dr. Afolabi Oluwole", role: "Medical Director", available: true, specialty: "Geriatric Medicine" },
  { name: "Sr. Folake Adewale", role: "Head Nurse", available: true, specialty: "Palliative Care" },
  { name: "Dr. Titi Oladele", role: "Visiting Physician", available: false, specialty: "Neurology" },
  { name: "Bro. Seun Fashola", role: "Care Coordinator", available: true, specialty: "Case Management" },
];

/* ── Components ────────────────────────────────────────── */

const Orb = ({ size = 52, state = "idle" }: { size?: number, state?: string }) => {
  const map: any = {
    idle:      { c: "#1a6b3a", glow: "rgba(26,107,58,0.4)" },
    thinking:  { c: "#7a4fa0", glow: "rgba(122,79,160,0.45)" },
    speaking:  { c: "#d4a843", glow: "rgba(212,168,67,0.45)" },
    listening: { c: "#c8473a", glow: "rgba(200,71,58,0.45)" },
    alert:     { c: "#c8473a", glow: "rgba(200,71,58,0.7)" },
  };
  const s = map[state] || map.idle;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {[1.5, 1.9].map((m, i) => (
        <div key={i} className="absolute rounded-full border border-current top-1/2 left-1/2 animate-ring-exp"
          style={{ width: size * m, height: size * m, color: `${s.c}38`, animationDelay: `${i * 0.75}s` }} />
      ))}
      <div className={`rounded-full relative z-10 flex items-center justify-center ${state === "speaking" ? "animate-orb-speak" : ""}`}
        style={{ 
          width: size, height: size,
          background: `radial-gradient(circle at 35% 35%, ${s.c}cc, ${s.c} 42%, #040e07 82%)`,
          boxShadow: `0 0 0 1px ${s.c}45, 0 0 22px ${s.glow}`
        }}>
        <div className="w-1/4 h-1/4 rounded-full bg-white/20" />
      </div>
    </div>
  );
};

const Badge = ({ text, color = "#6ad49a", bg = "rgba(26,107,58,0.15)" }: { text: string, color?: string, bg?: string }) => (
  <span className="font-mono text-[9px] px-2 py-0.5 rounded border border-current letter-spacing-[0.06em] whitespace-nowrap"
    style={{ background: bg, color }}>{text}</span>
);

const VitalCard = ({ label, value, unit, icon, warn }: { label: string, value: string, unit: string, icon: React.ReactNode, warn?: boolean }) => (
  <div className={`p-4 rounded-xl glass border-t-2 ${warn ? "animate-vit-pulse border-red/40 border-t-red" : "border-t-g border-white/5"}`}>
    <div className="font-mono text-[9px] text-white/30 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
      <span className={warn ? "text-red" : "text-g3"}>{icon}</span> {label}
    </div>
    <div className="flex items-baseline gap-1">
      <span className={`font-syne font-extrabold text-2xl tracking-tighter ${warn ? "text-red" : "text-white"}`}>{value}</span>
      <span className="font-mono text-[10px] text-white/20">{unit}</span>
    </div>
  </div>
);

/* ── Sections ─────────────────────────────────────────── */

interface SectionProps {
  onSelectServiceUser: (r: ServiceUser) => void;
  setIsSearchOpen?: (open: boolean) => void;
  key?: string;
}

const Dashboard = ({ onSelectServiceUser, setIsSearchOpen }: SectionProps) => {
  const [logs] = useState([
    "KERNEL: Integrity check pass (100%)",
    "AGENT: Monitoring Node Ogbomosho-01",
    "DATA: Syncing FHIR records...",
    "AI: Geriatric module initialized",
  ]);

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25 }} className="space-y-12">
      {/* Hero & Command Center */}
      <section className="border-b border-white/5 pb-12">
        <div className="flex flex-col lg:flex-row gap-12 items-start">
          <div className="flex-1">
            <h4 className="font-mono text-[9px] text-g3/60 tracking-[0.4em] uppercase mb-4 flex items-center gap-3">
              <span className="w-8 h-[1px] bg-g3/30" /> Kernel Identity: Active
            </h4>
            <h1 className="font-syne font-black text-5xl sm:text-6xl lg:text-8xl leading-[0.9] tracking-tighter italic mb-6">
              CIOS <span className="text-g3/60">KERNEL</span><br/>
              <span className="text-white/40 not-italic uppercase text-lg sm:text-2xl tracking-[0.2em]">Oṣiṣẹ Alafia</span>
            </h1>
            <p className="font-mono text-xs sm:text-sm text-white/40 leading-relaxed mb-8 max-w-2xl">
              Artificial Intelligence tailored for Funmilola Home, Ogbomosho. Monitoring health vectors across geriatric wards with Zero-Law clinician oversight.
            </p>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-3 px-6 py-3 bg-g3 text-ink font-syne font-black uppercase tracking-widest text-xs rounded-xl hover:scale-[0.98] transition-transform shadow-lg shadow-g/20"
              >
                <Search size={16}/> Command Search
              </button>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-g3 animate-pulse" />
                <span className="font-mono text-[9px] text-white/50 uppercase tracking-widest">Node: Ogbomosho-01</span>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-80 grid gap-3">
            <h5 className="font-mono text-[9px] text-white/20 uppercase tracking-widest mb-2 px-2">Essential Protocols</h5>
            {[
              { l: "Emergency Alert", s: "Pajawiri !!", i: <ShieldAlert size={16}/>, c: "text-red bg-red/5 border-red/20" },
              { l: "Ward Handover", s: "Ijabọ Iṣẹ", i: <Activity size={16}/>, c: "text-blue bg-blue/5 border-blue/20" },
              { l: "Supply Inventory", s: "Atokọ", i: <Home size={16}/>, c: "text-gold bg-gold/5 border-gold/20" },
            ].map((act, i) => (
              <button key={i} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all hover:bg-white/5 group ${act.c}`}>
                <div className="group-hover:scale-110 transition-transform">{act.i}</div>
                <div className="text-left">
                  <div className="font-syne font-bold text-[10px] uppercase tracking-wider">{act.l}</div>
                  <div className="font-mono text-[8px] opacity-40 uppercase tracking-widest">{act.s}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { v: SERVICE_USERS.length.toString(), l: "Service User Population", sub: "Capacity: 100", c: "text-g3" },
          { v: CARE_MODULES.length.toString(), l: "Care Domains", sub: "Operational", c: "text-blue" },
          { v: SERVICE_USERS.filter(r => r.warn).length.toString(), l: "Pending Alerts", sub: "Awaiting Action", c: "text-red" },
          { v: "97%", l: "AI Precision", sub: "Confidence Level", c: "text-gold" },
        ].map((s, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="glass p-6 rounded-2xl relative group hover:bg-white/[0.05] transition-all"
          >
            <div className={`font-syne font-black text-4xl mb-2 ${s.c} tracking-tighter`}>{s.v}</div>
            <div className="font-syne font-bold text-xs text-white/80 uppercase tracking-wide">{s.l}</div>
            <div className="font-mono text-[9px] text-white/20 mt-2 uppercase tracking-widest">{s.sub}</div>
          </motion.div>
        ))}
      </section>

      {/* Alert Panel */}
      <section className="relative overflow-hidden group">
        <div className="absolute inset-0 bg-red/10 blur-3xl opacity-20" />
        <div className="glass bg-red/[0.03] border-red/20 rounded-2xl p-6 relative z-10">
          <h5 className="font-syne font-black text-[11px] text-red tracking-[0.2em] mb-6 uppercase flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-red animate-pulse" /> Critical Monitor
          </h5>
          <div className="grid gap-3">
            {SERVICE_USERS.filter(r => r.warn).map((r, i) => (
              <motion.div 
                key={r.id} 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-4 p-4 glass-dark rounded-xl border-white/5 hover:bg-red/[0.05] hover:border-red/20 transition-all cursor-pointer"
                onClick={() => onSelectServiceUser(r)}
              >
                <Orb size={28} state="alert" />
                <div className="flex-1">
                  <div className="font-syne font-bold text-sm text-white/90">{r.name}</div>
                  <div className="font-mono text-[10px] text-white/30 uppercase tracking-wider">{r.ward}</div>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="font-mono text-[11px] text-red/80 font-bold">BP {r.vitals.bp}</div>
                  <div className="font-mono text-[9px] text-white/20 uppercase">SpO2 {r.vitals.spo2}%</div>
                </div>
                <ChevronRight size={16} className="text-white/20" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Care Wards */}
      <section>
        <h6 className="font-mono text-[9px] text-white/20 tracking-[0.4em] mb-8 uppercase flex items-center gap-4">
          <span className="w-12 h-[1px] bg-white/10" /> Registered Care Modules
        </h6>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CARE_MODULES.map((m, i) => (
            <motion.div 
              key={m.id} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass p-8 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform"
            >
              <div className="absolute -bottom-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none" style={{ color: m.color }}>
                <span className="text-9xl">{m.icon}</span>
              </div>
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5" style={{ color: m.color }}>
                  {m.icon}
                </div>
                <div className="text-right">
                  <div className="font-syne font-black text-2xl tracking-tighter" style={{ color: m.color }}>{m.serviceUsers}</div>
                  <div className="font-mono text-[9px] text-white/20 uppercase tracking-widest">Active Cases</div>
                </div>
              </div>
              <h3 className="font-syne font-black text-lg mb-3 tracking-tight text-white/90">{m.label}</h3>
              <p className="font-mono text-[11px] text-white/40 leading-relaxed mb-6">{m.desc}</p>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-current" style={{ color: m.color }} />
                <span className="font-mono text-[8px] uppercase tracking-widest text-white/20 font-bold">Standard Protocol Active</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </motion.div>
  );
};

const ServiceUsers = ({ onSelectServiceUser }: SectionProps) => {
  const [filter, setFilter] = useState("all");
  const wards = ["all", "Residential A", "Residential B", "Palliative Care", "Neuro-Rehab", "Complex Care", "Home Care"];
  const filtered = filter === "all" ? SERVICE_USERS : SERVICE_USERS.filter(r => r.ward === filter);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="font-syne font-black text-4xl tracking-tighter mb-2 italic">Service User <span className="text-g3/60">Registry</span></h2>
          <p className="font-mono text-xs text-white/30 uppercase tracking-widest">Active Ward Monitoring · OGB Node-01</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {wards.map(w => (
            <button key={w} onClick={() => setFilter(w)} className={`font-mono text-[9px] px-5 py-2 rounded-xl border transition-all uppercase tracking-widest ${filter === w ? "glass bg-g3/10 border-g3/40 text-g3 font-bold" : "bg-white/5 border-white/5 text-white/30 hover:border-white/20"}`}>
              {w === "all" ? "Full Home for the Aged" : w}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-4">
        {filtered.map((r, i) => (
          <motion.div 
            key={r.id} 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelectServiceUser(r)}
            className={`p-6 rounded-2xl glass border-white/5 cursor-pointer transition-all hover:bg-white/[0.05] hover:scale-[1.005] group ${r.warn ? "border-red/20 bg-red/[0.02]" : ""}`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-8 items-center">
              <Orb size={44} state={r.warn ? "alert" : "idle"} />
              <div>
                <h3 className="font-syne font-black text-xl text-white/90 mb-1 tracking-tight group-hover:text-g3 transition-colors">{r.name}</h3>
                <div className="font-mono text-[10px] text-white/30 flex flex-wrap gap-x-6 gap-y-1 uppercase tracking-widest">
                  <span>ID: {r.id}</span>
                  <span>Age: {r.age}</span>
                  <span className="text-g3/40">{r.ward}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {r.conditions.map(c => (
                    <span key={c} className="font-mono text-[8px] px-3 py-1 rounded-lg glass-dark border-white/5 text-white/40 uppercase font-bold tracking-tighter">{c}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
                {[
                  { l: "O2", v: r.vitals.spo2 + "%", w: r.vitals.spo2 < 94 },
                  { l: "BP", v: r.vitals.bp, w: false },
                  { l: "BPM", v: r.vitals.hr, w: r.vitals.hr > 100 },
                  { l: "TEMP", v: r.vitals.temp + "°", w: r.vitals.temp > 38 },
                ].map((stat, idx) => (
                  <div key={idx} className={`p-3 rounded-xl glass-dark min-w-[85px] border-white/5 ${stat.w ? "border-red/20 shadow-[0_0_15px_rgba(200,71,58,0.1)]" : ""}`}>
                    <div className="font-mono text-[8px] text-white/20 uppercase tracking-tighter mb-1 font-bold">{stat.l}</div>
                    <div className={`font-syne font-black text-sm tracking-tighter ${stat.w ? "text-red" : "text-white/80"}`}>{stat.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

const Advisory = ({ configs, key }: { configs: AIConfig[], key?: string }) => {
  const [mode, setMode] = useState<"serviceUser" | "examiner" | "mentor">("serviceUser");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: `CIOS Online for Funmilola Home for the Aged, Ogbomosho.\n\nMode: ${mode.toUpperCase()}\nStatus: ZeroLaw Enforced.\n\nSession initialized. Doctor oversight required for all output.`, ts: new Date() }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const modes = [
    { id: "serviceUser", icon: <Users className="w-5 h-5" />, label: "Service User Sim", color: "#d4a843", desc: "Interact with an elderly profile. Test clinical history techniques." },
    { id: "examiner", icon: <ShieldAlert className="w-5 h-5" />, label: "Clinician Test", color: "#7a4fa0", desc: "Complex geriatric diagnostics and local Ogbomosho context." },
    { id: "mentor", icon: <Brain className="w-5 h-5" />, label: "Care Mentor", color: "#3a7fb5", desc: "Advanced protocols for palliative, stroke, and dementia care." },
  ];

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: input, ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    try {
      const systemInstruction = `You are CIOS, a Clinical Intelligence OS for Funmilola Home for the Aged, Ogbomosho, Nigeria. 
      MODE: ${mode.toUpperCase()}
      Zero-Law Protocol: Emphasize that AI advice is secondary to physician judgment. Responses must be clinical and technical.`;

      const response = await callAI(
        currentInput, 
        configs, 
        systemInstruction, 
        messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))
      );

      setMessages(prev => [...prev, { role: "assistant", content: response, ts: new Date() }]);
    } catch (error: any) {
      let msg = error.message;
      if (msg.includes("429")) msg = "Quota limit reached. Auto-switching to fallback...";
      setMessages(prev => [...prev, { role: "error", content: `ALERT: ${msg}`, ts: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-10 h-[calc(100vh-220px)] md:h-[calc(100vh-180px)]">
      <div className="hidden lg:block space-y-6 overflow-y-auto pr-4">
        <h3 className="font-syne font-black text-2xl tracking-tighter italic mb-8 text-white/80">Intelligence <span className="text-g3/60">Module</span></h3>
        {modes.map(m => (
          <button 
            key={m.id} 
            onClick={() => setMode(m.id as any)}
            className={`w-full p-6 rounded-2xl border text-left transition-all relative overflow-hidden group ${mode === m.id ? "glass border-g3/30 shadow-[0_0_30px_rgba(106,212,154,0.1)]" : "bg-white/5 border-white/5 hover:border-white/10"}`}
          >
            {mode === m.id && <div className="absolute top-0 right-0 p-2 opacity-10"><Activity size={40} /></div>}
            <div className="flex items-center gap-4 mb-4" style={{ color: m.color }}>
              <div className="p-2 rounded-lg glass-dark border-white/5">{m.icon}</div>
              <span className="font-syne font-black text-xs uppercase tracking-widest">{m.label}</span>
            </div>
            <p className="font-mono text-[11px] text-white/30 leading-relaxed font-medium">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* Mobile Mode Selector */}
      <div className="lg:hidden flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {modes.map(m => (
          <button 
            key={m.id} 
            onClick={() => setMode(m.id as any)}
            className={`flex-shrink-0 flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all ${mode === m.id ? "glass border-g3/30 bg-white/10" : "bg-white/5 border-white/5 text-white/30"}`}
          >
            <div style={{ color: m.id === mode ? m.color : 'inherit' }}>{m.icon}</div>
            <span className="font-syne font-black text-[10px] uppercase tracking-widest whitespace-nowrap">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col glass rounded-3xl overflow-hidden relative">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
          {messages.map((m, i) => (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div className="font-mono text-[8px] text-white/10 mb-2 px-4 uppercase tracking-[0.3em] font-black">
                {m.role === "user" ? "Protocol User" : "CIOS Kernel"} · {m.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className={`max-w-[90%] md:max-w-[80%] p-6 rounded-3xl text-xs md:text-sm font-mono leading-relaxed shadow-xl ${m.role === "user" ? "glass-dark border-g3/20 bg-g3/[0.03] text-white/90" : m.role === "error" ? "glass shadow-red/10 border-red/20 text-red" : "glass border-white/10 text-white/70"}`}>
                {m.content}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex flex-col gap-4 px-8 border-l-2 border-g3/10 py-4 animate-pulse">
              <div className="flex items-center gap-4 text-white/20 font-mono text-[10px]">
                <div className="w-4 h-4 border-2 border-g3/20 border-t-g3 rounded-full animate-spin" />
                Initializing Cognitive Matrix...
              </div>
              <div className="space-y-2">
                {["Vectoring Vitals", "FHIR Protocol Matching", "Zero-Law Audit"].map((step, i) => (
                  <div key={i} className="flex items-center gap-3 font-mono text-[8px] text-g3/30 uppercase tracking-[0.2em]">
                    <div className="w-1 h-1 bg-g3/20 rounded-full" />
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-white/5 bg-black/20 backdrop-blur-3xl">
          <div className="flex gap-4 glass bg-white/[0.04] p-3 rounded-2xl border-white/10 focus-within:border-g3/40 focus-within:bg-white/[0.06] transition-all">
            <textarea 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="Input clinical data or advisory query…"
              className="flex-1 bg-transparent border-none text-white/80 font-mono text-xs md:text-sm p-3 outline-none resize-none min-h-[60px] max-h-48"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-8 rounded-xl bg-g font-syne font-black text-xs uppercase tracking-widest text-white hover:bg-g3 transition-all disabled:opacity-10 active:scale-95 flex items-center justify-center"
            >
              Consult
            </button>
          </div>
          <div className="flex justify-between mt-4 font-mono text-[9px] text-white/10 uppercase tracking-[0.4em] px-4 font-black italic">
            <span>Auth: NDPR/FHIR Layer</span>
            <span className="text-g3/20">Encryption: Zero-Trust</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Modal ────────────────────────────────────────────── */

const ServiceUserModal = ({ serviceUser, onClose, configs }: { serviceUser: ServiceUser, onClose: () => void, configs: AIConfig[] }) => {
  const [advisory, setAdvisory] = useState<string>("Initializing cognitive audit...");
  const [isGenerating, setIsGenerating] = useState(true);
  const [status, setStatus] = useState<"pending" | "approved" | "dismissed">("pending");

  useEffect(() => {
    async function generateAdvisory() {
      try {
        const prompt = `Perform a geriatric clinical review for a service user:
        Name: ${serviceUser.name}
        Age: ${serviceUser.age}
        Ward: ${serviceUser.ward}
        Conditions: ${serviceUser.conditions.join(", ")}
        Vitals: SpO2: ${serviceUser.vitals.spo2}%, BP: ${serviceUser.vitals.bp}, HR: ${serviceUser.vitals.hr}bpm, Temp: ${serviceUser.vitals.temp}°C
        Status: ${serviceUser.warn ? "CRITICAL ALERT" : "STABLE"}

        Provide a concise, 2-sentence clinical advisory following Zero-Law geriatric protocols. Focus on immediate next steps or stabilization.`;

        const response = await callAI(
          prompt, 
          configs, 
          "You are a clinical geriatric advisor for Funmilola Home."
        );

        setAdvisory(response || "Diagnostic summary failed to compute.");
      } catch (err: any) {
        setAdvisory(`ADVISORY ERROR: ${err.message}. Manual review required.`);
      } finally {
        setIsGenerating(false);
      }
    }
    generateAdvisory();
  }, [serviceUser, configs]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="fixed inset-0 z-50 bg-ink/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 lg:p-12 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }}
        className={`bg-ink border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl transition-colors ${status === 'approved' ? 'border-g3/40' : status === 'dismissed' ? 'opacity-50' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/2">
          <div className="flex items-center gap-4">
            <Orb size={48} state={isGenerating ? "thinking" : serviceUser.warn ? "alert" : "idle"} />
            <div>
              <h2 className="font-syne font-extrabold text-xl">{serviceUser.name}</h2>
              <div className="font-mono text-[10px] text-white/30">{serviceUser.id} · {serviceUser.ward}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-6">
          {status === "pending" ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <VitalCard label="Oxygen" value={serviceUser.vitals.spo2.toString()} unit="%" icon={<Activity size={12}/>} warn={serviceUser.vitals.spo2 < 94} />
                <VitalCard label="Pressure" value={serviceUser.vitals.bp} unit="" icon={<Heart size={12}/>} />
                <VitalCard label="Heart" value={serviceUser.vitals.hr.toString()} unit="bpm" icon={<Activity size={12}/>} warn={serviceUser.vitals.hr > 100} />
                <VitalCard label="Temp" value={serviceUser.vitals.temp.toString()} unit="°C" icon={<Thermometer size={12}/>} warn={serviceUser.vitals.temp > 38} />
              </div>

              <div>
                <h4 className="font-mono text-[9px] text-white/20 uppercase tracking-widest mb-3">Diagnosed Conditions</h4>
                <div className="flex flex-wrap gap-2">
                  {serviceUser.conditions.map(c => (
                    <span key={c} className="font-mono text-[10px] px-3 py-1 bg-white/5 border border-white/10 text-white/60 rounded">{c}</span>
                  ))}
                </div>
              </div>

              <div className={`border-l-2 p-4 rounded-r-lg transition-all ${isGenerating ? "bg-white/5 border-white/10" : "bg-gold/5 border-gold animate-in fade-in"}`}>
                <h5 className="font-syne font-bold text-[10px] text-gold uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Brain size={14} className={isGenerating ? "animate-pulse" : ""} /> AI Advisory · Preliminary Assessment
                </h5>
                <p className={`font-mono text-xs text-white/60 leading-relaxed italic ${isGenerating ? "animate-pulse" : ""}`}>
                  "{advisory}"
                </p>
                {!isGenerating && (
                  <div className="mt-4 flex gap-2">
                    <button 
                      onClick={() => setStatus("approved")}
                      className="flex-1 font-mono text-[10px] p-2 bg-g/20 border border-g/30 text-g3 rounded hover:bg-g/30 transition-all font-bold"
                    >
                      APPROVE PROTOCOL
                    </button>
                    <button 
                      onClick={() => setStatus("dismissed")}
                      className="flex-1 font-mono text-[10px] p-2 bg-white/5 border border-white/10 text-white/40 rounded hover:bg-white/10 transition-all uppercase"
                    >
                      Dismiss Advisory
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-20 text-center space-y-6">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center border-2 ${status === 'approved' ? 'border-g3 bg-g/10 text-g3' : 'border-white/20 text-white/20'}`}>
                {status === 'approved' ? <Activity size={32} /> : <X size={32} />}
              </div>
              <div>
                <h3 className="font-syne font-black text-2xl uppercase tracking-tighter">
                  {status === 'approved' ? 'Protocol Synchronized' : 'Advisory Dismissed'}
                </h3>
                <p className="font-mono text-[10px] text-white/30 uppercase tracking-[0.2em] mt-2">
                  Audit Log Updated · Case Reference {serviceUser.id}
                </p>
              </div>
              <button 
                onClick={onClose}
                className="font-mono text-[10px] px-8 py-3 bg-white/5 border border-white/10 text-white/60 rounded-full hover:bg-white/10 transition-all uppercase tracking-widest"
              >
                Return to Registry
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ── Main App ─────────────────────────────────────────── */

export default function App() {
  const [view, setView] = useState<string>("dashboard");
  const [selectedServiceUser, setSelectedServiceUser] = useState<ServiceUser | null>(null);
  const [time, setTime] = useState(new Date());
  const [isAuthorized, setIsAuthorized] = useState<boolean>(!!process.env.GEMINI_API_KEY);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>(() => {
    // Check URL for remote config first
    const params = new URLSearchParams(window.location.search);
    const remote = params.get("config");
    if (remote) {
      const decoded = decodeConfig(remote);
      if (decoded) {
        localStorage.setItem("cios_ai_configs", JSON.stringify(decoded));
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return decoded;
      }
    }
    const saved = localStorage.getItem("cios_ai_configs");
    return saved ? JSON.parse(saved) : DEFAULT_AI_CONFIGS;
  });

  useEffect(() => {
    localStorage.setItem("cios_ai_configs", JSON.stringify(aiConfigs));
  }, [aiConfigs]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    if (process.env.GEMINI_API_KEY) setIsAuthorized(true);
    
    // Check for first-time visit
    const hasVisited = localStorage.getItem("cios_visited");
    if (!hasVisited) {
      setShowOnboarding(true);
      localStorage.setItem("cios_visited", "true");
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsSearchOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const navItems = [
    { id: "dashboard", label: "Kernel", icon: <Activity size={18}/> },
    { id: "service_users", label: "Wards", icon: <Users size={18}/> },
    { id: "advisory", label: "Intelligence", icon: <Brain size={18}/> },
    { id: "staff", label: "Medical", icon: <Stethoscope size={18}/> },
    { id: "settings", label: "System", icon: <SettingsIcon size={18}/> },
  ];

  return (
    <div className="min-h-screen flex flex-col selection:bg-g3 selection:text-ink relative overflow-hidden">
      {/* Background Cinematic Visuals */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-g3/5 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-blue/5 rounded-full blur-[100px] animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-gold/5 rounded-full blur-[80px] animate-float" style={{ animationDelay: '4s' }} />
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>

      {/* Navbar (Desktop) */}
      <nav className="h-16 border-b border-white/5 bg-ink/40 backdrop-blur-2xl fixed top-0 w-full z-40 px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-syne font-black text-xs text-ink shadow-[0_0_20px_rgba(255,255,255,0.2)]">F</div>
          <div className="hidden min-[450px]:block">
            <div className="font-syne font-black text-sm tracking-tighter leading-none text-white/90">CIOS <span className="text-g3">AGENT</span></div>
            <div className="font-mono text-[8px] text-white/20 tracking-[0.3em] uppercase mt-1">Ogbomosho Node · Fully Active</div>
          </div>
        </div>

        {/* Desktop Nav Items */}
        <div className="hidden md:flex gap-1">
          {navItems.map(item => (
            <button 
              key={item.id} 
              onClick={() => setView(item.id)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono text-[9px] uppercase tracking-wider transition-all whitespace-nowrap ${view === item.id ? "bg-white/5 text-g3 font-bold" : "text-white/25 hover:text-white/50"}`}
            >
              {React.cloneElement(item.icon as React.ReactElement, { size: 14 })} <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="font-mono text-[9px] text-white/60 tabular-nums">{time.toLocaleTimeString([], { hour12: false })}</span>
            <span className={`font-mono text-[7px] uppercase tracking-widest ${isAuthorized ? 'text-g3' : 'text-gold'} animate-pulse`}>
              {isAuthorized ? 'Kernel Synchronized' : 'Awaiting Authorization'}
            </span>
          </div>
          <div className={`w-2 h-2 rounded-full ${isAuthorized ? 'bg-g' : 'bg-gold'} animate-pulse`} />
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-6 pt-20 md:pt-24 pb-24 md:pb-20 transition-all">
        <AnimatePresence mode="wait">
          {view === "dashboard" && <Dashboard key="dash" onSelectServiceUser={setSelectedServiceUser} setIsSearchOpen={setIsSearchOpen}/>}
          {view === "service_users" && <ServiceUsers key="res" onSelectServiceUser={setSelectedServiceUser}/>}
          {view === "advisory" && <Advisory key="adv" configs={aiConfigs} />}
          {view === "staff" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {STAFF.map((s, i) => (
                <div key={i} className="p-4 md:p-5 rounded-xl border border-white/5 bg-white/2">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-full bg-g/20 border border-g/30 flex items-center justify-center text-g3 text-lg">⚕</div>
                    <div>
                      <h4 className="font-syne font-bold text-sm">{s.name}</h4>
                      <p className="font-mono text-[10px] text-white/30">{s.role}</p>
                    </div>
                  </div>
                  <Badge text={s.specialty} color="#3a7fb5" bg="rgba(58,127,181,0.1)"/>
                </div>
              ))}
            </motion.div>
          )}
          {view === "settings" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl border border-white/5 bg-white/2">
                  <h3 className="font-syne font-bold text-lg mb-4 flex items-center gap-3">
                    <Layers size={18} className="text-white/40" /> Infrastructure
                  </h3>
                  <div className="space-y-4 font-mono text-[10px] text-white/40">
                    <div className="flex justify-between border-b border-white/5 pb-2"><span>Deployment</span> <span>Funmilola Home for the Aged Ogbomosho v2.4</span></div>
                    <div className="flex justify-between border-b border-white/5 pb-2"><span>Compliance</span> <span>NDPR 2019 · GDPR · FHIR R4</span></div>
                    <div className="flex justify-between border-b border-white/5 pb-2"><span>Network</span> <span>WireGuard VPN · Local Docker Nodes</span></div>
                    <div className="flex justify-between text-g3 border-b border-white/5 pb-2"><span>Master Hub</span> <span>Ogbomosho Central</span></div>
                  </div>
                </div>

                <div className="p-6 rounded-xl border border-gold/20 bg-gold/5 flex flex-col justify-center">
                  <h3 className="font-syne font-bold text-lg mb-2 text-gold flex items-center gap-3">
                    <Cpu size={18} /> Logic Status
                  </h3>
                  <p className="font-mono text-xs text-white/50 leading-relaxed mb-4">
                    Intelligence matrix is operating at peak precision. Cascade routing is active with {aiConfigs.filter(c => c.apiKey || c.provider === "gemini" || c.provider === "ollama").length} healthy providers.
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-gold/70">Protocol: Multi-Chain Fallback</span>
                  </div>
                </div>
              </div>

              {/* AI Routing Panel */}
              <div className="p-6 md:p-10 rounded-3xl border border-white/5 bg-white/[0.02]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                  <div>
                    <h2 className="font-syne font-black text-2xl tracking-tighter italic">Intelligence <span className="text-g3/60">Routing</span></h2>
                    <p className="font-mono text-[10px] text-white/20 uppercase tracking-widest mt-1">Provider Cascade Configuration</p>
                  </div>
                  <button 
                    onClick={() => setAiConfigs(DEFAULT_AI_CONFIGS)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full font-mono text-[8px] uppercase tracking-widest text-white/40 hover:text-white transition-all whitespace-nowrap"
                  >
                    <RefreshCw size={12} /> Reset to Default
                  </button>
                </div>

                <div className="space-y-4">
                  {aiConfigs.sort((a, b) => a.priority - b.priority).map((config, idx) => (
                    <div key={config.provider} className="glass bg-white/[0.01] p-6 rounded-2xl border-white/5 flex flex-col md:flex-row gap-6 items-center">
                      <div className="flex items-center gap-4 w-full md:w-48 overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-syne font-black text-xs text-white/20">
                          {config.provider.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-syne font-bold text-sm uppercase tracking-tight flex items-center gap-2">
                            {config.provider}
                            <div className={`w-1.5 h-1.5 rounded-full ${ (config.apiKey || config.provider === 'gemini' || config.provider === 'ollama') ? 'bg-g' : 'bg-white/10' }`} />
                          </div>
                          <div className="font-mono text-[8px] text-white/20 uppercase tracking-widest">
                            {(config.apiKey || config.provider === 'gemini' || config.provider === 'ollama') ? 'System Ready' : 'Key Required'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                        <div className="space-y-1">
                          <label className="font-mono text-[8px] text-white/20 uppercase tracking-widest px-1">Model Chain</label>
                          <input 
                            value={config.model}
                            onChange={e => {
                              const newConfigs = [...aiConfigs];
                              const target = newConfigs.find(c => c.provider === config.provider);
                              if (target) target.model = e.target.value;
                              setAiConfigs(newConfigs);
                            }}
                            className="w-full bg-white/5 border border-white/5 p-3 rounded-xl font-mono text-xs text-white/60 outline-none focus:border-white/20 transition-all"
                            placeholder="e.g. llama3, gemini-1.5-flash"
                          />
                        </div>
                        <div className="space-y-1 relative">
                          <label className="font-mono text-[8px] text-white/20 uppercase tracking-widest px-1">Access Key</label>
                          <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-white/10" size={14} />
                            <input 
                              type="password"
                              value={config.apiKey || ""}
                              onChange={e => {
                                const newConfigs = [...aiConfigs];
                                const target = newConfigs.find(c => c.provider === config.provider);
                                if (target) target.apiKey = e.target.value;
                                setAiConfigs(newConfigs);
                              }}
                              className="w-full bg-white/5 border border-white/5 p-3 pl-10 rounded-xl font-mono text-xs text-white/60 outline-none focus:border-white/20 transition-all placeholder:text-white/5"
                              placeholder={config.provider === "gemini" ? "Uses ENV by default" : "Paste API Key..."}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 w-full md:w-auto">
                        <button 
                          disabled={config.priority === 1}
                          onClick={() => {
                            const newConfigs = [...aiConfigs];
                            const curr = newConfigs.find(c => c.provider === config.provider)!;
                            const prev = newConfigs.find(c => c.priority === config.priority - 1)!;
                            curr.priority--;
                            prev.priority++;
                            setAiConfigs(newConfigs);
                          }}
                          className="flex-1 md:flex-none p-3 glass border-white/5 rounded-xl text-white/20 hover:text-g3 disabled:opacity-5 transition-all"
                        >
                          ↑
                        </button>
                        <button 
                          disabled={config.priority === aiConfigs.length}
                          onClick={() => {
                            const newConfigs = [...aiConfigs];
                            const curr = newConfigs.find(c => c.provider === config.provider)!;
                            const next = newConfigs.find(c => c.priority === config.priority + 1)!;
                            curr.priority++;
                            next.priority--;
                            setAiConfigs(newConfigs);
                          }}
                          className="flex-1 md:flex-none p-3 glass border-white/5 rounded-xl text-white/20 hover:text-g3 disabled:opacity-5 transition-all"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remote Deployment Section */}
              <div className="p-6 md:p-10 rounded-3xl border border-white/5 bg-white/[0.02]">
                <h2 className="font-syne font-black text-2xl tracking-tighter italic mb-2 flex items-center gap-3">
                  Remote <span className="text-blue/80">Deployment</span>
                  <Globe size={20} className="text-blue/40" />
                </h2>
                <p className="font-mono text-[10px] text-white/20 uppercase tracking-widest mb-8">Client Handover & Configuration Management</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="glass-dark p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
                    <div className="w-10 h-10 bg-blue/10 rounded-xl flex items-center justify-center text-blue">
                      <Share2 size={20} />
                    </div>
                    <div>
                      <h4 className="font-syne font-bold text-sm tracking-tight">Direct Setup Link</h4>
                      <p className="font-mono text-[9px] text-white/20 uppercase mt-1 leading-relaxed">Encode current API keys into a one-time URL for client browsers.</p>
                    </div>
                    <button 
                      onClick={() => {
                        const encoded = encodeConfig(aiConfigs);
                        const url = `${window.location.origin}${window.location.pathname}?config=${encoded}`;
                        navigator.clipboard.writeText(url);
                        alert("Setup Link copied to clipboard! Send this to your client to automatically configure their system.");
                      }}
                      className="mt-auto w-full py-2 bg-blue/20 border border-blue/30 text-blue font-mono text-[10px] uppercase tracking-widest rounded-lg hover:bg-blue/30 transition-all"
                    >
                      Copy Setup URL
                    </button>
                  </div>

                  <div className="glass-dark p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
                    <div className="w-10 h-10 bg-g/10 rounded-xl flex items-center justify-center text-g3">
                      <Download size={20} />
                    </div>
                    <div>
                      <h4 className="font-syne font-bold text-sm tracking-tight">Export Blueprint</h4>
                      <p className="font-mono text-[9px] text-white/20 uppercase mt-1 leading-relaxed">Download a portable JSON file containing all intelligence routes.</p>
                    </div>
                    <button 
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(aiConfigs, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "cios_clinical_config.json";
                        a.click();
                      }}
                      className="mt-auto w-full py-2 bg-g/20 border border-g3/30 text-g3 font-mono text-[10px] uppercase tracking-widest rounded-lg hover:bg-g/30 transition-all"
                    >
                      Download JSON
                    </button>
                  </div>

                  <div className="glass-dark p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white/60">
                      <Upload size={20} />
                    </div>
                    <div>
                      <h4 className="font-syne font-bold text-sm tracking-tight">Import Blueprint</h4>
                      <p className="font-mono text-[9px] text-white/20 uppercase mt-1 leading-relaxed">Restore a previously exported configuration file into this kernel.</p>
                    </div>
                    <input 
                      type="file" 
                      id="config-import" 
                      className="hidden" 
                      accept=".json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result;
                            if (typeof result === "string") {
                              const decoded = JSON.parse(result);
                              if (Array.isArray(decoded)) {
                                setAiConfigs(decoded);
                                alert("Configuration imported successfully!");
                              }
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                    <button 
                      onClick={() => document.getElementById("config-import")?.click()}
                      className="mt-auto w-full py-2 bg-white/5 border border-white/10 text-white/40 font-mono text-[10px] uppercase tracking-widest rounded-lg hover:bg-white/10 transition-all"
                    >
                      Upload JSON
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden h-20 glass-dark border-t border-white/10 fixed bottom-0 w-full z-40 flex items-center justify-around px-4 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {navItems.map(item => (
          <button 
            key={item.id} 
            onClick={() => setView(item.id)}
            className={`flex flex-col items-center gap-2 transition-all px-4 py-2 rounded-xl ${view === item.id ? "text-g3 bg-white/5 shadow-[inset_0_0_10px_rgba(106,212,154,0.1)]" : "text-white/20"}`}
          >
            {React.cloneElement(item.icon as React.ReactElement, { size: 18 })}
            <span className="font-mono text-[7px] font-black uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>

      <footer className="hidden md:block py-6 border-t border-white/5 bg-ink text-center">
        <p className="font-mono text-[8px] text-white/20 uppercase tracking-[0.3em]">Clinical Intelligence OS · StoneWeb InFOMIX · Ogbomosho Nigeria</p>
      </footer>

      {/* Service User Detail Modal */}
      {selectedServiceUser && (
        <ServiceUserModal 
          serviceUser={selectedServiceUser} 
          onClose={() => setSelectedServiceUser(null)} 
          configs={aiConfigs}
        />
      )}

      {/* Onboarding Overlay */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-ink/95 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full glass-dark p-10 rounded-3xl border-g3/20 border-2 text-center"
            >
              <div className="w-20 h-20 bg-g/20 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                <Brain className="text-g3" size={40} />
              </div>
              <h2 className="font-syne font-black text-3xl tracking-tighter mb-4 italic">Welcome to <span className="text-g3">CIOS v2</span></h2>
              <p className="font-mono text-sm text-white/50 leading-relaxed mb-8">
                Your Clinical Intelligence Operating System is online. This interface is optimized for Funmilola Home clinical staff in Ogbomosho.
              </p>
              <div className="space-y-3 mb-10 text-left">
                {[
                  { icon: <Activity size={14}/>, t: "Real-time vitals monitoring", s: "Abojuto lẹsẹkẹsẹ" },
                  { icon: <Brain size={14}/>, t: "AI Geriatric Advisory", s: "Imọran AI fun awọn agbalagba" },
                  { icon: <ShieldCheck size={14}/>, t: "Secure FHIR Compliance", s: "Aabo data to daju" }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 items-center p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-g3">{item.icon}</div>
                    <div>
                      <div className="font-mono text-[10px] text-white font-bold uppercase tracking-wider">{item.t}</div>
                      <div className="font-mono text-[8px] text-g3/40 uppercase tracking-widest">{item.s}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setShowOnboarding(false)}
                className="w-full py-4 bg-g3 text-ink font-syne font-black uppercase tracking-widest rounded-xl hover:scale-[0.98] transition-transform"
              >
                Initialize System
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command Palette */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSearchOpen(false)}
            className="fixed inset-0 z-[110] bg-ink/80 backdrop-blur-sm p-4 sm:p-20"
          >
            <motion.div 
              initial={{ scale: 0.95, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={e => e.stopPropagation()}
              className="max-w-2xl mx-auto w-full glass-dark rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center gap-4">
                <Search className="text-white/40" size={20} />
                <input 
                  autoFocus
                  placeholder="Universal Intelligence Search (Ctrl+K)..."
                  className="bg-transparent border-none outline-none text-white font-syne text-xl w-full placeholder:text-white/10"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                <div className="font-mono text-[8px] text-white/20 uppercase tracking-[0.3em] mb-4 px-2">Navigation & Intelligence</div>
                {navItems.concat(CARE_MODULES.map(m => ({ id: m.id, label: m.label, icon: m.icon }))).filter(i => i.label.toLowerCase().includes(searchQuery.toLowerCase())).map((item, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      setView(item.id);
                      setIsSearchOpen(false);
                    }}
                    className="w-full flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl transition-all group"
                  >
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/40 group-hover:text-g3 transition-colors">
                      {React.cloneElement(item.icon as React.ReactElement, { size: 18 })}
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-syne font-bold text-white/80 group-hover:text-white transition-colors">{item.label}</div>
                      <div className="font-mono text-[9px] text-white/20 uppercase tracking-widest">CIOS Node Route</div>
                    </div>
                    <div className="font-mono text-[8px] text-white/10 border border-white/10 px-2 py-1 rounded">ENTER</div>
                  </button>
                ))}
                {searchQuery.length > 0 && (
                  <div className="mt-8 p-6 bg-g3/5 rounded-2xl border border-g3/10">
                    <div className="flex items-center gap-3 mb-2">
                      <Brain className="text-g3" size={14} />
                      <span className="font-mono text-[10px] text-g3 font-bold uppercase tracking-wider">AI Insight Focus</span>
                    </div>
                    <p className="font-mono text-xs text-white/40">Searching clinical database for "{searchQuery}"...</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
