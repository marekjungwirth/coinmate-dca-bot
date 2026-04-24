const fs = require('fs');
const path = require('path');
const { coinmateApiCall, logMessage, getHistory, addToHistory, getCurrentPrices } = require('./helpers');

// ⚙️ NASTAVENÍ PŘESNOSTI PRO JEDNOTLIVÉ PÁRY
// Pokud tu pár není, použije se default (Price: 2, Amount: 4)
const PAIR_SETTINGS = {
    'BTC_CZK': { price: 0, amount: 8 },  // BTC: Cena bez haléřů, Množství hodně desetinných
    'ETH_CZK': { price: 0, amount: 8 },  // ETH: Podobně jako BTC
    'SOL_CZK': { price: 2, amount: 4 },  // SOL: Cena s haléři, Množství na 4 místa
    'LTC_CZK': { price: 2, amount: 8 },
    'XRP_CZK': { price: 4, amount: 2 },
    'ADA_CZK': { price: 4, amount: 2 }
};

async function runBuy(strat) {
    const delay = Math.floor(Math.random() * 5000);
    await new Promise(r => setTimeout(r, delay));

    const pair = strat.pair;
    logMessage(`🚀 Spouštím nákupní strategii pro ${pair}`, "STRAT");

    try {
        const ticker = await coinmateApiCall('ticker', { currencyPair: pair });
        
        if (!ticker) {
            logMessage(`❌ Chyba: Burza nevrátila Ticker (aktuální cenu) pro ${pair}. Končím.`, "ERROR");
            return;
        }
        
        const currentPrice = Number(ticker.last);
        const referencePrice = await getMarketAverage(pair, strat.settings);
        
        if (!referencePrice) {
            logMessage(`❌ Chyba: Nepodařilo se určit referenční cenu pro ${pair}. Končím.`, "ERROR");
            return;
        }

        const dip = strat.settings.dipPercentage || 0.02; 
        const targetPrice = referencePrice * (1 - dip);

        logMessage(`[${pair}] 📊 Ref. cena: ${Math.round(referencePrice)}, Cíl (-${dip*100}%): ${Math.round(targetPrice)}, Aktuálně: ${Math.round(currentPrice)}`, "MATH");

        if (currentPrice <= targetPrice) {
            logMessage(`🔥 [${pair}] Cena je super! Kupuji hned.`, "TRADE");
            await placeOrder(strat, currentPrice, "market", currentPrice); 
        } else {
            logMessage(`⏳ [${pair}] Cena je vysoko (Cíl: ${Math.round(targetPrice)}). Nastavuji Limitku.`, "TRADE");
            await placeOrder(strat, targetPrice, "limit", currentPrice);
        }

    } catch (error) {
        logMessage(`💥 Kritická chyba ve funkci runBuy (${pair}): ${error.message}`, "ERROR");
        console.error(error);
    }
}

async function runCheck(strat) {
    await new Promise(r => setTimeout(r, Math.random() * 3000));
    logMessage(`🕵️ Kontrola nevyřízených objednávek pro ${strat.pair}...`, "SYSTEM");
    
    try {
        const openOrders = await coinmateApiCall('openOrders', { currencyPair: strat.pair });
        let deletedBotOrders = 0;
        
        if (Array.isArray(openOrders) && openOrders.length > 0) {
            for (const order of openOrders) {
                // Zkontrolujeme, zda objednávka nemá klientské ID
                // Štosuj.cz ID posílá (např. 4628110125). Naše botí limitky ho nemají.
                if (!order.clientOrderId) {
                    await coinmateApiCall('cancelOrder', { orderId: order.id });
                    logMessage(`❌ Ruším starou bot limitku ID ${order.id} (${strat.pair}).`, "SYSTEM");
                    deletedBotOrders++;
                } else {
                    logMessage(`⏭️ Ignoruji cizí limitku ID ${order.id} (Client ID: ${order.clientOrderId})`, "SYSTEM");
                }
            }
            
            if (deletedBotOrders > 0) {
                await placeOrder(strat, 0, "market_autofallout");
            }
        } 
    } catch (e) {
        logMessage(`Chyba při kontrole (runCheck - ${strat.pair}): ${e.message}`, "ERROR");
    }
}

// --- POMOCNÉ FUNKCE ---

async function getMarketAverage(pair, settings) {
    let minutesHistory = 1440 * 3;

    if (settings && settings.averageCalculation === 'current_price') {
        const ticker = await coinmateApiCall('ticker', { currencyPair: pair });
        if (ticker && ticker.last) return Number(ticker.last);
        return null;
    }
    else if (settings && settings.averageCalculation === 'last_buy') {
        const lastTradeDate = getLastTradeDate(pair);
        if (lastTradeDate) {
            const diffMs = new Date() - new Date(lastTradeDate);
            minutesHistory = Math.floor(diffMs / 1000 / 60);
            if (minutesHistory < 60) minutesHistory = 60;
        } else {
            logMessage(`ℹ️ [${pair}] První nákup (žádná historie). Beru průměr za 24h.`, "SYSTEM");
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

    const data = await coinmateApiCall('transactions', { currencyPair: pair, minutesIntoHistory: minutesHistory });
    
    if (Array.isArray(data) && data.length > 0) {
        let sum = 0;
        data.forEach(t => sum += Number(t.price));
        return sum / data.length;
    } 
    
    logMessage(`⚠️ [${pair}] Historie trhu je prázdná, zkouším náhradní řešení (Ticker)...`, "warn");
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
        const res = await coinmateApiCall('buyInstant', { 
            total: amountFiat, 
            currencyPair: strat.pair
        });
        
        const isSuccess = (res && res.success) || (res && !isNaN(res));

        if (isSuccess) {
            const orderId = res.success ? res.data : res;
            logMessage(`✅ [${strat.pair}] Market nákup (Autofallout) dokončen (ID ${orderId}).`, "TRADE");

            let executionPrice = 0;
            let estimatedCrypto = 0;

            try {
                const prices = await getCurrentPrices([strat.coinGeckoId], strat.fiat);
                if (prices && prices[strat.coinGeckoId]) {
                    executionPrice = prices[strat.coinGeckoId][strat.fiat.toLowerCase()];
                    if (executionPrice > 0) {
                        estimatedCrypto = amountFiat / executionPrice;
                    }
                }
            } catch (e) {
                logMessage(`Chyba při stahování ceny z CoinGecko: ${e.message}`, "WARN");
            }

            addToHistory({
                date: new Date().toISOString(),
                pair: strat.pair,
                amountFiat: Number(amountFiat),
                amountCrypto: Number(estimatedCrypto),
                savings: 0,
                type: 'market_autofallout',
                orderId: orderId,
                price: Number(executionPrice)
            });
        } else {
             logMessage(`❌ [${strat.pair}] Chyba Market nákupu: ${JSON.stringify(res)}`, "ERROR");
        }
        return;
    }

    const rounding = PAIR_SETTINGS[strat.pair] || { price: 2, amount: 4 };
    const amountCrypto = (amountFiat / price).toFixed(rounding.amount);
    const cleanPrice = Number(price).toFixed(rounding.price);
    
    // Návrat k původní funkčnosti: Nezadáme žádné clientOrderId
    const res = await coinmateApiCall('buyLimit', { 
        amount: amountCrypto, 
        price: cleanPrice, 
        currencyPair: strat.pair
    });
    
    const isSuccess = (res && res.success) || (res && !isNaN(res)); 

    if (isSuccess) {
        let savings = 0;
        if (referenceMarketPrice && price < referenceMarketPrice) {
            savings = amountFiat * ((referenceMarketPrice / price) - 1);
        }

        const orderId = res.success ? res.data : res;

        const tradeData = {
            date: new Date().toISOString(),
            pair: strat.pair,
            amountFiat: Number(amountFiat),
            amountCrypto: Number(amountCrypto),
            savings: Number(savings.toFixed(2)),
            type: type,
            price: Number(cleanPrice),
            orderId: orderId
        };

        if (type === "market") {
             logMessage(`✅ [${strat.pair}] Okamžitý nákup (Limitka za market cenu) ID ${orderId}.`, "TRADE");
             addToHistory(tradeData);
        } else {
            logMessage(`✅ [${strat.pair}] Limitka za ${cleanPrice} zadána (ID ${orderId}). Teoretická úspora: ${Math.round(savings)} CZK`, "TRADE");
            addToHistory(tradeData);
        }
    } else {
        logMessage(`❌ [${strat.pair}] Chyba při zadávání Limitky: ${JSON.stringify(res)}`, "ERROR");
    }
}

module.exports = { runBuy, runCheck };