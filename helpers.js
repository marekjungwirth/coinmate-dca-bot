const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const CryptoJS = require('crypto-js');

const DATA_DIR = path.resolve(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const LOG_FILE = path.resolve(__dirname, 'bot.log');
const STATE_FILE = path.resolve(__dirname, 'bot_state.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR); } catch(e) {}
}

function getConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }
  return null;
}

function logMessage(message, label = 'SYSTEM') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${label}] ${message}\n`;
  console.log(logEntry.trim());
  fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
}

function addToHistory(trade) {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch(e) {}
  }
  if (!trade.date) trade.date = new Date().toISOString();
  history.push(trade);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function getHistory() {
  if (fs.existsSync(HISTORY_FILE)) {
    try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch(e) { return []; }
  }
  return [];
}

async function getCoinGeckoHistory(assetId, days, vsCurrency) {
  const url = `https://api.coingecko.com/api/v3/coins/${assetId}/market_chart?vs_currency=${vsCurrency.toLowerCase()}&days=${days}&interval=daily`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.prices) throw new Error('API nevrátilo ceny');
    return data.prices.map(p => p[1]); 
  } catch (error) {
    logMessage(`CoinGecko Error: ${error.message}`, 'ERROR');
    return null;
  }
}

async function getCurrentPrices(coinIds, vsCurrency = 'czk') {
    if (!coinIds || coinIds.length === 0) return {};
    const ids = coinIds.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vsCurrency.toLowerCase()}`;
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error("CoinGecko Error:", error.message);
        return {};
    }
}

async function coinmateApiCall(endpoint, params = {}) {
  const config = getConfig();
  
  if (!config || !config.api || !config.api.clientId || !config.api.publicKey || !config.api.privateKey) {
    logMessage('Missing API Configuration', 'ERROR');
    return null;
  }

  const clientId = String(config.api.clientId).trim();
  const publicKey = String(config.api.publicKey).trim();
  const privateKey = String(config.api.privateKey).trim();

  const nonce = Date.now();
  const message = "" + nonce + clientId + publicKey;
  const signature = CryptoJS.HmacSHA256(message, privateKey).toString(CryptoJS.enc.Hex).toUpperCase();
  
  const body = new URLSearchParams({ 
      clientId: clientId, 
      publicKey: publicKey, 
      nonce: String(nonce), 
      signature: signature, 
      ...params 
  });

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

function readState(pair) {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const allStates = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return allStates[pair] || null;
    } catch (e) { return null; }
  }
  return null;
}

function writeState(pair, data) {
  let allStates = {};
  if (fs.existsSync(STATE_FILE)) {
    try { allStates = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) {}
  }
  allStates[pair] = data;
  fs.writeFileSync(STATE_FILE, JSON.stringify(allStates, null, 2));
}

function deleteState(pair) {
  if (fs.existsSync(STATE_FILE)) {
    try {
      let allStates = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (allStates[pair]) {
        delete allStates[pair];
        fs.writeFileSync(STATE_FILE, JSON.stringify(allStates, null, 2));
      }
    } catch (e) {}
  }
}

module.exports = { 
    logMessage, getCoinGeckoHistory, getCurrentPrices, coinmateApiCall, 
    readState, writeState, deleteState, getConfig, addToHistory, getHistory 
};
