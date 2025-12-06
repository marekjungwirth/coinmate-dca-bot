// ============================================================
// 🛠️  COINMATE DCA BOT - KONFIGURACE
// ============================================================

// 1. 🔐 API KLÍČE (Coinmate -> Settings -> API)
// ------------------------------------------------------------
const COINMATE = {
  clientId: 'TVOJE_CLIENT_ID',
  publicKey: 'TVOJE_PUBLIC_KEY',
  privateKey: 'TVOJE_PRIVATE_KEY'
};

// 2. ⚙️  TECHNICKÁ NASTAVENÍ
// ------------------------------------------------------------
const STATE_FILE = './bot_state.json'; // Kde se ukládá stav objednávek
const LOG_FILE = './bot.log';          // Kam se zapisuje historie
const DIP_PERCENTAGE = 0.02;           // Sleva 2% oproti průměru (Smart DCA)
const DAYS_AVERAGE = 3;                // Kolik dní zpětně počítat průměr

// 3. 🚀 STRATEGIE (Tady si nastav, co a jak chceš nakupovat)
// ------------------------------------------------------------
// Stačí odkomentovat blok (odstranit //) a upravit částku.
// Frequency: 'daily' | 'weekly' | 'monthly'

const STRATEGIES = [

  // --- 🔵 PŘÍKLAD 1: SOLANA (Týdenní nákup) ---
  {
    label: 'Solana Weekly',   // Jen pro tvůj přehled v logu
    pair: 'SOL_CZK',          // Pár na Coinmate
    amount: 125,              // Kolik CZK investovat
    frequency: 'weekly',      // Jak často: daily, weekly, monthly
    runDay: 1,                // 0=Neděle, 1=Pondělí... (pro weekly) nebo Den v měsíci (pro monthly)
    runHour: 10               // V kolik hodin (0-23)
  },

  // --- 🟣 PŘÍKLAD 2: ETHEREUM (Denní nákup - "Kávová strategie") ---
  /*
  {
    label: 'ETH Daily',
    pair: 'ETH_CZK',
    amount: 50,               // 50 Kč každý den
    frequency: 'daily',
    runDay: null,             // U daily se ignoruje
    runHour: 8                // Ráno v 8:00
  },
  */

  // --- 🟠 PŘÍKLAD 3: BITCOIN (Měsíční výplata) ---
  /*
  {
    label: 'BTC Monthly',
    pair: 'BTC_CZK',
    amount: 1000,
    frequency: 'monthly',
    runDay: 15,               // 15. den v měsíci
    runHour: 19
  },
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
