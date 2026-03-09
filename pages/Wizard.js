import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const WIZARD_FLOW = {
  start: {
    question: "Quale aspetto del condominio vuoi migliorare?",
    answers: [
      { label: "Efficienza energetica", next: "energyType", category: "energia" },
      { label: "Stato delle facciate", next: "facciataType", category: "facciate" },
      { label: "Impermeabilizzazione copertura", next: "impermeabilizzazione", category: "impermeabilizzazione" },
      { label: "Lavori strutturali", next: "strutturaType", category: "strutturale" },
    ]
  },
  impermeabilizzazione: {
    question: "Qual è lo stato attuale della copertura?",
    answers: [
      { label: "Infiltrazioni d'acqua", next: "urgency", detail: "Infiltrazioni d'acqua" },
      { label: "Danni visibili", next: "urgency", detail: "Danni visibili" },
      { label: "Rifacimento preventivo", next: "urgency", detail: "Rifacimento preventivo" },
    ]
  },
  energyType: {
    question: "Cosa ti interessa principalmente?",
    answers: [
      { label: "Isolamento termico", next: "detailsEnergy", detail: "Isolamento termico" },
      { label: "Impianto di riscaldamento", next: "detailsEnergy", detail: "Impianto di riscaldamento" },
      { label: "Pannelli solari/fotovoltaico", next: "detailsEnergy", detail: "Pannelli solari" },
      { label: "Finestre e serramenti", next: "detailsEnergy", detail: "Finestre e serramenti" },
    ]
  },
  facciataType: {
    question: "Qual è lo stato attuale della facciata?",
    answers: [
      { label: "Necessita di pulizia", next: "detailsFacciata", detail: "Pulizia facciata" },
      { label: "Crepe e danni minori", next: "detailsFacciata", detail: "Danni minori" },
      { label: "Rifacimento completo", next: "detailsFacciata", detail: "Rifacimento" },
    ]
  },
  strutturaType: {
    question: "Qual è il tipo di lavoro richiesto?",
    answers: [
      { label: "Ascensore", next: "detailsStruttura", detail: "Ascensore" },
      { label: "Balconi/cornicioni", next: "detailsStruttura", detail: "Balconi/cornicioni" },
      { label: "Impermeabilizzazione", next: "detailsStruttura", detail: "Impermeabilizzazione" },
      { label: "Altro", next: "detailsStruttura", detail: "Altro lavoro strutturale" },
    ]
  },
  detailsEnergy: {
    question: "Quante unità abitative ha il condominio?",
    answers: [
      { label: "Fino a 5", next: "urgency", units: "1-5" },
      { label: "6-20", next: "urgency", units: "6-20" },
      { label: "Oltre 20", next: "urgency", units: "20+" },
    ]
  },
  detailsFacciata: {
    question: "Quante unità abitative ha il condominio?",
    answers: [
      { label: "Fino a 5", next: "urgency", units: "1-5" },
      { label: "6-20", next: "urgency", units: "6-20" },
      { label: "Oltre 20", next: "urgency", units: "20+" },
    ]
  },
  detailsStruttura: {
    question: "Quante unità abitative ha il condominio?",
    answers: [
      { label: "Fino a 5", next: "urgency", units: "1-5" },
      { label: "6-20", next: "urgency", units: "6-20" },
      { label: "Oltre 20", next: "urgency", units: "20+" },
    ]
  },
  urgency: {
    question: "Quanto è urgente l'intervento?",
    answers: [
      { label: "Urgente (entro 3 mesi)", next: "contact", urgency: "urgente" },
      { label: "A breve (3-6 mesi)", next: "contact", urgency: "breve" },
      { label: "Da pianificare", next: "contact", urgency: "pianificato" },
    ]
  },
  contact: {
    question: "Inserisci i tuoi dati di contatto",
    type: "form"
  }
};

export default function Wizard() {
  const [currentStep, setCurrentStep] = useState("start");
  const [responses, setResponses] = useState({});
  const [contactForm, setContactForm] = useState({ nome: "", email: "", telefono: "", comune: "" });
  const [review, setReview] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const step = WIZARD_FLOW[currentStep];

  const handleAnswer = (answer) => {
    const newResponses = { ...responses, [currentStep]: answer };
    setResponses(newResponses);

    if (answer.next === "contact") {
      setCurrentStep("contact");
    } else {
      setCurrentStep(answer.next);
    }
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    setReview(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    await submitLead();
    setLoading(false);
  };

  const submitLead = async () => {
    try {
      const startAnswer = responses.start;
      const tipologia = startAnswer.category;
      const messaggio = buildMessage(responses);

      const leadData = {
        nome: contactForm.nome,
        email: contactForm.email,
        telefono: contactForm.telefono,
        comune: contactForm.comune,
        tipologia: tipologia === "energia" ? "Efficientamento" : tipologia === "facciate" ? "Facciate" : tipologia === "impermeabilizzazione" ? "Impermeabilizzazione" : "Strutturale",
        messaggio: messaggio,
        fonte: "wizard"
      };

      await base44.functions.invoke("submitLead", leadData);
      setSubmitted(true);
    } catch (error) {
      console.error("Errore durante la creazione del lead:", error);
    }
  };

  const buildMessage = (allResponses) => {
    const parts = [];
    Object.entries(allResponses).forEach(([key, value]) => {
      if (value.label) parts.push(value.label);
      if (value.detail) parts.push(`- ${value.detail}`);
      if (value.units) parts.push(`Unità: ${value.units}`);
      if (value.urgency) parts.push(`Urgenza: ${value.urgency}`);
    });
    return parts.join("\n");
  };

  const progress = (Object.keys(responses).length / Object.keys(WIZARD_FLOW).length) * 100;

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0d1a0e] text-white pt-20">
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="text-[#3dfb6e] text-6xl mb-4">✓</div>
          <h1 className="text-3xl font-bold mb-2">Richiesta inviata!</h1>
          <p className="text-gray-400 mb-8">Grazie per aver completato l'assessment. Un nostro consulente ti contatterà a breve.</p>
          <Link to={createPageUrl("Home")} className="inline-block bg-[#3dfb6e] text-[#0d1a0e] px-6 py-2 rounded-full font-semibold hover:opacity-85 transition-opacity">
            Torna alla home
          </Link>
        </div>
      </div>
    );
  }

  if (review) {
    return (
      <div className="min-h-screen bg-[#0d1a0e] text-white pt-20 pb-20">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Riepilogo della tua richiesta</h1>
          <p className="text-gray-400 mb-10">Controlla tutte le tue scelte prima di inviare</p>

          <div className="space-y-6">
            <div className="border border-white/10 rounded-xl p-6 bg-white/5">
              <h3 className="text-lg font-semibold text-[#3dfb6e] mb-4">Dati di contatto</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Nome</p>
                  <p className="font-medium">{contactForm.nome}</p>
                </div>
                <div>
                  <p className="text-gray-400">Email</p>
                  <p className="font-medium">{contactForm.email}</p>
                </div>
                <div>
                  <p className="text-gray-400">Telefono</p>
                  <p className="font-medium">{contactForm.telefono || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-400">Comune</p>
                  <p className="font-medium">{contactForm.comune || "-"}</p>
                </div>
              </div>
            </div>

            <div className="border border-white/10 rounded-xl p-6 bg-white/5">
              <h3 className="text-lg font-semibold text-[#3dfb6e] mb-4">Assessment</h3>
              <div className="space-y-3">
                {Object.entries(responses).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-3 pb-3 border-b border-white/10 last:border-0">
                    <span className="text-[#3dfb6e] font-bold">•</span>
                    <div>
                      <p className="text-gray-400 text-sm uppercase tracking-wide">{key}</p>
                      <p className="font-medium">{value.label}</p>
                      {value.detail && <p className="text-sm text-gray-300 mt-1">{value.detail}</p>}
                      {value.units && <p className="text-sm text-gray-300 mt-1">Unità: {value.units}</p>}
                      {value.urgency && <p className="text-sm text-gray-300 mt-1">Urgenza: {value.urgency}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setReview(false)}
                className="flex-1 border border-white/20 rounded-xl px-6 py-3 font-semibold hover:border-white/40 transition-colors"
              >
                Modifica risposte
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 bg-[#3dfb6e] text-[#0d1a0e] rounded-xl px-6 py-3 font-semibold hover:opacity-85 transition-opacity disabled:opacity-60"
              >
                {loading ? "Invio..." : "Invia richiesta"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === "contact") {
    return (
      <div className="min-h-screen bg-[#0d1a0e] text-white pt-20 pb-20">
        <div className="max-w-2xl mx-auto px-4">
          <Link to={createPageUrl("Home")} className="text-gray-400 hover:text-[#3dfb6e] flex items-center gap-2 text-sm mb-10">
            <Home size={16} /> Torna alla home
          </Link>

          <h1 className="text-3xl md:text-4xl font-bold mb-2">Ultimi passi</h1>
          <p className="text-gray-400 mb-8">Inserisci i tuoi dati per completare la richiesta</p>

          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nome e Cognome *</label>
                <input
                  type="text"
                  required
                  value={contactForm.nome}
                  onChange={e => setContactForm({ ...contactForm, nome: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3dfb6e]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={contactForm.email}
                  onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3dfb6e]/50"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Telefono</label>
                <input
                  type="tel"
                  value={contactForm.telefono}
                  onChange={e => setContactForm({ ...contactForm, telefono: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3dfb6e]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Comune / Provincia</label>
                <input
                  type="text"
                  value={contactForm.comune}
                  onChange={e => setContactForm({ ...contactForm, comune: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3dfb6e]/50"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep("urgency")}
                className="flex-1 border border-white/20 rounded-xl px-6 py-3 font-semibold hover:border-white/40 transition-colors"
              >
                Indietro
              </button>
              <button
                type="submit"
                className="flex-1 bg-[#3dfb6e] text-[#0d1a0e] rounded-xl px-6 py-3 font-semibold hover:opacity-85 transition-opacity"
              >
                Continua
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1a0e] text-white pt-20 pb-20">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-10">
          <Link to={createPageUrl("Home")} className="text-gray-400 hover:text-[#3dfb6e] flex items-center gap-2 text-sm mb-6">
            <Home size={16} /> Torna alla home
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Percorso guidato</h1>
          <p className="text-gray-400">Rispondi a poche domande per ricevere un'analisi personalizzata</p>
        </div>

        <div className="mb-8">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3dfb6e] transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{Math.round(progress)}% completato</p>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-8">{step.question}</h2>

          <div className="flex flex-col gap-3">
            {step.answers.map((answer, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(answer)}
                className="group relative p-4 border border-white/20 rounded-xl text-left hover:border-[#3dfb6e]/50 hover:bg-white/5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{answer.label}</span>
                  <ChevronRight size={20} className="text-gray-400 group-hover:text-[#3dfb6e] transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {Object.keys(responses).length > 0 && (
          <div className="border-t border-white/10 pt-8">
            <p className="text-xs text-gray-500 mb-3">Le tue scelte:</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(responses).map(([key, value]) => (
                <div key={key} className="bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs text-gray-300">
                  {value.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}