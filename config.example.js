module.exports = {
  // --- 1. PŘIHLAŠOVACÍ ÚDAJE ---
  COINMATE: {
    clientId: 'TVOJE_CLIENT_ID',
    publicKey: 'TVOJE_PUBLIC_KEY',
    privateKey: 'TVOJE_PRIVATE_KEY'
  },

  // --- 2. NASTAVENÍ OBCHODU ---
  PAIR: 'SOL_CZK',          // Pár (např. BTC_CZK, ETH_EUR, SOL_CZK)
  INVESTMENT_AMOUNT: 125,   // Kolik investovat (v měně nákupu, např. CZK)
  
  // --- 3. NASTAVENÍ ČASU ---
  BUY_DAY: 1,      // 1 = Pondělí
  BUY_HOUR: 8,     // 8:00
  
  CHECK_DAY: 0,    // 0 = Neděle
  CHECK_HOUR: 23,  // 23:55

  // --- 4. POKROČILÉ ---
  DIP_PERCENTAGE: 0.02, // 2%
  DAYS_AVERAGE: 3,
  STATE_FILE: './bot_state.json',
  LOG_FILE: './bot.log'
};

