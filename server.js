const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');
const { runBuy, runCheck } = require('./logic');
const { logMessage, getHistory, getCurrentPrices, coinmateApiCall } = require('./helpers');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

const CONFIG_PATH = path.join(__dirname, 'data', 'config.json');

const COIN_MAPPING = { 
  'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 
  'LTC': 'litecoin', 'XRP': 'ripple', 'ADA': 'cardano' 
};

const COIN_COLORS = { 
  'BTC': '#f7931a', 'ETH': '#627eea', 'SOL': '#9945FF', 
  'LTC': '#345d9d', 'XRP': '#00aae4', 'ADA': '#0033ad' 
};

let scheduledJobs = [];

function startBot() {
  stopBot();

  if (!fs.existsSync(CONFIG_PATH)) {
    logMessage("Waiting for configuration...", "SYSTEM");
    return false;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  
  if (!config.strategies || config.strategies.length === 0) {
    logMessage("No active strategies found.", "SYSTEM");
    return false;
  }

  logMessage("🤖 Starting scheduler (Long-wait mode)...", "SYSTEM");

  config.strategies.forEach(strat => {
    if (strat.active === false) return;

    const [crypto, fiat] = strat.pair.split('_');
    const coinGeckoId = COIN_MAPPING[crypto];

    const activeStrat = {
      ...strat, 
      coinGeckoId, 
      fiat, 
      minOrder: (fiat === 'EUR' ? 2 : 50),
      settings: {
          daysAverage: config.settings?.daysAverage || 3,
          dipPercentage: strat.dipPercentage
      }
    };

    const buyRule = new schedule.RecurrenceRule();
    const checkRule = new schedule.RecurrenceRule();

    // NASTAVENÍ NÁKUPU (H:00)
    buyRule.hour = strat.runHour; 
    buyRule.minute = 0;

    // NASTAVENÍ KONTROLY (H-1 : 55) -> Téměř 24h trpělivost
    checkRule.hour = (strat.runHour === 0) ? 23 : strat.runHour - 1; 
    checkRule.minute = 55;

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let freqText = '';

    if (strat.frequency === 'weekly') {
        buyRule.dayOfWeek = strat.runDay;
        freqText = `Weekly (${DAY_NAMES[strat.runDay]})`;
        // Kontrola proběhne těsně před dalším týdenním nákupem
        checkRule.dayOfWeek = strat.runDay; 
    } else if (strat.frequency === 'monthly') {
        buyRule.date = strat.runDay;
        freqText = `Monthly (Day ${strat.runDay})`;
        // Kontrola proběhne těsně před dalším měsíčním nákupem
        checkRule.date = strat.runDay;
    } else {
        // Daily: Obě pravidla běží každý den
        buyRule.dayOfWeek = new schedule.Range(0, 6);
        checkRule.dayOfWeek = new schedule.Range(0, 6);
        freqText = `Daily`;
    }

    scheduledJobs.push(schedule.scheduleJob(buyRule, () => runBuy(activeStrat)));
    scheduledJobs.push(schedule.scheduleJob(checkRule, () => runCheck(activeStrat)));
    
    logMessage(`✅ Scheduled: ${strat.pair} (${freqText} at ${strat.runHour}:00, Check at ${checkRule.hour}:55)`, "SYSTEM");
  });
  return true;
}

function stopBot() {
  scheduledJobs.forEach(job => job.cancel());
  scheduledJobs = [];
}

// --- API ---

app.get('/api/config', (req, res) => {
  if (!fs.existsSync(CONFIG_PATH)) return res.json({ error: "Config not found" });
  res.json(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
});

app.post('/api/config', (req, res) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2));
    logMessage('Configuration updated via Web UI', "WEB");
    startBot();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/restart', (req, res) => {
  startBot();
  res.json({ success: true });
});

app.get('/api/logs', (req, res) => {
  const logPath = path.join(__dirname, 'bot.log');
  if (fs.existsSync(logPath)) res.send(fs.readFileSync(logPath, 'utf8').trim().split('\n').slice(-100).join('\n'));
  else res.send("No logs available.");
});

// Upravit endpoint /api/stats v server.js

app.get('/api/stats', async (req, res) => {
    const range = req.query.range || 'all';
    const targetCurrency = (req.query.currency || 'czk').toUpperCase(); // CZK or EUR

    const history = getHistory();
    if (history.length === 0) return res.json({ labels: [], datasets: [] });

    // Zjistit kurz EUR/CZK pro převody
    let eurRate = 25;
    try {
        const ticker = await coinmateApiCall('ticker', { currencyPair: 'EUR_CZK' });
        if (ticker && ticker.last) eurRate = Number(ticker.last);
    } catch (e) {
        console.error("Failed to fetch EUR_CZK rate, using 25");
    }

    // Seřadit historii
    const sortedHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Časový filtr
    const now = new Date();
    let cutoff = new Date(0);
    if (range === '7d') cutoff = new Date(now.setDate(now.getDate() - 7));
    else if (range === '30d') cutoff = new Date(now.setDate(now.getDate() - 30));
    else if (range === '1y') cutoff = new Date(now.setFullYear(now.getFullYear() - 1));

    // Vygenerovat unikátní dny pro osu X (jen od cutoff)
    const labels = [...new Set(sortedHistory
        .filter(t => new Date(t.date) >= cutoff)
        .map(t => t.date.split('T')[0]))];

    const coins = [...new Set(history.map(t => t.pair.split('_')[0]))];
    
    const datasets = coins.map(coin => {
        let runningTotal = 0;
        
        const getTradeValue = (t) => {
            // Rozhodnout, zda konvertovat
            const isEurTrade = t.pair.endsWith('_EUR');
            const amount = Number(t.amountFiat);

            if (targetCurrency === 'CZK') {
                return isEurTrade ? amount * eurRate : amount;
            } else {
                // Target EUR
                return isEurTrade ? amount : amount / eurRate;
            }
        };

        // Vypočítat počáteční stav před cutoff (aby graf nezačínal od nuly, pokud už jsi nakupoval dřív)
        sortedHistory
            .filter(t => t.pair.startsWith(coin) && new Date(t.date) < cutoff)
            .forEach(t => runningTotal += getTradeValue(t));

        const data = labels.map(date => {
            // Přičíst nákupy v daný den (Investované FIAT)
            sortedHistory
                .filter(t => t.date.startsWith(date) && t.pair.startsWith(coin))
                .forEach(t => runningTotal += getTradeValue(t));
            return runningTotal;
        });

        return { 
            label: coin, 
            data: data, 
            backgroundColor: COIN_COLORS[coin] || '#888', 
            borderColor: COIN_COLORS[coin], 
            fill: true, 
            tension: 0.2 // Méně agresivní křivka pro "ostřejší" schody nákupů
        };
    });
    res.json({ labels, datasets });
});

app.get('/api/portfolio', async (req, res) => {
    const target = (req.query.currency || 'czk').toLowerCase(); 
    const history = getHistory();
    let botStats = { invested: 0, saved: 0, tradeCount: history.length };
    history.forEach(t => { botStats.invested += Number(t.amountFiat); botStats.saved += Number(t.savings || 0); });

    const balances = await coinmateApiCall('balances');
    let totalValue = 0;
    if (balances) {
        let ids = []; let symToId = {};
        for (const [sym, d] of Object.entries(balances)) {
            const amt = Number(d.balance);
            if (amt > 0) {
                if (COIN_MAPPING[sym]) { ids.push(COIN_MAPPING[sym]); symToId[COIN_MAPPING[sym]] = sym; }
                else if (sym === 'CZK' && target === 'czk') totalValue += amt;
                else if (sym === 'EUR' && target === 'eur') totalValue += amt;
            }
        }
        if (ids.length > 0) {
            const prices = await getCurrentPrices(ids, target);
            for (const [id, p] of Object.entries(prices)) totalValue += (Number(balances[symToId[id]].balance) * p[target]);
        }
    }
    res.json({ botStats, totalValue, currency: target.toUpperCase() });
});

app.listen(PORT, () => { console.log(`🚀 DASHBOARD: http://localhost:${PORT}`); startBot(); });