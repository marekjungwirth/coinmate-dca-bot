const fs = require('fs');
const path = require('path'); // <--- TENTO ŘÁDEK TAM CHYBĚL!

// --- 1. SAMOKONTROLA CONFIGU (Seamless Experience) ---
const configPath = path.resolve(__dirname, 'config.js');
const examplePath = path.resolve(__dirname, 'config.example.js');

if (!fs.existsSync(configPath)) {
  if (fs.existsSync(examplePath)) {
    // Automaticky vytvoříme config.js z example
    fs.copyFileSync(examplePath, configPath);
    console.log('\n==================================================');
    console.log('⚠️  PRVNÍ SPUŠTĚNÍ DETEKOVÁNO');
    console.log('✅  Vytvořil jsem pro tebe soubor "config.js".');
    console.log('👉  1. Otevři soubor "config.js" v textovém editoru.');
    console.log('👉  2. Vyplň své API klíče a nastav, co chceš nakupovat.');
    console.log('👉  3. Ulož soubor.');
    console.log('👉  4. Až to budeš mít, spusť bota finálně příkazem:');
    console.log('\n    npm run background\n');
    console.log('==================================================\n');
    process.exit(0); // Ukončíme program, aby uživatel mohl editovat
  } else {
    console.error('CHYBA: Nenalezen ani config.js, ani config.example.js!');
    process.exit(1);
  }
}

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

