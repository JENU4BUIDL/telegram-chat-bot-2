{
  "name": "chart-service",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "playwright": "^1.40.0"
  }
}


const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

let browser;

(async () => {
  browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
})();

app.post('/generate', async (req, res) => {
  try {
    const { ticker = 'NASDAQ:TSLA', timeframe = '60' } = req.body;

    const page = await browser.newPage();

    // Use TradingView widget instead of main site
    await page.setContent(`
      <html>
        <body>
          <div id="tv"></div>
          <script src="https://s3.tradingview.com/tv.js"></script>
          <script>
            new TradingView.widget({
              "container_id": "tv",
              "width": 800,
              "height": 600,
              "symbol": "${ticker}",
              "interval": "${timeframe}",
              "timezone": "Etc/UTC",
              "theme": "dark",
              "style": "1",
              "locale": "en",
              "hide_top_toolbar": true,
              "hide_legend": true
            });
          </script>
        </body>
      </html>
    `);

    // Wait for chart canvas to render
    await page.waitForSelector('canvas', { timeout: 15000 });

    const screenshot = await page.screenshot({ type: 'png' });

    await page.close();

    res.set('Content-Type', 'image/png');
    res.send(screenshot);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate chart' });
  }
});

app.listen(3000, () => console.log('Chart service running on port 3000'));
