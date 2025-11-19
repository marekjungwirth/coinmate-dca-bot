# Coinmate DCA Bot 🤖
Automatický bot pro pravidelné nákupy (DCA) na burze Coinmate.

## Funkce
* Nakupuje v nastavený den (např. Pondělí).
* Snaží se chytit propad ceny (-2% pod průměrem).
* Pokud se cena nechytí, dokoupí zbytek týdne za tržní cenu (Smart DCA).
* Univerzální pro libovolný pár (BTC_CZK, SOL_CZK, XRP_EUR...).

## Instalace
1. `git clone <adresa-repozitare>`
2. `npm install`
3. Přejmenuj `config.example.js` na `config.js` a vyplň API klíče.
4. `npm start`
