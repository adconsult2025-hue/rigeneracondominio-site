/**
 * Rigenera Condominio – Area Riservata (auth via SPA login)
 * - Guard pages: requires logged-in user.
 * - Wizard: Condominio-only (no target selection).
 * - Stores evaluations locally. Later: POST to platform.
 */

const STORAGE_KEY = "rigeneraCondominio:area:v1";
const DEV_USER = {
  id: "dev-mode-user",
  email: "dev@rigenera.local",
  name: "Developer Mode",
  role: "admin",
  dev: true
};

function nowISO(){ return new Date().toISOString(); }
function loadState(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }catch(e){ return {}; } }
function saveState(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

export function getUser(){
  const s = loadState();
  return s.user || DEV_USER;
}
export function setUser(user){
  const s = loadState();
  if(user){
    s.user = {
      id: user.id || user.sub || user.email || null,
      email: user.email || null,
      name: user.name || user.email || null,
      role: user.role || "admin",
      dev: true
    };
  }else{
    s.user = DEV_USER;
  }
  saveState(s);
}
export function clearUser(){ const s = loadState(); delete s.user; saveState(s); }

export function mountTopbar(){
  const user = getUser();
  const el = document.querySelector("#whoami");
  if(el) el.textContent = user ? (user.name || user.email) : "Ospite";
}

export function guardPage(){
  // DEV: disabilita guardia e consente sempre l’accesso all’area riservata.
  return true;
}

// Condominio-only wizard
export const WIZARD = [
  { id:"title_powers", question:"Il Condominio ha titolo/disponibilità dell’immobile e poteri decisionali attivabili (assemblea)?",
    yesNext:"delibera_possible", noNext:"stop_no_title",
    help:"Serve poter deliberare/mandatare e disporre dell’immobile (proprietà/gestione) per procedere." },
  { id:"delibera_possible", question:"È ragionevolmente ottenibile una delibera assembleare per avviare il percorso?",
    yesNext:"technical_feasible", noNext:"stop_no_delibera",
    help:"Se non c’è consenso, prima serve istruttoria e percorso informativo." },
  { id:"technical_feasible", question:"È tecnicamente possibile un intervento (anche parziale) sull’edificio/impianti?",
    yesNext:"ct_eligible", noNext:"cer_interest",
    help:"Esempi: PDC, impianti, involucro, FV, ottimizzazioni." },
  { id:"ct_eligible", question:"In prima analisi, l’intervento potrebbe essere ammissibile a Conto Termico 3.0?",
    yesNext:"accept_workflow", noNext:"alt_path",
    help:"Conferma reale solo in piattaforma con checklist e documenti." },
  { id:"accept_workflow", question:"Accettate un iter formale (documenti, tempi, regole GSE) senza garanzia di risultato?",
    yesNext:"need_finance", noNext:"alt_path",
    help:"CERtoUSER guida e riduce il rischio, ma non garantisce l’esito del GSE." },
  { id:"alt_path", question:"Valutereste un percorso alternativo (detrazioni, intervento light, sola gestione)?",
    yesNext:"need_finance", noNext:"cer_interest",
    help:"Se CT non è praticabile, possono esistere alternative." },
  { id:"need_finance", question:"Serve un finanziamento per avviare i lavori?",
    yesNext:"cer_interest", noNext:"cer_interest",
    help:"Serve per impostare ponte incentivi / SAL / canone." },
  { id:"cer_interest", question:"Volete valutare anche CER/CEC (condivisione energia su cabina primaria)?",
    yesNext:"accept_governance", noNext:"result_efficiency_only",
    help:"Compatibilità reale: POD e cabina primaria (verifica in piattaforma)." },
  { id:"accept_governance", question:"Volete che CERtoUSER prenda in carico il progetto (struttura di regia + governance)?",
    yesNext:"result_green", noNext:"result_limited_support",
    help:"La governance completa abilita contratti, workflow e rendicontazione." },

  { id:"stop_no_title", terminal:true, result:"stop_title" },
  { id:"stop_no_delibera", terminal:true, result:"stop_delibera" },
  { id:"result_efficiency_only", terminal:true, result:"efficiency" },
  { id:"result_limited_support", terminal:true, result:"limited" },
  { id:"result_green", terminal:true, result:"green" },
];
function getStepById(id){ return WIZARD.find(s=>s.id===id); }

export function getRuns(){
  const s = loadState();
  return Array.isArray(s.runs) ? s.runs : [];
}
export function upsertRun(run){
  const s = loadState();
  const runs = Array.isArray(s.runs) ? s.runs : [];
  const idx = runs.findIndex(r => r.id === run.id);
  if(idx >= 0) runs[idx] = run; else runs.unshift(run);
  s.runs = runs.slice(0, 50);
  saveState(s);
}
export function setActiveRunId(id){
  const s = loadState(); s.activeRunId = id; saveState(s);
}
export function getActiveRun(){
  const s = loadState();
  const runs = getRuns();
  const id = s.activeRunId;
  return runs.find(r => r.id === id) || runs[0] || null;
}

export function startNewRun(){
  const user = getUser();
  const id = "run_" + Math.random().toString(36).slice(2,10) + "_" + Date.now();
  const run = {
    id, user_id:user.id, created_at:nowISO(), updated_at:nowISO(),
    status:"in_progress", current_step:"title_powers", answers:{}, notes:"", result:null
  };
  upsertRun(run); setActiveRunId(id); return run;
}
export function answerStep(stepId, value){
  const run = getActiveRun();
  if(!run) return null;
  run.answers[stepId] = value;
  run.updated_at = nowISO();
  const step = getStepById(stepId);
  let nextId = null;
  if(step && value === true) nextId = step.yesNext;
  else if(step && value === false) nextId = step.noNext;

  if(nextId){
    const next = getStepById(nextId);
    if(next && next.terminal){
      run.status="completed"; run.current_step=nextId; run.result=next.result;
    }else{
      run.current_step = nextId;
    }
  }
  upsertRun(run);
  return run;
}
export function getCurrentStep(){
  const run = getActiveRun();
  if(!run) return null;
  return getStepById(run.current_step) || null;
}
export function computeBadge(run){
  if(run.status !== "completed") return { cls:"warn", label:"In corso" };
  if(run.result === "stop_title") return { cls:"bad", label:"Non procedibile: titolo/poteri" };
  if(run.result === "stop_delibera") return { cls:"bad", label:"Non procedibile: delibera" };
  if(run.result === "efficiency") return { cls:"warn", label:"Percorso ridotto" };
  if(run.result === "limited") return { cls:"warn", label:"Supporto limitato" };
  if(run.result === "green") return { cls:"ok", label:"Procedibile" };
  return { cls:"warn", label:"—" };
}
