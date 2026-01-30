const fs = require('fs');
const path = require('path');
let fetch;
try { fetch = require('node-fetch'); } catch (e) { fetch = global.fetch; }
const crypto = require('crypto'); 

const DATA_DIR = path.resolve(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const LOG_FILE = path.resolve(__dirname, 'bot.log');
const STATE_FILE = path.resolve(__dirname, 'bot_state.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

if (!fs.existsSync(DATA_DIR)) { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {} }

function getConfig() {
  if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  return null;
}

function logMessage(message, label = 'SYSTEM') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${label}] ${message}`);
  try { fs.appendFileSync(LOG_FILE, `[${timestamp}] [${label}] ${message}\n`, 'utf8'); } catch (e) {}
}

function addToHistory(trade) {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) { try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch(e) {} }
  if (!trade.date) trade.date = new Date().toISOString();
  history.push(trade);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function getHistory() {
  if (fs.existsSync(HISTORY_FILE)) { try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch(e) { return []; } }
  return [];
}

async function getCoinGeckoHistory(assetId, days, vsCurrency) {
  const url = `https://api.coingecko.com/api/v3/coins/${assetId}/market_chart?vs_currency=${vsCurrency.toLowerCase()}&days=${days}&interval=daily`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.prices ? data.prices.map(p => p[1]) : null;
  } catch (error) {
    logMessage(`CoinGecko Error: ${error.message}`, 'ERROR');
    return null;
  }
}

async function getCurrentPrices(coinIds, vsCurrency = 'czk') {
    if (!coinIds || coinIds.length === 0) return {};
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=${vsCurrency.toLowerCase()}`;
    try { const r = await fetch(url); return await r.json(); } catch (e) { return {}; }
}

// =========================================================
// 🚀 FINÁLNÍ HYBRIDNÍ FUNKCE (Production Ready)
// =========================================================
async function coinmateApiCall(endpoint, params = {}) {
  // Seznam veřejných metod (tradingHistory zde NENÍ, protože je private)
  const publicMethods = ['orderBook', 'ticker', 'transactions']; 
  const isPublic = publicMethods.includes(endpoint);
  
  // 1. Očista parametrů (Limit vadí veřejnému orderBooku)
  if (endpoint === 'orderBook' && params.limit) {
      delete params.limit;
  }

  // A) VEŘEJNÉ METODY -> GET
  if (isPublic) {
      const queryParams = new URLSearchParams(params).toString();
      const url = `https://coinmate.io/api/${endpoint}?${queryParams}`;
      
      try {
          const res = await fetch(url);
          const textRes = await res.text();
          let json;
          try { json = JSON.parse(textRes); } catch(e) { return null; }

          if (json.error) {
              logMessage(`API Error (${endpoint}): ${json.errorMessage}`, 'ERROR');
              return null;
          }
          return json.data;
      } catch (error) {
          logMessage(`Network Error (${endpoint}): ${error.message}`, 'ERROR');
          return null;
      }
  }

  // B) SOUKROMÉ METODY -> POST
  const config = getConfig();
  if (!config?.api?.clientId) { 
      logMessage('Missing API Config', 'ERROR'); 
      return null; 
  }

  const { clientId, publicKey, privateKey } = config.api;
  const nonce = Date.now();
  const message = "" + nonce + clientId + publicKey;
  const signature = crypto.createHmac('sha256', privateKey).update(message).digest('hex').toUpperCase();

  const bodyParams = new URLSearchParams();
  bodyParams.append('clientId', clientId);
  bodyParams.append('publicKey', publicKey);
  bodyParams.append('nonce', nonce);
  bodyParams.append('signature', signature);
  
  for (const key in params) {
      bodyParams.append(key, params[key]);
  }

  try {
    const res = await fetch(`https://coinmate.io/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString()
    });

    const textRes = await res.text();
    let json;
    try { json = JSON.parse(textRes); } catch(e) { return null; }

    if (json.error) {
       if (endpoint === 'tradingHistory' && json.errorMessage === 'No result') return [];
       logMessage(`API Error (${endpoint}): ${json.errorMessage}`, 'ERROR');
       return null;
    }
    return json.data;

  } catch (error) {
    logMessage(`Network Error (${endpoint}): ${error.message}`, 'ERROR');
    return null;
  }
}

function readState(pair) {
  if (fs.existsSync(STATE_FILE)) { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))[pair]; } catch (e) {} }
  return null;
}
function writeState(pair, data) {
  let s = {}; if (fs.existsSync(STATE_FILE)) { try { s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch(e) {} }
  s[pair] = data; fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}
function deleteState(pair) {
  if (fs.existsSync(STATE_FILE)) { try { let s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); if(s[pair]) { delete s[pair]; fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); } } catch(e) {} }
}

module.exports = { 
    logMessage, getCoinGeckoHistory, getCurrentPrices, coinmateApiCall, 
    readState, writeState, deleteState, getConfig, addToHistory, getHistory 
};
