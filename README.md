# 🤖 Coinmate DCA Bot (Multi-Strategy Edition)

Automatizovaný bot pro nákup kryptoměn na české burze Coinmate.io.
Podporuje "Smart DCA" – snaží se nakupovat v lokálních dipech pod 3-denním průměrem.

## ✨ Funkce
- **Smart DCA:** Vypočítá průměrnou cenu za 3 dny a nastaví limitní příkaz o 2 % níže.
- **Auto-Fallout:** Pokud se limitka do konce cyklu nevyplní, bot ji zruší a koupí za tržní cenu (Market Buy), aby ti neutekl nákup.
- **Multi-Strategy:** Můžeš nakupovat více měn najednou s různým nastavením (např. SOL týdně + BTC měsíčně).
- **Flexibilita:** Nastav si denní, týdenní nebo měsíční intervaly.

## 🛠 Instalace

1. **Naklonuj repozitář:**
   ```bash
   git clone [https://github.com/tvoje-jmeno/coinmate-dca-bot.git](https://github.com/tvoje-jmeno/coinmate-dca-bot.git)
   cd coinmate-dca-bot
   npm install
   ```

2. **Nastav Config:**
   Při prvním spuštění ti bot sám vytvoří konfigurační soubor:
   ```bash
   node app.js
   ```
   
   Nyní otevři nově vzniklý `config.js`:
   - Zadej své **API klíče** (Coinmate -> Settings -> API).
   - V poli `STRATEGIES` odkomentuj nebo přidej blok pro měnu, kterou chceš.

   *Příklad nastavení v config.js:*
   ```javascript
   {
     label: 'Solana Weekly',
     pair: 'SOL_CZK',
     amount: 125,
     frequency: 'weekly',
     runDay: 1, // Pondělí
     runHour: 10
   }
   ```

3. **Spusť bota:**
   Pro běh na pozadí (pomocí PM2):
   ```bash
   npm run background
   ```

## 📊 Správa bota
- **Sledování logů:** `pm2 logs coinmate-bot`
- **Restart (po úpravě configu):** `pm2 restart coinmate-bot`
- **Zastavení:** `pm2 stop coinmate-bot`
