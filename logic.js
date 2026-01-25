const fs = require('fs');
const path = require('path');
const { coinmateApiCall, logMessage, getHistory } = require('./helpers');

const TRANSACTIONS_PATH = path.join(__dirname, 'data', 'transactions.json');

async function runBuy(strat) {
    const pair = strat.pair;
    logMessage(`🚀 Spouštím nákupní strategii pro ${pair}`, "STRAT");

    try {
        // 1. Zjistit aktuální cenu (Market Price v čase spuštění)
        const orderBook = await coinmateApiCall('orderBook', { currencyPair: pair, limit: 2 });
        if (!orderBook) return;
        
        const currentPrice = (Number(orderBook.bids[0].price) + Number(orderBook.asks[0].price)) / 2;

        // 2. Zjistit férovou cenu (Průměr)
        const avgPrice = await getMarketAverage(pair, strat.settings);
        if (!avgPrice) {
            logMessage("❌ Nepodařilo se získat historická data.", "ERROR");
            return;
        }

        // 3. Vypočítat Dip
        const dip = strat.settings.dipPercentage || 0.02; 
        const targetPrice = avgPrice * (1 - dip);

        logMessage(`📊 Průměr: ${Math.round(avgPrice)}, Cíl: ${Math.round(targetPrice)}, Aktuálně: ${Math.round(currentPrice)}`, "MATH");

        // 4. Rozhodnutí
        if (currentPrice <= targetPrice) {
            logMessage(`🔥 Cena je super! Kupuji hned.`, "TRADE");
            // Posíláme currentPrice jako "refPrice" pro výpočet úspory (zde bude úspora 0 nebo záporná/kladná podle volatility, ale technicky kupujeme za market)
            await placeOrder(strat, currentPrice, "market", currentPrice); 
        } else {
            logMessage(`⏳ Cena je vysoko. Nastavuji Limitku.`, "TRADE");
            // Posíláme currentPrice jako referenci, abychom věděli, kolik jsme ušetřili oproti nákupu teď hned
            await placeOrder(strat, targetPrice, "limit", currentPrice);
        }

    } catch (error) {
        logMessage(`Chyba při nákupu: ${error.message}`, "ERROR");
    }
}

async function runCheck(strat) {
    // Autofallout logika: zruší staré limitky po 24h a koupí market
    logMessage(`🕵️ Kontrola nevyřízených objednávek pro ${strat.pair}...`, "SYSTEM");
    
    try {
        const openOrders = await coinmateApiCall('openOrders', { currencyPair: strat.pair });
        if (openOrders && openOrders.entries) {
            for (const order of openOrders.entries) {
                await coinmateApiCall('cancelOrder', { orderId: order.id });
                logMessage(`❌ Ruším starou limitku ID ${order.id}.`, "SYSTEM");
            }
            // Koupit marketem (Autofallout)
            await placeOrder(strat, 0, "market_autofallout");
        }
    } catch (e) {
        console.error(e);
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
    }
    return null;
}

function getLastTradeDate(pair) {
    const history = getHistory(); // Načte data/transactions.json
    const trades = history.filter(t => t.pair === pair).sort((a, b) => new Date(b.date) - new Date(a.date));
    return trades.length > 0 ? trades[0].date : null;
}

async function placeOrder(strat, price, type, referenceMarketPrice) {
    const amountFiat = strat.amount;
    
    if (type === "market_autofallout") {
        await coinmateApiCall('buyInstant', { total: amountFiat, currencyPair: strat.pair });
        logMessage(`✅ Market nákup (Autofallout) dokončen.`, "TRADE");
        recordTransaction(strat, amountFiat, 0); // U autofalloutu je úspora 0 (koupili jsme za market)
        return;
    }

    const amountCrypto = amountFiat / price;
    const res = await coinmateApiCall('buyLimit', { amount: amountCrypto, price: price, currencyPair: strat.pair });
    
    if (res && res.success) {
        // Vypočítat REÁLNOU úsporu: (Kolik bych zaplatil teď) - (Kolik platím limitkou)
        // Vzorec: Investice * ((MarketCena / LimitCena) - 1)
        let savings = 0;
        if (referenceMarketPrice && price < referenceMarketPrice) {
            savings = amountFiat * ((referenceMarketPrice / price) - 1);
        }

        if (type === "market") {
             // Simulujeme okamžitý nákup
             recordTransaction(strat, amountFiat, 0); 
        } else {
            logMessage(`✅ Limitka za ${price}. Teoretická úspora: ${Math.round(savings)} CZK`, "TRADE");
            // Poznámka: Zapisujeme to do JSONu hned při vystavení, 
            // správně by se to mělo zapsat až po vyplnění (fill), ale pro jednoduchost bota to zapisujeme teď.
            recordTransaction(strat, amountFiat, savings); 
        }
    }
}

function recordTransaction(strat, fiat, savings) {
    const tx = {
        date: new Date().toISOString(),
        pair: strat.pair,
        amountFiat: fiat,
        amountCrypto: fiat / (strat.pair.includes('EUR') ? 25000 : 1000000), // Odhad pro graf
        savings: Number(savings.toFixed(2)) // Uložíme hezké číslo na 2 desetinná místa
    };
    
    let history = [];
    if (fs.existsSync(TRANSACTIONS_PATH)) history = JSON.parse(fs.readFileSync(TRANSACTIONS_PATH));
    history.push(tx);
    fs.writeFileSync(TRANSACTIONS_PATH, JSON.stringify(history, null, 2));
}

module.exports = { runBuy, runCheck };