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
const DEV_USER = {
  role: "admin",
  dev: true,
  email: "dev@rigenera.local",
  name: "Developer Mode",
  sub: "dev-mode-user"
};

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    // già presente?
    const existing = Array.from(document.scripts || []).find(s => s.src === src);
    if (existing && (window.createAuth0Client || existing.dataset.loaded === "1")) return resolve(true);

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    // IMPORTANT: non impostare crossOrigin qui.
    // Su alcuni CDN l'attributo crossOrigin forza CORS e può bloccare lo script
    // se il server non invia Access-Control-Allow-Origin.
    s.onload = () => { s.dataset.loaded = "1"; resolve(true); };
    s.onerror = (e) => reject(new Error(`Impossibile caricare SDK Auth0 da: ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureAuth0SdkLoaded() {
  if (window.createAuth0Client) return true;

  // SOLO locale (same-origin) per evitare qualsiasi blocco CORS/policy su CDN esterni
  const local = `${window.location.origin}/area-riservata/assets/vendor/auth0-spa-js.production.js`;
  const sources = [ local ];

  let lastErr = null;
  for (const src of sources) {
    try {
      await loadScriptOnce(src);
      if (window.__AUTH0_SDK_PLACEHOLDER__) {
        throw new Error("Auth0 SDK placeholder rilevato: sostituisci assets/vendor/auth0-spa-js.production.js con il bundle ufficiale v2.0.3.");
      }
      if (window.createAuth0Client) return true;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Auth0 SDK non disponibile (createAuth0Client mancante).");
}

export async function getAuth0() {
  if (auth0) return auth0;

  // DEV: bypass completo Auth0, forzando client fittizio già autenticato.
  // Il blocco originale rimane commentato per il ripristino futuro.
  /*
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
  */
  auth0 = {
    loginWithRedirect: async ({ appState } = {}) => {
      // DEV: niente redirect verso login per rendere l’area pubblica temporaneamente.
      console.info("[DEV MODE] login bypassed", appState);
      return true;
    },
    logout: async () => {
      console.info("[DEV MODE] logout bypassed");
      return true;
    },
    isAuthenticated: async () => true,
    getUser: async () => DEV_USER,
    handleRedirectCallback: async () => ({ appState: { targetUrl: "/area-riservata/dashboard.html" } })
  };
  return auth0;
}

export async function login(targetUrl = "/area-riservata/dashboard.html") {
  const a0 = await getAuth0();
  // DEV: disabilita redirect verso login mantenendo compatibilità per il ripristino.
  // await a0.loginWithRedirect({ appState: { targetUrl } });
  console.info("[DEV MODE] login() chiamato, redirect disabilitato", { targetUrl });
}

export async function logout(returnTo = `${window.location.origin}/area-riservata/`) {
  const a0 = await getAuth0();
  // DEV: logout disabilitato per evitare redirezioni e lasciare l’utente sempre autenticato.
  // a0.logout({ logoutParams: { returnTo } });
  console.info("[DEV MODE] logout() chiamato, nessun redirect", { returnTo });
}

export async function isAuthed() {
  // DEV: forza autenticazione sempre vera.
  return true;
}

export async function getUser() {
  // DEV: restituisce sempre utente mock amministratore.
  return DEV_USER;
}

export async function handleCallback() {
  const a0 = await getAuth0();
  // DEV: nessuna gestione reale della callback, restituisce appState fittizio.
  return await a0.handleRedirectCallback();
}
