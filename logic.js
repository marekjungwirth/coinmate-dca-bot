const fs = require('fs');
const path = require('path');
const { coinmateApiCall, logMessage, getHistory } = require('./helpers');

const TRANSACTIONS_PATH = path.join(__dirname, 'data', 'transactions.json');

async function runBuy(strat) {
    const pair = strat.pair;
    logMessage(`🚀 Spouštím nákupní strategii pro ${pair}`, "STRAT");

    try {
        // 1. Zjistit aktuální cenu
        const orderBook = await coinmateApiCall('orderBook', { currencyPair: pair, limit: 2 });
        
        // PŘIDÁNO: Diagnostika, pokud se nepodaří stáhnout cenu
        if (!orderBook) {
            logMessage(`❌ Chyba: Burza nevrátila OrderBook (aktuální cenu) pro ${pair}. Končím.`, "ERROR");
            return;
        }
        
        const currentPrice = (Number(orderBook.bids[0].price) + Number(orderBook.asks[0].price)) / 2;

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
        
        // PŘIDÁNO: Kontrola, zda API vůbec odpovědělo
        if (!openOrders) {
            logMessage(`⚠️ Varování: Nelze načíst otevřené objednávky (API neodpovídá).`, "warn");
            return;
        }

        if (openOrders.entries) {
            for (const order of openOrders.entries) {
                await coinmateApiCall('cancelOrder', { orderId: order.id });
                logMessage(`❌ Ruším starou limitku ID ${order.id}.`, "SYSTEM");
            }
            // Koupit marketem (Autofallout)
            await placeOrder(strat, 0, "market_autofallout");
        } else {
            // Pokud nejsou žádné orders, je to ok, ale pro debug to můžeme zmínit
            // logMessage(`ℹ️ Žádné otevřené objednávky k zrušení.`, "SYSTEM");
        }
    } catch (e) {
        logMessage(`Chyba při kontrole (runCheck): ${e.message}`, "ERROR");
    }
}

// --- POMOCNÉ FUNKCE ---

async function getMarketAverage(pair, settings) {
    let minutesHistory = 1440 * 3; // Default 3 dny

    // A) Podle posledního nákupu
    if (settings && settings.averageCalculation === 'last_buy') {
        const lastTradeDate = getLastTradeDate(pair);
        if (lastTradeDate) {
            const diffMs = new Date() - new Date(lastTradeDate);
            minutesHistory = Math.floor(diffMs / 1000 / 60);
            if (minutesHistory < 60) minutesHistory = 60; // Minimum 1h
        } else {
            logMessage(`ℹ️ První nákup (žádná historie). Beru průměr za 24h.`, "SYSTEM");
            minutesHistory = 1440;
        }
    } 
    // B) Fixní interval
    else if (settings && settings.averageCalculation === 'fixed') {
        const val = settings.fixedValue || 3;
        const unit = settings.fixedUnit || 'days';
        
        if (unit === 'hours') minutesHistory = val * 60;
        if (unit === 'days') minutesHistory = val * 1440;
        if (unit === 'weeks') minutesHistory = val * 10080;
        if (unit === 'months') minutesHistory = val * 43200;
    }

    // Volání API
    const data = await coinmateApiCall('tradingHistory', { currencyPair: pair, minutesIntoHistory: minutesHistory });
    
    if (data && data.length > 0) {
        let sum = 0;
        data.forEach(t => sum += Number(t.price));
        return sum / data.length;
    } else {
        logMessage(`⚠️ API vrátilo prázdnou historii pro ${pair} za posledních ${minutesHistory} minut.`, "warn");
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

    const amountCrypto = amountFiat / price;
    const res = await coinmateApiCall('buyLimit', { amount: amountCrypto, price: price, currencyPair: strat.pair });
    
    if (res && res.success) {
        let savings = 0;
        if (referenceMarketPrice && price < referenceMarketPrice) {
            savings = amountFiat * ((referenceMarketPrice / price) - 1);
        }

        if (type === "market") {
             recordTransaction(strat, amountFiat, 0); 
        } else {
            logMessage(`✅ Limitka za ${price}. Teoretická úspora: ${Math.round(savings)} CZK`, "TRADE");
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
        amountCrypto: fiat / (strat.pair.includes('EUR') ? 25000 : 1000000), 
        savings: Number(savings.toFixed(2))
    };
    
    let history = [];
    if (fs.existsSync(TRANSACTIONS_PATH)) history = JSON.parse(fs.readFileSync(TRANSACTIONS_PATH));
    history.push(tx);
    fs.writeFileSync(TRANSACTIONS_PATH, JSON.stringify(history, null, 2));
}

module.exports = { runBuy, runCheck };
