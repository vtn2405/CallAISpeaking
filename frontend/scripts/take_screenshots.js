const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function takeScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  const pages = [
    { url: '/login', name: 'login' },
    { url: '/register', name: 'register' }
  ];
  
  const sizes = [
    { width: 390, height: 844, name: '390' },
    { width: 768, height: 1024, name: '768' },
    { width: 1280, height: 800, name: '1280' }
  ];

  const outDir = path.join(__dirname, '../screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const page = await context.newPage();
  
  for (const { url, name } of pages) {
    for (const size of sizes) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(`http://localhost:3000${url}`);
      // Wait a bit for layout
      await page.waitForTimeout(1000);
      
      const fileName = `${name}_${size.name}.png`;
      const filePath = path.join(outDir, fileName);
      
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`Saved ${fileName}`);
    }
  }

  await browser.close();
}

takeScreenshots().catch(console.error);
