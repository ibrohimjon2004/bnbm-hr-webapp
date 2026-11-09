// Exercise the production static origin against the actual local API fixture.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = 'https://bnbm-hr-webapp.onrender.com';
const backend = 'https://bnbm-hr-server.onrender.com';
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox']});
  try {
    const page = await browser.newPage();
    const calls = [];
    await page.route(origin + '/**', route => route.fulfill({contentType:'text/html', body:html}));
    await page.route('https://telegram.org/**', route => route.fulfill({contentType:'application/javascript', body:'window.Telegram={WebApp:{initData:"integration-test",ready(){},expand(){}}};'}));
    await page.route(backend + '/api/**', async route => {
      const request = route.request();
      const apiPath = new URL(request.url()).pathname;
      const response = await route.fetch({url:'http://127.0.0.1:8002' + apiPath});
      assert.equal(request.headers()['x-telegram-init-data'], 'integration-test');
      assert.equal(request.headers().origin, origin);
      assert.equal(response.headers()['access-control-allow-origin'], origin);
      calls.push(apiPath);
      await route.fulfill({response});
    });
    await page.goto(origin + '/');
    await page.waitForFunction(() => !document.getElementById('sales').disabled);
    assert.equal(page.url(), origin + '/');
    assert.deepEqual(calls, ['/api/me', '/api/vacancies']);
    await page.locator('#sales').click();
    assert(await page.getByRole('button', {name:'Savdo mutaxassisi →', exact:true}).isVisible());
    assert.equal(await page.evaluate(() => API_BASE), backend);
    console.log('PASS: existing Mini App URL stays unchanged, authenticated requests reach backend with exact-origin CORS, server vacancies render');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
