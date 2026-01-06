const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS, POST"
};

function json(statusCode, body){
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

export const handler = async (event) => {
  if(event.httpMethod === "OPTIONS"){
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if(event.httpMethod !== "POST"){
    return json(405, { ok:false, error:"method_not_allowed" });
  }

  let payload;
  try{
    payload = JSON.parse(event.body || "{}");
  }catch(e){
    return json(400, { ok:false, error:"invalid_json" });
  }

  const { contact, run } = payload || {};
  if(!contact?.email || !contact?.phone || !run?.answers){
    return json(400, { ok:false, error:"missing_required_fields" });
  }

  console.log("[lead-submit] payload", JSON.stringify({
    contact,
    run: {
      id: run.id,
      status: run.status,
      current_step: run.current_step,
      result: run.result,
      answers_keys: run.answers ? Object.keys(run.answers) : []
    },
    meta: {
      userAgent: payload.userAgent,
      pageUrl: payload.pageUrl,
      ts: payload.ts
    }
  }));

  return json(200, { ok:true });
};
