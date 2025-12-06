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

    const activeStrat = {
      ...strat, coinGeckoId, fiat, minOrder: (fiat === 'EUR' ? 2 : 50)
    };

    const buyRule = new schedule.RecurrenceRule();
    const checkRule = new schedule.RecurrenceRule();

    buyRule.hour = strat.runHour; buyRule.minute = 0;
    checkRule.hour = strat.runHour; checkRule.minute = 55;
    checkRule.dayOfWeek = new schedule.Range(0, 6);

    if (strat.frequency === 'weekly') buyRule.dayOfWeek = strat.runDay;
    else if (strat.frequency === 'monthly') buyRule.date = strat.runDay;
    else if (strat.frequency === 'daily') buyRule.dayOfWeek = new schedule.Range(0, 6);

    scheduledJobs.push(schedule.scheduleJob(buyRule, () => runBuy(activeStrat)));
    scheduledJobs.push(schedule.scheduleJob(checkRule, () => runCheck(activeStrat)));
    
    logMessage(`✅ Scheduled: ${strat.pair} (${strat.frequency})`, "SYSTEM");
  });
  return true;
}

function stopBot() {
  scheduledJobs.forEach(job => job.cancel());
  scheduledJobs = [];
}

// --- API ENDPOINTS ---

app.get('/api/config', (req, res) => {
  if (!fs.existsSync(CONFIG_PATH)) return res.json({ error: "Config not found" });
  res.json(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
});

app.post('/api/config', (req, res) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2));
    logMessage('Configuration updated via Web UI', "WEB");
    startBot();
    res.json({ success: true, message: "Settings saved & Bot restarted!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/restart', (req, res) => {
  startBot();
  res.json({ success: true, message: "Bot restarted." });
});

app.get('/api/logs', (req, res) => {
  const logPath = path.join(__dirname, 'bot.log');
  if (fs.existsSync(logPath)) {
    res.send(fs.readFileSync(logPath, 'utf8').trim().split('\n').slice(-100).join('\n'));
  } else { res.send("No logs available."); }
});

app.get('/api/portfolio', async (req, res) => {
    const targetCurrency = req.query.currency ? req.query.currency.toLowerCase() : 'czk'; 
    const history = getHistory();
    
    let botStats = { invested: 0, saved: 0, tradeCount: 0 };
    history.forEach(trade => {
        botStats.tradeCount++;
        botStats.invested += Number(trade.amountFiat);
        botStats.saved += Number(trade.savings || 0);
    });

    let realHoldings = {};
    let totalValue = 0;
    const balancesData = await coinmateApiCall('balances');

    if (balancesData) {
        let geckoIdsToFetch = [];
        let symbolToId = {};

        for (const [symbol, data] of Object.entries(balancesData)) {
            const amount = Number(data.balance);
            if (amount > 0) {
                if (COIN_MAPPING[symbol]) {
                    const geckoId = COIN_MAPPING[symbol];
                    geckoIdsToFetch.push(geckoId);
                    symbolToId[geckoId] = symbol;
                    realHoldings[symbol] = amount;
                } else if (symbol === 'CZK' || symbol === 'EUR') {
                    realHoldings[symbol] = amount;
                    if (symbol.toLowerCase() === targetCurrency) {
                        totalValue += amount;
                    } else if (symbol === 'CZK' && targetCurrency === 'eur') {
                        totalValue += amount / 25; 
                    } else if (symbol === 'EUR' && targetCurrency === 'czk') {
                        totalValue += amount * 25;
                    }
                }
            }
        }

        if (geckoIdsToFetch.length > 0) {
            const currentPrices = await getCurrentPrices(geckoIdsToFetch, targetCurrency);
            for (const [geckoId, priceData] of Object.entries(currentPrices)) {
                const symbol = symbolToId[geckoId];
                const amount = realHoldings[symbol];
                const price = priceData[targetCurrency];
                if (price && amount) totalValue += amount * price;
            }
        }
    }

    res.json({
        botStats,      
        realHoldings, 
        totalValue,    
        currency: targetCurrency.toUpperCase()
    });
});

app.listen(PORT, () => {
  console.log(`🚀 WEB DASHBOARD: http://localhost:${PORT}`);
  startBot();
});
