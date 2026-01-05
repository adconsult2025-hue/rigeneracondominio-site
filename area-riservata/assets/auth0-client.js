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

export async function getAuth0() {
  if (auth0) return auth0;
  if (!window.createAuth0Client) throw new Error("Auth0 SDK not loaded");

  // Fail-fast se qualcuno rimette placeholder o configura male
  if (!AUTH0_CONFIG.domain || AUTH0_CONFIG.domain.includes("__")) {
    throw new Error("Auth0 domain non configurato (AUTH0_CONFIG.domain).");
  }
  if (!AUTH0_CONFIG.clientId || AUTH0_CONFIG.clientId.includes("__")) {
    throw new Error("Auth0 clientId non configurato (AUTH0_CONFIG.clientId).");
  }

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

