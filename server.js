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

  logMessage("🤖 Starting scheduler...", "SYSTEM");

  config.strategies.forEach(strat => {
    if (strat.active === false) return;

    const [crypto, fiat] = strat.pair.split('_');
    const coinGeckoId = COIN_MAPPING[crypto];

    // Sestavení aktivní strategie - dipPercentage se bere přímo z objektu strategie
    const activeStrat = {
      ...strat, 
      coinGeckoId, 
      fiat, 
      minOrder: (fiat === 'EUR' ? 2 : 50),
      settings: {
          daysAverage: config.settings?.daysAverage || 3,
          dipPercentage: strat.dipPercentage // Individuální hodnota pro každou kartu
      }
    };

    const buyRule = new schedule.RecurrenceRule();
    const checkRule = new schedule.RecurrenceRule();

    buyRule.hour = strat.runHour; buyRule.minute = 0;
    checkRule.hour = strat.runHour; checkRule.minute = 55;

    if (strat.frequency === 'weekly') buyRule.dayOfWeek = strat.runDay;
    else if (strat.frequency === 'monthly') buyRule.date = strat.runDay;
    else buyRule.dayOfWeek = new schedule.Range(0, 6); // Daily

    scheduledJobs.push(schedule.scheduleJob(buyRule, () => runBuy(activeStrat)));
    scheduledJobs.push(schedule.scheduleJob(checkRule, () => runCheck(activeStrat)));
    
    logMessage(`✅ Scheduled: ${strat.pair} (Dip: ${(strat.dipPercentage*100).toFixed(1)}%)`, "SYSTEM");
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

app.get('/api/stats', (req, res) => {
    const range = req.query.range || 'all';
    const history = getHistory();
    if (history.length === 0) return res.json({ labels: [], datasets: [] });

    const sortedHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = [...new Set(sortedHistory.map(t => t.date.split('T')[0]))];
    const coins = [...new Set(history.map(t => t.pair.split('_')[0]))];
    
    const datasets = coins.map(coin => {
        let cum = 0;
        const data = labels.map(date => {
            sortedHistory.filter(t => t.date.startsWith(date) && t.pair.startsWith(coin)).forEach(t => cum += Number(t.amountCrypto));
            return cum;
        });
        return { label: coin, data: data, backgroundColor: COIN_COLORS[coin] || '#888', borderColor: COIN_COLORS[coin], fill: true, tension: 0.4 };
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