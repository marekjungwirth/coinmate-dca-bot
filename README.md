# Coinmate DCA Bot 🤖

Chytrý a bezúdržbový bot pro pravidelné nákupy (DCA) na burze Coinmate.

## ✨ Funkce
* **Smart DCA:** Nakupuje v nastavený den (např. Pondělí ráno).
* **Dip Catcher:** Snaží se chytit propad ceny (-2% pod průměrem).
* **Auto-Complete:** Pokud limitní příkaz neprojde, bot zbytek týdne dokoupí za tržní cenu (Market Buy), takže o investici nepřijdeš.
* **Univerzální:** Funguje pro libovolný pár (BTC_CZK, SOL_CZK, XRP_EUR...).
* **Bezpečný:** API klíče jsou oddělené v `config.js` (ignorováno Gitem).
* **Seamless:** Automatická instalace a běh na pozadí.

## 🚀 Instalace a Spuštění

Bot je navržen tak, aby fungoval "out of the box" bez složitého nastavování serveru.

### 1. Stáhni a nainstaluj
```bash
git clone [https://github.com/marekjungwirth/coinmate-dca-bot.git](https://github.com/marekjungwirth/coinmate-dca-bot.git)
cd coinmate-dca-bot
npm install
```

### 2. První spuštění (Generování configu)
Spusť bota, aby si vytvořil konfigurační soubor:
```bash
npm start
```
*Bot detekuje první spuštění, automaticky vytvoří soubor `config.js` a ukončí se.*

### 3. Nastavení
Otevři nově vytvořený soubor `config.js` v textovém editoru a vyplň:

**Povinné:**
* **API Klíče** (Client ID, Public Key, Private Key)
* **PAIR** (např. 'BTC_CZK' nebo 'SOL_CZK')
* **INVESTMENT_AMOUNT** (kolik chceš pravidelně investovat)

**Volitelné (Strategie):**
* **DIP_PERCENTAGE**: O kolik % pod průměrem nakupovat (default: 0.02 = 2%).
* **DAYS_AVERAGE**: Z kolika dní počítat průměrnou cenu (default: 3 dny).
* **BUY_DAY / HOUR**: Kdy má bot nakupovat.

### 4. Ostré spuštění na pozadí
Jakmile máš nastaveno, spusť bota do "neviditelného" režimu:
```bash
npm run background
```
*Bot nyní běží na pozadí (pomocí PM2), přežije i zavření terminálu a bude tiše pracovat.*

---

## 🛠 Ovládání bota

* **Kontrola stavu (běží?):**
  ```bash
  npm run monitor
  ```
* **Zobrazení logů (co dělá?):**
  ```bash
  npm run logs
  ```
* **Zastavení bota:**
  ```bash
  npm stop
  ```
* **Restartování (po změně configu):**
  ```bash
  npm restart
  ```

## 📄 Licence
Open Source (ISC)
