# 🤖 Coinmate Smart DCA Bot

Moderní, plně automatizovaný bot pro nákup kryptoměn na české burze **Coinmate.io**.
Bot má vlastní **Webový Dashboard**, kde si vše jednoduše naklikáte. Žádné úpravy kódu v terminálu!

## ✨ Klíčové Funkce

* **🖥️ Webové Rozhraní:** Krásný dashboard s grafy, statistikami a nastavením.
* **🧠 Smart DCA:** Bot nekupuje tupě hned. Vypočítá 3-denní průměr a nastaví limitní příkaz se slevou (Dip).
* **🛡️ Auto-Fallout:** Pokud se cena nepropadne a limitka se nevyplní, bot ji před dalším cyklem zruší a koupí okamžitě (Market), abyste o nákup nepřišli.
* **📈 Portfolio Tracker:** Automaticky stahuje zůstatky z burzy, počítá hodnotu portfolia v CZK/EUR a ukazuje, kolik jste ušetřili díky Smart strategii.
* **🐳 Docker Ready:** Stačí jeden příkaz a běží to kdekoliv (NAS, Raspberry Pi, VPS).

---

## 🚀 Instalace (Nejjednodušší cesta)

Pro spuštění potřebujete pouze **Docker**. Pokud máte NAS (Synology, QNAP, Asustor) nebo Linux server, máte vyhráno.

### 1. Stažení
Naklonujte si repozitář nebo stáhněte soubory:
```bash
git clone [https://github.com/tvoje-jmeno/coinmate-dca-bot.git](https://github.com/tvoje-jmeno/coinmate-dca-bot.git)
cd coinmate-dca-bot
```

### 2. Spuštění
Spusťte bota na pozadí:
```bash
docker-compose up -d
```

### 3. Hotovo! 🎉
Otevřete prohlížeč a jděte na:
**`http://IP-VAŠEHO-ZAŘÍZENÍ:8080`**

*(Např. http://192.168.1.50:8080 nebo http://localhost:8080)*

---

## ⚙️ Jak to nastavit?

1.  Otevřete Webový Dashboard.
2.  V sekci **API Klíče** zadejte své údaje z Coinmate (Settings -> API).
    * *Potřebná práva:* `Order book`, `Place limit/market orders`, `Balances`.
3.  V sekci **Strategie** klikněte na **+ Přidat Strategii**.
    * Vyberte měnu (např. BTC), frekvenci (Týdně) a částku.
4.  Klikněte na **💾 Uložit Změny & Spustit**.

Bot nyní běží na pozadí, hlídá čas a nakupuje za vás.

---

## 🛠️ Pro pokročilé (Manuální instalace)

Pokud nechcete Docker, potřebujete Node.js v18+.

```bash
npm install
node server.js
```
Web poběží na `http://localhost:3000`.

---

## 🔒 Bezpečnost
* API klíče jsou uloženy **pouze u vás** v souboru `data/config.json`.
* Nikam se neposílají. Aplikace komunikuje přímo s Coinmate API.

---

**Disclaimer:** Tento software je poskytován "tak jak je". Použití je na vlastní riziko. Autor nenese odpovědnost za finanční ztráty.
