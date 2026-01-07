/**
 * Env vars required:
 * - RESEND_API_KEY
 * - LEADS_TO_EMAIL
 * - LEADS_FROM_EMAIL
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS, POST"
};

const MAX_BODY_BYTES = 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimitStore = new Map();

function json(statusCode, body){
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

function logError(where, type){
  console.error(`[${where}] ${type}`);
}

function errorResponse(statusCode, where, error, hint){
  logError(where, error);
  return json(statusCode, { ok:false, where, error, hint });
}

function getBodyBytes(event){
  if(!event.body) return 0;
  if(event.isBase64Encoded){
    return Buffer.from(event.body, "base64").length;
  }
  return Buffer.byteLength(event.body, "utf8");
}

function escapeHtml(value){
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getClientIp(event){
  const header = event.headers["x-forwarded-for"] || event.headers["X-Forwarded-For"] || "";
  const ip = header.split(",")[0].trim();
  return ip || event.headers["x-real-ip"] || event.headers["X-Real-IP"] || "unknown";
}

function isValidEmail(value){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidPhone(value){
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 7;
}

function getNextSteps(result){
  switch(result){
    case "stop_title":
      return "Integrare titolo/poteri e valutare alternative praticabili.";
    case "stop_delibera":
      return "Preparare percorso informativo e ripetere valutazione dopo consenso.";
    case "efficiency":
      return "Valutare sopralluogo tecnico minimo e percorso alternativo.";
    case "limited":
      return "Validare requisiti e documenti per fase operativa.";
    case "green":
      return "Attivare piattaforma e avviare checklist documentale.";
    default:
      return "Verifica preliminare e indicazioni operative.";
  }
}

exports.handler = async (event) => {
  const where = "lead-submit";
  try{
    if(event.httpMethod === "OPTIONS"){
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    if(event.httpMethod !== "POST"){
      return errorResponse(405, where, "method_not_allowed", "Use POST.");
    }

    if(getBodyBytes(event) > MAX_BODY_BYTES){
      return errorResponse(413, where, "payload_too_large", "Reduce request size.");
    }

    let payload;
    try{
      payload = JSON.parse(event.body || "{}");
    }catch(e){
      return errorResponse(400, where, "invalid_json", "Check JSON payload.");
    }

    const { contact, run, attachments = [], meta = {}, leadId, leadCode, honeypot, failedAttachments = [] } = payload || {};
    const resolvedLeadCode = leadCode || "";
    if(honeypot){
      return errorResponse(400, where, "spam_detected", "Honeypot triggered.");
    }
    if(!contact?.name || !contact?.email || !contact?.phone || !run?.answers){
      return errorResponse(400, where, "missing_required_fields", "Provide contact and run data.");
    }
    if(!isValidEmail(contact.email) || !isValidPhone(contact.phone)){
      return errorResponse(400, where, "invalid_contact_fields", "Check email and phone.");
    }

    const ip = getClientIp(event);
    const now = Date.now();
    const entries = rateLimitStore.get(ip) || [];
    const freshEntries = entries.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
    if(freshEntries.length >= RATE_LIMIT_MAX){
      return errorResponse(429, where, "rate_limited", "Retry later.");
    }
    freshEntries.push(now);
    rateLimitStore.set(ip, freshEntries);

    const resendKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.LEADS_TO_EMAIL;
    const fromEmail = process.env.LEADS_FROM_EMAIL;
    const missingEnv = ["RESEND_API_KEY", "LEADS_TO_EMAIL", "LEADS_FROM_EMAIL"]
      .filter((key) => !process.env[key]);

    if(missingEnv.length){
      return errorResponse(
        500,
        where,
        `missing_env: ${missingEnv.join(", ")}`,
        "Set required environment variables."
      );
    }

    const safeContact = {
      name: escapeHtml(contact.name),
      email: escapeHtml(contact.email),
      phone: escapeHtml(contact.phone),
      condo: escapeHtml(contact.condo),
      city: escapeHtml(contact.city)
    };

    const runResult = escapeHtml(run.result || "-");
    const runStep = escapeHtml(run.current_step || "-");
    const answersJson = escapeHtml(JSON.stringify(run.answers, null, 2));
    const nextStepsText = escapeHtml(getNextSteps(run.result));
    const metaHtml = `
      <ul>
        <li><strong>Lead Code:</strong> ${escapeHtml(resolvedLeadCode || "-")}</li>
        <li><strong>Lead ID:</strong> ${escapeHtml(leadId || "-")}</li>
        <li><strong>URL pagina:</strong> ${escapeHtml(meta.pageUrl || "-")}</li>
        <li><strong>Timestamp:</strong> ${escapeHtml(meta.ts || "-")}</li>
        <li><strong>User Agent:</strong> ${escapeHtml(meta.userAgent || "-")}</li>
      </ul>
    `;

    const attachmentsHtml = Array.isArray(attachments) && attachments.length
      ? `<ul>${attachments.map((item) => {
        const name = escapeHtml(item.name || "Allegato");
        const url = escapeHtml(item.signedReadUrl || "");
        return url ? `<li><a href="${url}" target="_blank" rel="noreferrer">${name}</a></li>` : `<li>${name}</li>`;
      }).join("")}</ul>`
      : "<p>Nessun allegato.</p>";

    const failedAttachmentsHtml = Array.isArray(failedAttachments) && failedAttachments.length
      ? `<ul>${failedAttachments.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul>`
      : "<p>Nessun allegato fallito.</p>";

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a;">
        <h2>Nuova richiesta contatto</h2>
        <p><strong>Codice pratica:</strong> ${escapeHtml(resolvedLeadCode || "-")}</p>
        <h3>Contatti</h3>
        <ul>
          <li><strong>Nome:</strong> ${safeContact.name}</li>
          <li><strong>Email:</strong> ${safeContact.email}</li>
          <li><strong>Telefono:</strong> ${safeContact.phone}</li>
          <li><strong>Condominio/Indirizzo:</strong> ${safeContact.condo || "-"}</li>
          <li><strong>Città:</strong> ${safeContact.city || "-"}</li>
        </ul>
        <h3>Esito e Prossimi Passi</h3>
        <ul>
          <li><strong>Esito:</strong> ${runResult}</li>
          <li><strong>Step:</strong> ${runStep}</li>
          <li><strong>Prossimi passi:</strong> ${nextStepsText}</li>
        </ul>
        <h3>Allegati</h3>
        ${attachmentsHtml}
        <p><em>I link agli allegati scadono dopo 7 giorni.</em></p>
        <h3>Failed attachments</h3>
        ${failedAttachmentsHtml}
        <h3>JSON risposte</h3>
        <pre style="background:#f1f5f9; padding:12px; border-radius:8px; font-size:12px; white-space:pre-wrap;">${answersJson}</pre>
        <h3>Meta</h3>
        ${metaHtml}
      </div>
    `;

    try{
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: `Lead Rigenera Condominio | ${resolvedLeadCode || "-"} | Esito: ${runResult} | ${safeContact.name} | ${safeContact.city || "-"}`,
          html
        })
      });

      if(!res.ok){
        const errorText = await res.text();
        const trimmed = errorText.slice(0, 500);
        return errorResponse(502, where, trimmed || "resend_failed", "Check Resend API response.");
      }

      return json(200, { ok:true, leadCode: resolvedLeadCode });
    }catch(e){
      const message = String(e?.message || e).slice(0, 500);
      return errorResponse(500, where, message || "unexpected_error", "Check server logs.");
    }
  }catch(e){
    const message = String(e?.message || e).slice(0, 500);
    return errorResponse(500, where, message || "unexpected_error", "Unhandled error.");
  }
};
