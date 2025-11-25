// ============================================================
// 🛠️  COINMATE DCA BOT - KONFIGURACE (VZOR)
// ============================================================

// 1. 🔐 API KLÍČE (Coinmate -> Settings -> API)
const COINMATE = {
  clientId: 'TVOJE_CLIENT_ID',
  publicKey: 'TVOJE_PUBLIC_KEY',
  privateKey: 'TVOJE_PRIVATE_KEY'
};

// 2. ⚙️  TECHNICKÁ NASTAVENÍ
const STATE_FILE = './bot_state.json';
const LOG_FILE = './bot.log';
const DIP_PERCENTAGE = 0.02; // 2% sleva pro limitku
const DAYS_AVERAGE = 3;      // Průměr za 3 dny

// 3. 🚀 STRATEGIE
const STRATEGIES = [
  // Odkomentuj a uprav si, co chceš používat:

  /*
  {
    label: 'Solana Weekly',
    pair: 'SOL_CZK',
    amount: 100,
    frequency: 'weekly',
    runDay: 1, // Pondělí
    runHour: 10
  },
  */
  
  /*
  {
    label: 'Bitcoin Monthly',
    pair: 'BTC_CZK',
    amount: 1000,
    frequency: 'monthly',
    runDay: 15, // 15. den v měsíci
    runHour: 20
  }
  */
];

module.exports = {
  COINMATE,
  STATE_FILE,
  LOG_FILE,
  DIP_PERCENTAGE,
  DAYS_AVERAGE,
  STRATEGIES
};
