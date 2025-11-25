// ============================================================
// 🛠️  COINMATE DCA BOT - KONFIGURACE (VZOR)
// ============================================================

// 1. 🔐 API KLÍČE
// ------------------------------------------------------------
// Získáš na Coinmate.io -> Settings -> API.
// Pro fungování potřebuješ práva: "Order book" a "Place limit/market orders".
const COINMATE = {
  clientId: 'DOPLN_SVE_CLIENT_ID',
  publicKey: 'DOPLN_SVUJ_PUBLIC_KEY',
  privateKey: 'DOPLN_SVUJ_PRIVATE_KEY'
};

// 2. ⚙️  TECHNICKÁ NASTAVENÍ
// ------------------------------------------------------------
const STATE_FILE = './bot_state.json'; // Soubor pro ukládání stavu běžících objednávek
const LOG_FILE = './bot.log';          // Soubor s historií nákupů
const DIP_PERCENTAGE = 0.02;           // 0.02 = 2% sleva oproti průměru (Smart DCA)
const DAYS_AVERAGE = 3;                // Z kolika dní se počítá průměrná cena

// 3. 🚀 STRATEGIE (To hlavní nastavení)
// ------------------------------------------------------------
// Zde můžeš mít libovolný počet strategií.
// Stačí odkomentovat (smazat //) blok { ... } a upravit hodnoty.

/*
  LEGENDA K PARAMETRŮM:
  ---------------------
  label:     Jméno strategie pro logy (jen pro tvou informaci).
  pair:      Měnový pár na Coinmate (např. 'BTC_CZK', 'ETH_CZK', 'SOL_CZK').
  amount:    Částka ve FIAT měně (CZK/EUR), kterou chceš investovat.
  frequency: Jak často nakupovat. Možnosti: 'daily' | 'weekly' | 'monthly'.
  
  runDay:    Kdy spustit nákup (závisí na frequency):
             - Pro 'weekly':  0=Neděle, 1=Pondělí, 2=Úterý ... 6=Sobota.
             - Pro 'monthly': Den v měsíci (např. 15 = patnáctého).
             - Pro 'daily':   Nastav null (ignoruje se).
             
  runHour:   Hodina spuštění (0 až 23).
             Pozor: Kontrola nákupu (zda se chytil dip) probíhá vždy 
             o 55 minut později v tu samou hodinu.
*/

const STRATEGIES = [

  // --- 🔵 PŘÍKLAD 1: SOLANA (Týdenní klasika) ---
  // Nakoupí každé pondělí v 10:00 dopoledne.
  /*
  {
    label: 'Solana Weekly',
    pair: 'SOL_CZK',
    amount: 125,
    frequency: 'weekly',
    runDay: 1,  // 1 = Pondělí
    runHour: 10 // 10:00
  },
  */

  // --- 🟣 PŘÍKLAD 2: ETHEREUM (Denní "Kávová" strategie) ---
  // Nakoupí každý den ráno v 8:00 za menší částku.
  /*
  {
    label: 'ETH Daily',
    pair: 'ETH_CZK',
    amount: 50,
    frequency: 'daily',
    runDay: null, // U daily se den ignoruje
    runHour: 8    // 8:00
  },
  */

  // --- 🟠 PŘÍKLAD 3: BITCOIN (Měsíční výplata) ---
  // Nakoupí jednou měsíčně po výplatě (např. 15. dne).
  /*
  {
    label: 'BTC Monthly',
    pair: 'BTC_CZK',
    amount: 1000,
    frequency: 'monthly',
    runDay: 15, // 15. den v měsíci
    runHour: 19 // 19:00 večer
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
