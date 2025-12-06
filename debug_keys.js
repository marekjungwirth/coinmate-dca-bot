const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');
const fetch = require('node-fetch');

const CONFIG_PATH = path.resolve(__dirname, 'data', 'config.json');

console.log("--- 🕵️‍♂️ DIAGNOSTIKA KLÍČŮ ---");

if (!fs.existsSync(CONFIG_PATH)) {
    console.error("❌ Config neexistuje!");
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const { clientId, publicKey, privateKey } = config.api;

// 1. KONTROLA MEZER A TYPŮ
function inspect(label, value) {
    const type = typeof value;
    const len = value ? value.toString().length : 0;
    const valStr = String(value);
    
    // Zkontrolujeme první a poslední znak na mezery
    const hasLeadingSpace = valStr.startsWith(' ');
    const hasTrailingSpace = valStr.endsWith(' ');
    
    console.log(`\n🔍 ${label}:`);
    console.log(`   Typ: ${type}`);
    console.log(`   Délka: ${len}`);
    if (hasLeadingSpace) console.log(`   ⚠️ POZOR: Obsahuje mezeru na začátku!`);
    if (hasTrailingSpace) console.log(`   ⚠️ POZOR: Obsahuje mezeru na konci!`);
    
    // Ukázka (bezpečně)
    if (len > 8) {
        console.log(`   Náhled: '${valStr.substring(0, 4)}...${valStr.substring(len - 4)}'`);
    } else {
        console.log(`   Hodnota: '${valStr}'`);
    }
}

inspect("Client ID", clientId);
inspect("Public Key", publicKey);
inspect("Private Key", privateKey);

// 2. SIMULACE PODPISU
console.log("\n--- ✍️ TEST PODPISU ---");
const nonce = Date.now();
const message = String(nonce) + String(clientId) + String(publicKey);
const signature = CryptoJS.HmacSHA256(message, privateKey).toString(CryptoJS.enc.Hex).toUpperCase();

console.log(`Nonce: ${nonce}`);
console.log(`Message (co podepisuji): ${message.substring(0, 20)}...`);
console.log(`Signature: ${signature}`);

// 3. OSTRÝ TEST
console.log("\n--- 📡 OSTRÝ TEST (Balances) ---");

(async () => {
    const body = new URLSearchParams({
        clientId: String(clientId).trim(), // Zkusíme pro jistotu TRIM (odstranit mezery)
        publicKey: String(publicKey).trim(),
        nonce: String(nonce),
        signature: signature
    });

    try {
        const res = await fetch('https://coinmate.io/api/balances', {
            method: 'POST',
            body: body,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const json = await res.json();
        console.log("Odpověď serveru:", JSON.stringify(json, null, 2));
        
        if (!json.error) {
            console.log("\n✅ HURÁ! S funkcí .trim() to funguje. Problém jsou mezery v configu.");
        } else {
            console.log("\n❌ STÁLE CHYBA. Problém je jinde (IP, API permissions, nebo špatný klíč).");
        }
    } catch (e) {
        console.error("Chyba sítě:", e.message);
    }
})();
