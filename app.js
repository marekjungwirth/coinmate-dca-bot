const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');

// --- 1. SAMOKONTROLA CONFIGU (Seamless Experience) ---
// Tohle zajistí, že když uživatel stáhne repo, vytvoří se mu config automaticky
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
    console.log('👉  2. Vyplň své API klíče a odkomentuj strategie.');
    console.log('👉  3. Ulož soubor.');
    console.log('👉  4. Až to budeš mít, spusť bota finálně příkazem:');
    console.log('\n    npm run background\n');
    console.log('==================================================\n');
    process.exit(0); // Ukončíme program, aby uživatel mohl editovat
  } else {
    console.error('❌ CHYBA: Nenalezen ani config.js, ani config.example.js!');
    console.error('   Ujisti se, že jsi ve správné složce.');
    process.exit(1);
  }
}

// Pokud config existuje, můžeme pokračovat v načítání zbytku
const config = require('./config');
const { runBuy, runCheck } = require('./logic');
const { logMessage } = require('./helpers');

// Mapování kódů měn na ID pro CoinGecko
const COIN_MAPPING = { 
  'BTC': 'bitcoin', 
  'ETH': 'ethereum', 
  'LTC': 'litecoin', 
  'XRP': 'ripple', 
  'SOL': 'solana', 
  'ADA': 'cardano' 
};

console.log('\n==================================================');
console.log('🤖 COINMATE MULTI-STRATEGY BOT STARTUJE');
console.log('==================================================\n');

if (!config.STRATEGIES || config.STRATEGIES.length === 0) {
  console.log('⚠️  Nemáš aktivní žádnou strategii v config.js!');
  console.log('   Otevři config.js a odkomentuj nějaký blok v poli STRATEGIES.');
}

// Procházíme všechny nastavené strategie a vytváříme pro ně "budíky"
config.STRATEGIES.forEach((strat, index) => {
  const [crypto, fiat] = strat.pair.split('_');
  const coinGeckoId = COIN_MAPPING[crypto];

  if (!coinGeckoId) {
    console.error(`❌ CHYBA: Neznámá měna ${crypto} ve strategii č. ${index + 1}`);
    return;
  }

  // Obohatíme strategii o technické detaily pro logic.js
  const activeStrat = {
    ...strat,
    coinGeckoId,
    fiat,
    minOrder: (fiat === 'EUR' ? 2 : 50)
  };

  // --- PLÁNOVÁNÍ ČASU (CRON) ---
  const buyRule = new schedule.RecurrenceRule();
  const checkRule = new schedule.RecurrenceRule();

  // Čas nákupu
  buyRule.hour = strat.runHour;
  buyRule.minute = 0;

  // Čas kontroly (běží denně 55 minut po hodině nákupu)
  checkRule.hour = strat.runHour;
  checkRule.minute = 55;
  checkRule.dayOfWeek = new schedule.Range(0, 6); // Check může běžet každý den

  // Nastavení dnů pro nákup
  let freqText = '';
  if (strat.frequency === 'weekly') {
    buyRule.dayOfWeek = strat.runDay;
    freqText = `Týdně (Den v týdnu: ${strat.runDay})`;
  } else if (strat.frequency === 'monthly') {
    buyRule.date = strat.runDay;
    freqText = `Měsíčně (Den v měsíci: ${strat.runDay})`;
  } else if (strat.frequency === 'daily') {
    buyRule.dayOfWeek = new schedule.Range(0, 6);
    freqText = `Denně`;
  } else {
    console.error(`❌ Neznámá frekvence: ${strat.frequency}`);
    return;
  }

  console.log(`✅ AKTIVOVÁNO: [${strat.label}] -> ${strat.pair} za ${strat.amount} ${fiat}`);
  console.log(`   🕒 Kdy: ${freqText} v ${strat.runHour}:00`);

  // Spuštění jobů
  schedule.scheduleJob(buyRule, () => runBuy(activeStrat));
  schedule.scheduleJob(checkRule, () => runCheck(activeStrat));
});

console.log('\n🚀 Bot běží na pozadí a čeká na termíny... (Ctrl+C pro ukončení výpisu)\n');
