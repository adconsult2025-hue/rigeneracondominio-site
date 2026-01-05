export const AUTH0_CONFIG = {
  // Presi dalla tua dashboard Auth0 (Application: "My App")
  // Domain: dev-sd0i4b38321bzjsu.us.auth0.com
  // Client ID: 6QrVNe93squTZg6sHBptxeoTuXUVQWj7
  domain: "dev-sd0i4b38321bzjsu.us.auth0.com",
  clientId: "6QrVNe93squTZg6sHBptxeoTuXUVQWj7",
  authorizationParams: {
    // Usa l'origin corrente (evita hardcode e problemi se provi su preview/staging)
    redirect_uri: `${window.location.origin}/area-riservata/callback.html`,
    audience: undefined
  },
  cacheLocation: "localstorage",
  useRefreshTokens: true
};

let auth0 = null;

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    // già presente?
    const existing = Array.from(document.scripts || []).find(s => s.src === src);
    if (existing && (window.createAuth0Client || existing.dataset.loaded === "1")) return resolve(true);

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => { s.dataset.loaded = "1"; resolve(true); };
    s.onerror = (e) => reject(new Error(`Impossibile caricare SDK Auth0 da: ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureAuth0SdkLoaded() {
  if (window.createAuth0Client) return true;

  // Prova CDN ufficiale, poi fallback su unpkg
  const sources = [
    "https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js",
    "https://unpkg.com/@auth0/auth0-spa-js@2.0.3/dist/auth0-spa-js.production.js"
  ];

  let lastErr = null;
  for (const src of sources) {
    try {
      await loadScriptOnce(src);
      if (window.createAuth0Client) return true;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Auth0 SDK non disponibile (createAuth0Client mancante).");
}

export async function getAuth0() {
  if (auth0) return auth0;

  // Fail-fast se qualcuno rimette placeholder o configura male
  if (!AUTH0_CONFIG.domain || AUTH0_CONFIG.domain.includes("__")) {
    throw new Error("Auth0 domain non configurato (AUTH0_CONFIG.domain).");
  }
  if (!AUTH0_CONFIG.clientId || AUTH0_CONFIG.clientId.includes("__")) {
    throw new Error("Auth0 clientId non configurato (AUTH0_CONFIG.clientId).");
  }

  // Garantisce che lo SDK sia caricato anche se lo <script> in pagina manca/è bloccato/arriva tardi
  await ensureAuth0SdkLoaded();
  if (!window.createAuth0Client) throw new Error("Auth0 SDK not loaded (createAuth0Client undefined).");

  auth0 = await window.createAuth0Client(AUTH0_CONFIG);
  return auth0;
}

export async function login(targetUrl = "/area-riservata/dashboard.html") {
  const a0 = await getAuth0();
  await a0.loginWithRedirect({
    appState: { targetUrl }
  });
}

export async function logout(returnTo = `${window.location.origin}/area-riservata/`) {
  const a0 = await getAuth0();
  a0.logout({ logoutParams: { returnTo } });
}

export async function isAuthed() {
  const a0 = await getAuth0();
  return await a0.isAuthenticated();
}

export async function getUser() {
  const a0 = await getAuth0();
  const ok = await a0.isAuthenticated();
  if (!ok) return null;
  return await a0.getUser();
}

export async function handleCallback() {
  const a0 = await getAuth0();
  const result = await a0.handleRedirectCallback();
  return result;
}
