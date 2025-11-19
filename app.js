const schedule = require('node-schedule');
const config = require('./config');
const { runBuy, runCheck } = require('./logic');
const { logMessage } = require('./helpers');

const COIN_MAPPING = { 'BTC': 'bitcoin', 'ETH': 'ethereum', 'LTC': 'litecoin', 'XRP': 'ripple', 'SOL': 'solana', 'ADA': 'cardano' };
const [crypto, fiat] = config.PAIR.split('_');
const settings = { pair: config.PAIR, coinGeckoId: COIN_MAPPING[crypto], fiat, amount: config.INVESTMENT_AMOUNT, minOrder: (fiat === 'EUR' ? 2 : 50) };

console.log(`--- BOT STARTUJE: ${config.PAIR}, Investice: ${config.INVESTMENT_AMOUNT} ${fiat} ---`);

// Plánovač
const buyRule = new schedule.RecurrenceRule();
buyRule.dayOfWeek = config.BUY_DAY; buyRule.hour = config.BUY_HOUR; buyRule.minute = 0;

const checkRule = new schedule.RecurrenceRule();
checkRule.dayOfWeek = config.CHECK_DAY; checkRule.hour = config.CHECK_HOUR; checkRule.minute = 55;

schedule.scheduleJob(buyRule, () => runBuy(settings));
schedule.scheduleJob(checkRule, () => runCheck(settings));

logMessage('✅ Bot běží na pozadí.');

