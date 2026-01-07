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

function json(statusCode, body){
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
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

export const handler = async (event) => {
  if(event.httpMethod === "OPTIONS"){
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if(event.httpMethod !== "POST"){
    return json(405, { ok:false, error:"method_not_allowed" });
  }

  if(getBodyBytes(event) > MAX_BODY_BYTES){
    return json(413, { ok:false, error:"payload_too_large" });
  }

  let payload;
  try{
    payload = JSON.parse(event.body || "{}");
  }catch(e){
    return json(400, { ok:false, error:"invalid_json" });
  }

  const { contact, run, attachments = [], meta = {}, leadId } = payload || {};
  if(!contact?.name || !contact?.email || !contact?.phone || !run?.answers){
    return json(400, { ok:false, error:"missing_required_fields" });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.LEADS_TO_EMAIL;
  const fromEmail = process.env.LEADS_FROM_EMAIL;

  if(!resendKey || !toEmail || !fromEmail){
    return json(500, { ok:false, error:"missing_env" });
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
  const metaHtml = `
    <ul>
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

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a;">
      <h2>Nuova richiesta contatto</h2>
      <h3>Contatti</h3>
      <ul>
        <li><strong>Nome:</strong> ${safeContact.name}</li>
        <li><strong>Email:</strong> ${safeContact.email}</li>
        <li><strong>Telefono:</strong> ${safeContact.phone}</li>
        <li><strong>Condominio/Indirizzo:</strong> ${safeContact.condo || "-"}</li>
        <li><strong>Città:</strong> ${safeContact.city || "-"}</li>
      </ul>
      <h3>Esito</h3>
      <ul>
        <li><strong>Esito:</strong> ${runResult}</li>
        <li><strong>Step:</strong> ${runStep}</li>
      </ul>
      <h3>Risposte</h3>
      <pre style="background:#f1f5f9; padding:12px; border-radius:8px; font-size:12px; white-space:pre-wrap;">${answersJson}</pre>
      <h3>Allegati</h3>
      ${attachmentsHtml}
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
        subject: `Nuova richiesta contatto - ${contact.name}`,
        html
      })
    });

    if(!res.ok){
      const errorText = await res.text();
      const trimmed = errorText.slice(0, 500);
      return json(502, { ok:false, error: trimmed || "resend_failed" });
    }

    return json(200, { ok:true });
  }catch(e){
    const message = String(e?.message || e).slice(0, 500);
    return json(500, { ok:false, error: message || "unexpected_error" });
  }
};
