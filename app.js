
// EV6Planner — app.js
// Auth MSAL avec configuration locale (IndexedDB), aucun secret publié.
// Placeholders OpenChargeMap & IA. Compatible iOS Safari.

import { PublicClientApplication } from "https://cdn.jsdelivr.net/npm/@azure/msal-browser/+esm";

// ------- IndexedDB utilitaires simples ---------
const DB_NAME = 'ev6planner-db';
const STORE = 'config';
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbGet(key) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}
function idbSet(key, val) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.put(val, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  }));
}

// ------- Crypto (AES-GCM) pour clé HF ---------
async function deriveKey(passphrase) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('ev6planner'), iterations: 100000, hash: 'SHA-256' },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']
  );
}
async function encryptSecret(secret, passphrase) {
  if (!secret) return null;
  const key = await deriveKey(passphrase || '');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secret));
  return { iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) };
}
async function decryptSecret(bundle, passphrase) {
  if (!bundle) return null;
  const key = await deriveKey(passphrase || '');
  const iv = new Uint8Array(bundle.iv);
  const ct = new Uint8Array(bundle.ct);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// ------- Éléments UI ---------
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const eventsContainer = document.getElementById('events');
const cfgClientId = document.getElementById('cfgClientId');
const cfgTenant = document.getElementById('cfgTenant');
const cfgHfKey = document.getElementById('cfgHfKey');
const cfgPass = document.getElementById('cfgPass');
const saveCfgBtn = document.getElementById('saveCfgBtn');
const importCfgBtn = document.getElementById('importCfgBtn');
const importCfgFile = document.getElementById('importCfgFile');
const exportCfgBtn = document.getElementById('exportCfgBtn');
const cfgStatus = document.getElementById('cfgStatus');

let msalInstance = null;
const loginRequest = { scopes: ['User.Read', 'Calendars.Read'] };

// Boot : charge config locale, initialise MSAL, attache handlers
(async function boot() {
  const stored = await idbGet('app-config');
  if (stored && stored.clientId) {
    cfgClientId.value = stored.clientId || '';
    cfgTenant.value = stored.tenant || 'common';
    cfgStatus.textContent = 'Configuration trouvée en local. Vous pouvez vous connecter.';
    await initMsal(stored);
  } else {
    cfgStatus.textContent = 'Aucun paramètre trouvé — renseignez au moins le Client ID puis Enregistrer.';
  }
})();

async function initMsal(cfg) {
  const msalConfig = {
    auth: {
      clientId: cfg.clientId,
      authority: `https://login.microsoftonline.com/${cfg.tenant || 'common'}`,
      redirectUri: window.location.origin
    },
    cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: true }
  };
  msalInstance = new PublicClientApplication(msalConfig);

  loginBtn.onclick = () => msalInstance.loginRedirect(loginRequest);
  logoutBtn.onclick = () => msalInstance.logoutRedirect();

  msalInstance.handleRedirectPromise().then(async (resp) => {
    if (resp) msalInstance.setActiveAccount(resp.account);
    const account = msalInstance.getActiveAccount();
    if (account) {
      loginBtn.style.display = 'none';
      logoutBtn.style.display = 'inline-block';
      try {
        const token = await getToken();
        await loadEvents(token);
      } catch (e) {
        console.warn('Silent token failed. Si IT bloque, utiliser l’app avec mode offline.', e);
        eventsContainer.innerHTML = '<div class="item">Impossible d’obtenir un jeton Graph. Vérifiez le Client ID/Tenant et la politique IT.</div>';
      }
    }
  });
}

async function getToken() {
  const account = msalInstance.getActiveAccount();
  const resp = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
  return resp.accessToken;
}

async function loadEvents(token) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/events?$top=5&$orderby=start/dateTime', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  eventsContainer.innerHTML = '';
  if (data.value) {
    data.value.forEach(ev => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `<strong>${ev.subject || '(sans sujet)'}</strong><br>${ev.start?.dateTime} → ${ev.end?.dateTime}`;
      eventsContainer.appendChild(div);
    });
  } else {
    eventsContainer.innerHTML = 'Aucun événement trouvé.';
  }
}

// Enregistrer configuration locale (chiffre la clé HF)
saveCfgBtn.onclick = async () => {
  const cfg = {
    clientId: cfgClientId.value.trim(),
    tenant: (cfgTenant.value.trim() || 'common'),
    hf: await encryptSecret(cfgHfKey.value.trim(), cfgPass.value.trim() || '')
  };
  if (!cfg.clientId) {
    cfgStatus.textContent = '⚠️ Client ID requis.'; return;
  }
  await idbSet('app-config', cfg);
  cfgStatus.textContent = '✅ Paramètres enregistrés en local.';
  if (!msalInstance) await initMsal(cfg);
};

// Import/Export JSON local
importCfgBtn.onclick = () => importCfgFile.click();
importCfgFile.onchange = async () => {
  const file = importCfgFile.files[0]; if (!file) return;
  const text = await file.text();
  const json = JSON.parse(text);
  await idbSet('app-config', json);
  cfgClientId.value = json.clientId || '';
  cfgTenant.value = json.tenant || 'common';
  cfgStatus.textContent = '✅ Configuration importée.';
  if (!msalInstance) await initMsal(json);
};
exportCfgBtn.onclick = async () => {
  const stored = await idbGet('app-config'); if (!stored) return;
  const blob = new Blob([JSON.stringify(stored, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'ev6planner-config.json'; a.click();
};

// Stats Kia EV6 (placeholder auto)
function getVehicleStats() { return { batteryKWh: 77.4, avgWhPerKm: 180, dcPowerKW: 240 }; }
