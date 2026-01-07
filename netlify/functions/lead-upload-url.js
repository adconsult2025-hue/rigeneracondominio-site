/**
 * Env vars required:
 * - GCS_BUCKET
 * - GCS_SA_KEY_JSON
 * - GCS_PROJECT_ID (optional)
 */

import crypto from "crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS, POST"
};

const MAX_BODY_BYTES = 1024 * 1024;
const UPLOAD_EXPIRES_SECONDS = 15 * 60;
const READ_EXPIRES_SECONDS = 7 * 24 * 60 * 60;
const ALLOWED_CONTENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

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

function encodeRFC3986(value){
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodePath(path){
  return path.split("/").map(segment => encodeRFC3986(segment)).join("/");
}

function sha256Hex(value){
  return crypto.createHash("sha256").update(value).digest("hex");
}

function signString(privateKey, value){
  return crypto.createSign("RSA-SHA256").update(value).sign(privateKey, "hex");
}

function sanitizeLeadId(value){
  return String(value || "").replace(/[^a-zA-Z0-9-_]/g, "");
}

function sanitizeFilename(value){
  const base = String(value || "").split(/[\\/]/).pop() || "file";
  const parts = base.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const namePart = parts.join(".") || "file";
  const safeName = namePart.replace(/[^a-zA-Z0-9-_]/g, "_").replace(/_+/g, "_");
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "");
  return safeExt ? `${safeName}.${safeExt}` : safeName;
}

function formatDateParts(date = new Date()){
  const iso = date.toISOString();
  const dateStamp = iso.slice(0, 10).replace(/-/g, "");
  const timeStamp = iso.replace(/[:-]/g, "").replace(/\.\d{3}Z$/, "Z");
  return { dateStamp, timeStamp };
}

function buildSignedUrl({
  method,
  bucket,
  objectPath,
  expires,
  contentType,
  clientEmail,
  privateKey,
  dateStamp,
  timeStamp
}){
  const host = "storage.googleapis.com";
  const canonicalUri = `/${bucket}/${encodePath(objectPath)}`;
  const signedHeaders = contentType ? "content-type;host" : "host";
  const canonicalHeaders = contentType
    ? `content-type:${contentType}\nhost:${host}\n`
    : `host:${host}\n`;

  const scope = `${dateStamp}/auto/storage/goog4_request`;
  const credential = `${clientEmail}/${scope}`;
  const queryParams = {
    "X-Goog-Algorithm": "GOOG4-RSA-SHA256",
    "X-Goog-Credential": credential,
    "X-Goog-Date": timeStamp,
    "X-Goog-Expires": String(expires),
    "X-Goog-SignedHeaders": signedHeaders
  };

  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map((key) => `${encodeRFC3986(key)}=${encodeRFC3986(queryParams[key])}`)
    .join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD"
  ].join("\n");

  const stringToSign = [
    "GOOG4-RSA-SHA256",
    timeStamp,
    scope,
    sha256Hex(canonicalRequest)
  ].join("\n");

  const signature = signString(privateKey, stringToSign);
  const signedQuery = `${canonicalQueryString}&X-Goog-Signature=${signature}`;
  return `https://${host}${canonicalUri}?${signedQuery}`;
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

  const { leadId, filename, contentType } = payload || {};
  if(!leadId || !filename){
    return json(400, { ok:false, error:"missing_required_fields" });
  }
  if(contentType && !ALLOWED_CONTENT_TYPES.has(contentType)){
    return json(400, { ok:false, error:"invalid_content_type" });
  }

  const bucket = process.env.GCS_BUCKET;
  const keyJson = process.env.GCS_SA_KEY_JSON;

  if(!bucket || !keyJson){
    return json(500, { ok:false, error:"missing_env" });
  }

  let key;
  try{
    key = JSON.parse(keyJson);
  }catch(e){
    return json(500, { ok:false, error:"invalid_service_account" });
  }

  const clientEmail = key.client_email;
  const privateKey = key.private_key;
  if(!clientEmail || !privateKey){
    return json(500, { ok:false, error:"invalid_service_account" });
  }

  const safeLeadId = sanitizeLeadId(leadId);
  if(!safeLeadId){
    return json(400, { ok:false, error:"invalid_lead_id" });
  }

  const safeFilename = sanitizeFilename(filename);
  const { dateStamp, timeStamp } = formatDateParts();
  const datePrefix = `${dateStamp.slice(0, 4)}-${dateStamp.slice(4, 6)}-${dateStamp.slice(6, 8)}`;
  const objectPath = `leads/${datePrefix}/${safeLeadId}/${safeFilename}`;
  const resolvedContentType = contentType || "application/octet-stream";

  try{
    const signedUploadUrl = buildSignedUrl({
      method: "PUT",
      bucket,
      objectPath,
      expires: UPLOAD_EXPIRES_SECONDS,
      contentType: resolvedContentType,
      clientEmail,
      privateKey,
      dateStamp,
      timeStamp
    });

    const signedReadUrl = buildSignedUrl({
      method: "GET",
      bucket,
      objectPath,
      expires: READ_EXPIRES_SECONDS,
      contentType: "",
      clientEmail,
      privateKey,
      dateStamp,
      timeStamp
    });

    return json(200, {
      ok: true,
      gcsPath: objectPath,
      signedUploadUrl,
      signedReadUrl
    });
  }catch(e){
    return json(500, { ok:false, error:"signing_failed" });
  }
};
