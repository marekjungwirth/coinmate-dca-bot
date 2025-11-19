const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const CryptoJS = require('crypto-js');
const config = require('./config');

function logMessage(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${config.PAIR}] ${message}\n`;
  console.log(logEntry.trim());
  fs.appendFileSync(path.resolve(__dirname, config.LOG_FILE), logEntry, 'utf8');
}

async function getCoinGeckoHistory(assetId, days, vsCurrency) {
  logMessage(`CoinGecko: Historie pro '${assetId}' vs '${vsCurrency}'...`);
  const url = `https://api.coingecko.com/api/v3/coins/${assetId}/market_chart?vs_currency=${vsCurrency.toLowerCase()}&days=${days}&interval=daily`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.prices) throw new Error('API nevrátilo ceny');
    return data.prices.map(p => p[1]); 
  } catch (error) {
    logMessage(`CHYBA CoinGecko: ${error.message}`);
    return null;
  }
}

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
      logMessage(`API Error (${endpoint}): ${json.errorMessage}`);
      return null;
    }
    return json.data;
  } catch (error) {
    logMessage(`Network Error: ${error.message}`);
    return null;
  }
}

function readState() {
  if (fs.existsSync(config.STATE_FILE)) return JSON.parse(fs.readFileSync(config.STATE_FILE, 'utf8'));
  return null;
}
function writeState(data) { fs.writeFileSync(config.STATE_FILE, JSON.stringify(data, null, 2)); }
function deleteState() { if (fs.existsSync(config.STATE_FILE)) fs.unlinkSync(config.STATE_FILE); }

module.exports = { logMessage, getCoinGeckoHistory, coinmateApiCall, readState, writeState, deleteState };

