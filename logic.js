const { coinmateApiCall, getCoinGeckoHistory, readState, writeState, deleteState, logMessage, addToHistory } = require('./helpers');
const config = require('./config'); // Jen pro konstanty jako DIP_PERCENTAGE

async function runBuy(strategy) {
  const { label, pair, coinGeckoId, fiat, amount, minOrder } = strategy;
  
  if (readState(pair)) { 
    logMessage(`⚠️ Minulý cyklus nebyl ukončen. Čekám na kontrolu.`, label); 
    return; 
  }

  // 1. Získání dat
  const prices = await getCoinGeckoHistory(coinGeckoId, 3, fiat); // 3 dny natvrdo nebo z configu
  if (!prices) return;

  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const targetPrice = avgPrice * (1 - 0.02); // 2% dip
  
  // 2. Kontrola zůstatku
  const balances = await coinmateApiCall('balances');
  if (!balances) return;
  
  let invest = balances[fiat]?.available || 0;
  if (invest > amount) invest = amount;
  
  if (invest < minOrder) { 
    logMessage(`⚠️ Nízký zůstatek: ${invest} ${fiat} (Min: ${minOrder})`, label); 
    return; 
  }

  // 3. Výpočet a nákup
  const safeFiat = invest * 0.99;
  const cryptoAmount = Math.floor((safeFiat / targetPrice) * 1e8) / 1e8;

  logMessage(`🚀 Nastavuji Limit Order: ${cryptoAmount} ks za ${targetPrice.toFixed(2)} ${fiat} (Průměr: ${avgPrice.toFixed(2)})`, label);
  
  const order = await coinmateApiCall('buyLimit', { 
    amount: cryptoAmount.toFixed(8), 
    price: targetPrice.toFixed(2), 
    currencyPair: pair 
  });

  if (order) {
    const orderId = (typeof order === 'object' && order.id) ? order.id : order;
    // UKLÁDÁME SI I PRŮMĚRNOU CENU PRO VÝPOČET ÚSPORY!
    writeState(pair, { pendingOrderId: orderId, amountFiat: invest, targetPrice, avgPriceAtStart: avgPrice });
    logMessage(`✅ Objednávka ${orderId} uložena.`, label);
  }
}

async function runCheck(strategy) {
  const { label, pair } = strategy;
  const state = readState(pair);
  
  if (!state) return;

  const orders = await coinmateApiCall('openOrders', { currencyPair: pair });
  if (!orders) return;

  const isStillOpen = orders.find(o => o.id == state.pendingOrderId);

  if (!isStillOpen) {
    // --- SCÉNÁŘ A: DIP CHYCEN ---
    logMessage(`🎉 ÚSPĚCH: Limitka vyplněna (Dip chycen)!`, label);
    
    // Výpočet úspory: (Cena, za kterou bych koupil hned - Cena v dipu) * množství
    // Přibližné množství = Fiat / targetPrice
    const cryptoAmount = state.amountFiat / state.targetPrice;
    const savings = (state.avgPriceAtStart - state.targetPrice) * cryptoAmount;
    
    addToHistory({
        date: new Date().toISOString(),
        pair: pair,
        type: 'LIMIT (DIP)',
        price: state.targetPrice,
        amountFiat: state.amountFiat,
        savings: savings // Uložení úspory
    });

    deleteState(pair);

  } else {
    // --- SCÉNÁŘ B: MARKET BUY ---
    logMessage(`⏳ Limitka nevyplněna. Ruším a kupuji Marketem.`, label);
    await coinmateApiCall('cancelOrder', { orderId: state.pendingOrderId });
    await new Promise(r => setTimeout(r, 1000));

    const marketId = await coinmateApiCall('buyInstant', { 
      total: (state.amountFiat * 0.99).toFixed(2), 
      currencyPair: pair 
    });
    
    if (marketId) {
      logMessage(`✅ Market nákup dokončen.`, label);
      
      // Tady je úspora 0 (nebo záporná kvůli poplatkům, ale počítejme 0 pro jednoduchost)
      addToHistory({
        date: new Date().toISOString(),
        pair: pair,
        type: 'MARKET',
        price: state.avgPriceAtStart, // Přibližně
        amountFiat: state.amountFiat,
        savings: 0
    });

      deleteState(pair);
    }
  }
}

module.exports = { runBuy, runCheck };
