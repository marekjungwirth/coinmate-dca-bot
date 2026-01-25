# 🤖 Coinmate Smart DCA Bot

Moderní, plně automatizovaný bot pro nákup kryptoměn na české burze **Coinmate.io**.
Bot má vlastní **Webový Dashboard**, kde si vše jednoduše naklikáte. Žádné úpravy kódu v terminálu!

## ✨ Klíčové Funkce

* **📈 Portfolio Tracker:** Krásný dashboard s grafy růstu množství vašich assetů v čase.]
* **🧠 Smart DCA s individuálním Dipem:** Každá mince má vlastní nastavení slevy (Dip %). Bot vypočítá průměr a nastaví limitku na míru každé kryptoměně.]
* **⏱️ Flexibilní intervaly:** Možnost počítat průměrnou cenu buď fixně (např. posledních 5 dní) nebo dynamicky od posledního nákupu.
* **🛡️ Auto-Fallout:** Pokud se cena nepropadne pod vaši slevu, bot před koncem cyklu koupí za Market, abyste o nákup nepřišli.]
* **🖥️ Portfolio v kapse:** Automatické stahování zůstatků z burzy a výpočet celkové hodnoty v CZK/EUR.]

---

## 🚀 Instalace (Docker - Doporučeno pro NAS)

Pro spuštění potřebujete pouze **Docker**. Bot uvnitř běží na portu 3000, ale ven ho mapujeme na **8085**, aby se nekřížil s jinými službami.

### 1. Stažení
```bash
git clone [https://github.com/marekjungwirth/coinmate-dca-bot.git](https://github.com/marekjungwirth/coinmate-dca-bot.git)
cd coinmate-dca-bot
```

### 2. Spuštění
```bash
docker compose up -d
```

### 3. Hotovo! 🎉
Otevřete dashboard v prohlížeči:
**`http://IP-VAŠEHO-ZAŘÍZENÍ:8085`**

*(Poznámka: Pokud vám port 8085 nevyhovuje, změňte jej v souboru `docker-compose.yml` v sekci ports, např. na `"3000:3000"`).*

---

## ⚙️ Jak to nastavit?

1.  V sekci **🔐 API Klíče** zadejte své údaje z Coinmate.]
2.  V sekci **🚀 Strategie** klikněte na **+ Přidat Strategii**.
3.  U každé karty nastavte:
    * **Částku** a **Frekvenci** (Denně / Týdně / Měsíčně).]
    * **Individuální Dip %:** Vaše cílená sleva (např. 1.5 % pro BTC).]
4.  V sekci **⚙️ Nastavení výpočtu** zvolte, zda se má průměr počítat fixně, nebo dynamicky od posledního nákupu.
5.  Klikněte na **💾 Uložit Vše & Spustit**. Bot okamžitě naplánuje nákupy.]

---

## 🛠️ Pro pokročilé (Manuální instalace bez Dockeru)

Pokud nechcete Docker a máte nainstalované Node.js (v18+):

```bash
npm install
node server.js
```
V tomto případě web poběží na výchozím portu:
**`http://localhost:3000`**

---

## 🔒 Bezpečnost
* API klíče jsou uloženy **pouze u vás** v souboru `data/config.json`.]
* Aplikace komunikuje napřímo s Coinmate API.

---

**Disclaimer:** Tento software je poskytován "tak jak je". Použití je na vlastní riziko. Autor nenese odpovědnost za finanční ztráty.