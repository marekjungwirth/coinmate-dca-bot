const { coinmateApiCall, getCoinGeckoHistory, readState, writeState, deleteState, logMessage } = require('./helpers');
const config = require('./config');

async function runBuy(strategy) {
  const { label, pair, coinGeckoId, fiat, amount, minOrder } = strategy;
  
  // Kontrola: Běží už pro tento pár něco?
  if (readState(pair)) { 
    logMessage(`⚠️ Minulý cyklus nebyl ukončen. Čekám na kontrolu.`, label); 
    return; 
  }

  // 1. Získání dat
  const prices = await getCoinGeckoHistory(coinGeckoId, config.DAYS_AVERAGE, fiat);
  if (!prices) return;

  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const targetPrice = avgPrice * (1 - config.DIP_PERCENTAGE);
  
  // 2. Kontrola zůstatku
  const balances = await coinmateApiCall('balances');
  if (!balances) return;
  
  let invest = balances[fiat]?.available || 0;
  if (invest > amount) invest = amount; // Nikdy neutrať víc než je limit
  
  if (invest < minOrder) { 
    logMessage(`⚠️ Nízký zůstatek: ${invest} ${fiat} (Min: ${minOrder})`, label); 
    return; 
  }

  // 3. Výpočet a nákup
  const safeFiat = invest * 0.99; // Rezerva na poplatky
  const cryptoAmount = Math.floor((safeFiat / targetPrice) * 1e8) / 1e8;

  logMessage(`🚀 Nastavuji Limit Order: ${cryptoAmount} ks za ${targetPrice.toFixed(2)} ${fiat}`, label);
  
  const order = await coinmateApiCall('buyLimit', { 
    amount: cryptoAmount.toFixed(8), 
    price: targetPrice.toFixed(2), 
    currencyPair: pair 
  });

  if (order) {
    const orderId = (typeof order === 'object' && order.id) ? order.id : order;
    writeState(pair, { pendingOrderId: orderId, amountFiat: invest, targetPrice });
    logMessage(`✅ Objednávka ${orderId} uložena.`, label);
  }
}

async function runCheck(strategy) {
  const { label, pair } = strategy;
  const state = readState(pair);
  
  if (!state) return; // Není co kontrolovat

  const orders = await coinmateApiCall('openOrders', { currencyPair: pair });
  if (!orders) return;

  const isStillOpen = orders.find(o => o.id == state.pendingOrderId);

  if (!isStillOpen) {
    logMessage(`🎉 ÚSPĚCH: Limitka vyplněna (Dip chycen)!`, label);
    deleteState(pair);
  } else {
    logMessage(`⏳ Limitka nevyplněna. Ruším a kupuji Marketem.`, label);
    await coinmateApiCall('cancelOrder', { orderId: state.pendingOrderId });
    
    // Čekáme chvilku, než se uvolní prostředky
    await new Promise(r => setTimeout(r, 1000));

    const marketId = await coinmateApiCall('buyInstant', { 
      total: (state.amountFiat * 0.99).toFixed(2), 
      currencyPair: pair 
    });
    
    if (marketId) {
      logMessage(`✅ Market nákup dokončen.`, label);
      deleteState(pair);
    }
  }
}

module.exports = { runBuy, runCheck };
