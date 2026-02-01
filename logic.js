const fs = require('fs');
const path = require('path');
const { coinmateApiCall, logMessage, getHistory } = require('./helpers');

const TRANSACTIONS_PATH = path.join(__dirname, 'data', 'transactions.json');

// ⚙️ NASTAVENÍ PŘESNOSTI PRO JEDNOTLIVÉ PÁRY
// Pokud tu pár není, použije se default (Price: 2, Amount: 4)
const PAIR_SETTINGS = {
    'BTC_CZK': { price: 0, amount: 8 },  // BTC: Cena bez haléřů, Množství hodně desetinných
    'ETH_CZK': { price: 0, amount: 8 },  // ETH: Podobně jako BTC
    'SOL_CZK': { price: 2, amount: 4 },  // SOL: Cena s haléři, Množství na 4 místa (dle erroru)
    'LTC_CZK': { price: 2, amount: 8 },
    'XRP_CZK': { price: 4, amount: 2 },
    'ADA_CZK': { price: 4, amount: 2 }
};

async function runBuy(strat) {
    const pair = strat.pair;
    logMessage(`🚀 Spouštím nákupní strategii pro ${pair}`, "STRAT");

    try {
        // 1. Zjistit aktuální cenu (Ticker je spolehlivější než OrderBook)
        const ticker = await coinmateApiCall('ticker', { currencyPair: pair });
        
        if (!ticker) {
            logMessage(`❌ Chyba: Burza nevrátila Ticker (aktuální cenu) pro ${pair}. Končím.`, "ERROR");
            return;
        }
        
        // Použijeme 'last' (cena posledního obchodu)
        const currentPrice = Number(ticker.last);
        
        // 2. Zjistit férovou cenu (Průměr)
        const avgPrice = await getMarketAverage(pair, strat.settings);
        
        // PŘIDÁNO: Diagnostika, pokud selže výpočet průměru
        if (!avgPrice) {
            logMessage(`❌ Chyba: Nepodařilo se spočítat průměrnou cenu (chybí historie?). Končím.`, "ERROR");
            return;
        }

        // 3. Vypočítat Dip
        const dip = strat.settings.dipPercentage || 0.02; 
        const targetPrice = avgPrice * (1 - dip);

        logMessage(`📊 Průměr: ${Math.round(avgPrice)}, Cíl: ${Math.round(targetPrice)}, Aktuálně: ${Math.round(currentPrice)}`, "MATH");

        // 4. Rozhodnutí
        if (currentPrice <= targetPrice) {
            logMessage(`🔥 Cena je super! Kupuji hned.`, "TRADE");
            await placeOrder(strat, currentPrice, "market", currentPrice); 
        } else {
            logMessage(`⏳ Cena je vysoko (Cíl: ${Math.round(targetPrice)}). Nastavuji Limitku.`, "TRADE");
            await placeOrder(strat, targetPrice, "limit", currentPrice);
        }

    } catch (error) {
        logMessage(`💥 Kritická chyba ve funkci runBuy: ${error.message}`, "ERROR");
        console.error(error);
    }
}

async function runCheck(strat) {
    logMessage(`🕵️ Kontrola nevyřízených objednávek pro ${strat.pair}...`, "SYSTEM");
    
    try {
        const openOrders = await coinmateApiCall('openOrders', { currencyPair: strat.pair });
        
        // Bezpečná kontrola pole
        if (Array.isArray(openOrders) && openOrders.length > 0) {
            for (const order of openOrders) {
                await coinmateApiCall('cancelOrder', { orderId: order.id });
                logMessage(`❌ Ruším starou limitku ID ${order.id}.`, "SYSTEM");
            }
            // Koupit marketem (Autofallout)
            await placeOrder(strat, 0, "market_autofallout");
        } 
    } catch (e) {
        logMessage(`Chyba při kontrole (runCheck): ${e.message}`, "ERROR");
    }
}

// --- POMOCNÉ FUNKCE ---

async function getMarketAverage(pair, settings) {
    let minutesHistory = 1440 * 3; // Default 3 dny

    if (settings && settings.averageCalculation === 'last_buy') {
        const lastTradeDate = getLastTradeDate(pair);
        if (lastTradeDate) {
            const diffMs = new Date() - new Date(lastTradeDate);
            minutesHistory = Math.floor(diffMs / 1000 / 60);
            if (minutesHistory < 60) minutesHistory = 60;
        } else {
            logMessage(`ℹ️ První nákup (žádná historie). Beru průměr za 24h.`, "SYSTEM");
            minutesHistory = 1440;
        }
    } 
    else if (settings && settings.averageCalculation === 'fixed') {
        const val = settings.fixedValue || 3;
        const unit = settings.fixedUnit || 'days';
        if (unit === 'hours') minutesHistory = val * 60;
        if (unit === 'days') minutesHistory = val * 1440;
        if (unit === 'weeks') minutesHistory = val * 10080;
        if (unit === 'months') minutesHistory = val * 43200;
    }

    // Používáme 'transactions' (tržní data)
    const data = await coinmateApiCall('transactions', { currencyPair: pair, minutesIntoHistory: minutesHistory });
    
    if (Array.isArray(data) && data.length > 0) {
        let sum = 0;
        data.forEach(t => sum += Number(t.price));
        return sum / data.length;
    } 
    
    // Fallback na Ticker
    logMessage(`⚠️ Historie trhu je prázdná, zkouším náhradní řešení (Ticker)...`, "warn");
    const ticker = await coinmateApiCall('ticker', { currencyPair: pair });
    if (ticker && ticker.last) {
        return Number(ticker.last);
    }

    return null;
}

function getLastTradeDate(pair) {
    const history = getHistory(); 
    const trades = history.filter(t => t.pair === pair).sort((a, b) => new Date(b.date) - new Date(a.date));
    return trades.length > 0 ? trades[0].date : null;
}

async function placeOrder(strat, price, type, referenceMarketPrice) {
    const amountFiat = strat.amount;
    
    if (type === "market_autofallout") {
        const res = await coinmateApiCall('buyInstant', { total: amountFiat, currencyPair: strat.pair });
        if (res && res.success) {
            logMessage(`✅ Market nákup (Autofallout) dokončen.`, "TRADE");
            recordTransaction(strat, amountFiat, 0); 
        } else {
             logMessage(`❌ Chyba Market nákupu: ${JSON.stringify(res)}`, "ERROR");
        }
        return;
    }

    // --- CHYTRÉ ZAOKROUHLOVÁNÍ ---
    const rounding = PAIR_SETTINGS[strat.pair] || { price: 2, amount: 4 };

    // 1. Množství (Amount)
    const amountCrypto = (amountFiat / price).toFixed(rounding.amount);

    // 2. Cena (Price) - pro limitku
    const cleanPrice = Number(price).toFixed(rounding.price);
    
    logMessage(`⏳ Zadávám limitku: Množství=${amountCrypto}, Cena=${cleanPrice} (Pravidlo: Price ${rounding.price} dec, Amount ${rounding.amount} dec)`, "DEBUG");

    const res = await coinmateApiCall('buyLimit', { 
        amount: amountCrypto, 
        price: cleanPrice, 
        currencyPair: strat.pair 
    });
    
    // OPRAVA: Coinmate vrací ID objednávky jako číslo (nebo string s číslem) při úspěchu
    // nebo objekt { success: true }
    const isSuccess = (res && res.success) || (res && !isNaN(res)); 

    if (isSuccess) {
        let savings = 0;
        if (referenceMarketPrice && price < referenceMarketPrice) {
            savings = amountFiat * ((referenceMarketPrice / price) - 1);
        }

        const orderId = res.success ? res.data : res; // Získáme ID

        if (type === "market") {
             logMessage(`✅ Okamžitý nákup (Limitka za market cenu) ID ${orderId}.`, "TRADE");
             recordTransaction(strat, amountFiat, 0); 
        } else {
            logMessage(`✅ Limitka za ${cleanPrice} zadána (ID ${orderId}). Teoretická úspora: ${Math.round(savings)} CZK`, "TRADE");
            recordTransaction(strat, amountFiat, savings); 
        }
    } else {
        logMessage(`❌ Chyba při zadávání Limitky: ${JSON.stringify(res)}`, "ERROR");
    }
}

function recordTransaction(strat, fiat, savings) {
    const tx = {
        date: new Date().toISOString(),
        pair: strat.pair,
        amountFiat: fiat,
        amountCrypto: fiat / (strat.pair.includes('EUR') ? 25000 : 1000000), // Orientační
        savings: Number(savings.toFixed(2))
    };
    
    let history = [];
    if (fs.existsSync(TRANSACTIONS_PATH)) history = JSON.parse(fs.readFileSync(TRANSACTIONS_PATH));
    history.push(tx);
    fs.writeFileSync(TRANSACTIONS_PATH, JSON.stringify(history, null, 2));
}

module.exports = { runBuy, runCheck };
