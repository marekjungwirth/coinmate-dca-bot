// Tento skript simuluje pondělní ráno - spustí nákup HNED TEĎ
const config = require('./config');
const { runBuy } = require('./logic');

// Simulace nastavení z app.js
const COIN_MAPPING = { 'BTC': 'bitcoin', 'ETH': 'ethereum', 'LTC': 'litecoin', 'XRP': 'ripple', 'SOL': 'solana', 'ADA': 'cardano' };
const [crypto, fiat] = config.PAIR.split('_');
const settings = { 
    pair: config.PAIR, 
    coinGeckoId: COIN_MAPPING[crypto], 
    fiat, 
    amount: config.INVESTMENT_AMOUNT, 
    minOrder: (fiat === 'EUR' ? 2 : 50) 
};

console.log("--- SPUŠTĚNÍ MANUÁLNÍHO TESTU ---");
runBuy(settings);

