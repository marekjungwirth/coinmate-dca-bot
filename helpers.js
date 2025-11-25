const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const CryptoJS = require('crypto-js');
const config = require('./config');

// Logování s labelem strategie (např. [SOL_CZK])
function logMessage(message, label = 'SYSTEM') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${label}] ${message}\n`;
  console.log(logEntry.trim());
  fs.appendFileSync(path.resolve(__dirname, config.LOG_FILE), logEntry, 'utf8');
}

// CoinGecko API (beze změny)
async function getCoinGeckoHistory(assetId, days, vsCurrency) {
  logMessage(`CoinGecko: Stahuji historii pro '${assetId}'...`, 'API');
  const url = `https://api.coingecko.com/api/v3/coins/${assetId}/market_chart?vs_currency=${vsCurrency.toLowerCase()}&days=${days}&interval=daily`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.prices) throw new Error('API nevrátilo ceny');
    return data.prices.map(p => p[1]); 
  } catch (error) {
    logMessage(`CHYBA CoinGecko: ${error.message}`, 'ERROR');
    return null;
  }
}

// Coinmate API (beze změny)
async function coinmateApiCall(endpoint, params = {}) {
  const { clientId, publicKey, privateKey } = config.COINMATE;
  const nonce = Date.now();
  const signature = CryptoJS.HmacSHA256(nonce + clientId + publicKey, privateKey).toString(CryptoJS.enc.Hex).toUpperCase();
  const body = new URLSearchParams({ clientId, publicKey, nonce, signature, ...params });

  try {
    const res = await fetch(`https://coinmate.io/api/${endpoint}`, {
      method: 'POST', body: body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const json = await res.json();
    if (json.error) {
      logMessage(`API Error (${endpoint}): ${json.errorMessage}`, 'ERROR');
      return null;
    }
    return json.data;
  } catch (error) {
    logMessage(`Network Error: ${error.message}`, 'ERROR');
    return null;
  }
}

// === NOVÁ LOGIKA STAVU (Multi-currency support) ===

// Přečte stav jen pro konkrétní pár
function readState(pair) {
  if (fs.existsSync(config.STATE_FILE)) {
    try {
      const allStates = JSON.parse(fs.readFileSync(config.STATE_FILE, 'utf8'));
      return allStates[pair] || null;
    } catch (e) { return null; }
  }
  return null;
}

// Zapíše stav pro konkrétní pár (ostatní nechá být)
function writeState(pair, data) {
  let allStates = {};
  if (fs.existsSync(config.STATE_FILE)) {
    try { allStates = JSON.parse(fs.readFileSync(config.STATE_FILE, 'utf8')); } catch (e) {}
  }
  allStates[pair] = data;
  fs.writeFileSync(config.STATE_FILE, JSON.stringify(allStates, null, 2));
}

// Smaže stav pro konkrétní pár
function deleteState(pair) {
  if (fs.existsSync(config.STATE_FILE)) {
    try {
      let allStates = JSON.parse(fs.readFileSync(config.STATE_FILE, 'utf8'));
      if (allStates[pair]) {
        delete allStates[pair];
        fs.writeFileSync(config.STATE_FILE, JSON.stringify(allStates, null, 2));
      }
    } catch (e) {}
  }
}

module.exports = { logMessage, getCoinGeckoHistory, coinmateApiCall, readState, writeState, deleteState };
