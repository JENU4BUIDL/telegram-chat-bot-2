const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

let browser;

// Launch browser once when server starts
(async () => {
  try {
    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('Browser launched successfully');
  } catch (err) {
    console.error('Failed to launch browser:', err);
  }
})();

// Health check route (useful for Render)
app.get('/', (req, res) => {
  res.send('Chart service is running');
});

app.post('/generate', async (req, res) => {
  const { ticker = 'NASDAQ:TSLA', timeframe = '60' } = req.body;

  let page;

  try {
    if (!browser) {
      throw new Error('Browser not initialized');
    }

    page = await browser.newPage();

    await page.setViewportSize({ width: 800, height: 600 });

    await page.setContent(`
      <html>
        <head>
          <style>
            body { margin: 0; background: #000; }
          </style>
        </head>
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
              "hide_legend": true,
              "withdateranges": false
            });
          </script>
        </body>
      </html>
    `);

    // Wait for the chart to actually render
    await page.waitForSelector('canvas', { timeout: 15000 });

    const screenshot = await page.screenshot({ type: 'png' });

    res.set('Content-Type', 'image/png');
    res.send(screenshot);

  } catch (err) {
    console.error('Error generating chart:', err);
    res.status(500).json({ error: 'Failed to generate chart' });
  } finally {
    if (page) {
      await page.close();
    }
  }
});

// Use Render's dynamic port
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
