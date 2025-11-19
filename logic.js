const { coinmateApiCall, getCoinGeckoHistory, readState, writeState, deleteState, logMessage } = require('./helpers');
const config = require('./config');

async function runBuy(settings) {
  const { pair, coinGeckoId, fiat, amount, minOrder } = settings;
  
  if (readState()) { logMessage('⚠️ Minulý cyklus nebyl ukončen.'); return; }

  const prices = await getCoinGeckoHistory(coinGeckoId, config.DAYS_AVERAGE, fiat);
  if (!prices) return;

  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const targetPrice = avgPrice * (1 - config.DIP_PERCENTAGE);
  
  const balances = await coinmateApiCall('balances');
  if (!balances) return;
  
  let invest = balances[fiat]?.available || 0;
  if (invest > amount) invest = amount;
  if (invest < minOrder) { logMessage(`⚠️ Zůstatek ${invest} ${fiat} je příliš nízký.`); return; }

  const safeFiat = invest * 0.99;
  const cryptoAmount = Math.floor((safeFiat / targetPrice) * 1e8) / 1e8;

  logMessage(`🚀 Limit Order: ${cryptoAmount} za ${targetPrice.toFixed(2)} ${fiat}`);
  const order = await coinmateApiCall('buyLimit', { amount: cryptoAmount.toFixed(8), price: targetPrice.toFixed(2), currencyPair: pair });

  if (order) {
    const orderId = (typeof order === 'object' && order.id) ? order.id : order;
    writeState({ pendingOrderId: orderId, amountFiat: invest, targetPrice });
    logMessage(`✅ Objednávka ${orderId} vytvořena.`);
  }
}

async function runCheck(settings) {
  const state = readState();
  if (!state) { logMessage('ℹ️ Žádný aktivní záznam.'); return; }

  const orders = await coinmateApiCall('openOrders', { currencyPair: settings.pair });
  if (!orders) return;

  if (!orders.find(o => o.id == state.pendingOrderId)) {
    logMessage('🎉 ÚSPĚCH: Limitní příkaz vyplněn (Dip chycen).');
    deleteState();
  } else {
    logMessage('⏳ Ruším limitní příkaz a kupuji Marketem.');
    await coinmateApiCall('cancelOrder', { orderId: state.pendingOrderId });
    const marketId = await coinmateApiCall('buyInstant', { total: (state.amountFiat * 0.99).toFixed(2), currencyPair: settings.pair });
    if (marketId) {
      logMessage(`✅ Market nákup OK.`);
      deleteState();
    }
  }
}

module.exports = { runBuy, runCheck };

