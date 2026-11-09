const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const url = 'http://127.0.0.1:8002/';
const photo = {name:'photo.png', mimeType:'image/png', buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAIAAAAC64paAAAAHUlEQVR4nGNkYPjPQC5gIlvnqOZRzaOaRzVTRTMAIJ4BJ6WiocQAAAAASUVORK5CYII=', 'base64')};
const sdk = 'window.Telegram={WebApp:{initData:"integration-test",ready(){},expand(){}}};';
async function telegramPage(browser) {
  const page = await browser.newPage();
  await page.route('https://telegram.org/**', route => route.fulfill({contentType:'application/javascript', body:sdk}));
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById('sales').disabled);
  return page;
}
async function salesForm(page) {
  await page.locator('#sales').click();
  await page.getByRole('button', {name: 'Savdo mutaxassisi →', exact: true}).click();
  await page.getByRole('button', {name: 'Anketani to‘ldirish', exact: true}).click();
}
async function fill(page) {
  const answers = ['Erkak', 'Synthetic', 'Candidate', '01.01.2000', 'Bo‘ydoq / Turmushga chiqmagan', 'Synthetic address', '+998901234567', 'O‘rta', 'Yo‘q', 'Ha', 'Synthetic experience', '5000000', 'Synthetic extra'];
  for (const answer of answers) {
    const input = page.locator('#answer');
    if (await input.evaluate(el => el.tagName) === 'SELECT') await input.selectOption(answer);
    else {
      if (answer === '01.01.2000') {
        await input.fill('31.02.2000');
        let rejected = false;
        page.once('dialog', async dialog => {rejected = true; await dialog.accept();});
        await page.locator('#nextButton').click();
        assert.equal(rejected, true);
        assert.equal(await input.inputValue(), '31.02.2000');
      }
      await input.fill(answer);
    }
    await page.locator('#nextButton').click();
  }
  // Files remain available after changing languages, editing, and going backwards.
  await page.locator('#answer').setInputFiles({name:'large.png', mimeType:'image/png', buffer:Buffer.alloc(5 * 1024 * 1024 + 1)});
  let oversized = false;
  page.once('dialog', async dialog => {oversized = dialog.message().includes('5 MB'); await dialog.accept();});
  await page.locator('#nextButton').click();
  assert.equal(oversized, true);
  await page.locator('#answer').setInputFiles(photo);
  await page.locator('#zh').click();
  assert((await page.locator('#questionInput').textContent()).includes('photo.png'));
  await page.locator('#uz').click();
  await page.locator('#nextButton').click();
  await page.locator('#review').waitFor({state:'visible'});
}
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox']});
  try {
    const outside = await browser.newPage();
    await outside.route('https://telegram.org/**', r => r.abort());
    await outside.goto(url);
    assert.equal(await outside.locator('#sales').isDisabled(), true);
    assert((await outside.locator('#connectionStatus').textContent()).includes('Telegram'));
    console.log('PASS: ordinary browser cannot start collecting applicant data');
    await outside.close();

    const page = await telegramPage(browser);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await salesForm(page);
    assert.equal(await page.locator('#progress').textContent(), 'Savol 1 / 14');
    let dialog = '';
    page.once('dialog', async d => {dialog = d.message(); await d.accept();});
    await page.locator('#nextButton').click();
    assert(dialog.includes('javobni'));
    await page.locator('#answer').selectOption('Erkak');
    await page.locator('#nextButton').click();
    await page.locator('#answer').fill('Keep this answer');
    await page.locator('#zh').click();
    assert.equal(await page.locator('#answer').inputValue(), 'Keep this answer');
    await page.locator('#uz').click();
    await page.locator('#application .actions button').first().click();
    await page.locator('#nextButton').click();
    assert.equal(await page.locator('#answer').inputValue(), 'Keep this answer');
    // Restart a clean form to test the complete submission.
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('sales').disabled);
    await salesForm(page);
    await fill(page);
    assert.equal(await page.locator('#submitButton').isDisabled(), true);
    assert((await page.locator('#summary').textContent()).includes('Synthetic extra'));
    await page.locator('#editButton').click();
    assert((await page.locator('#questionInput').textContent()).includes('photo.png'));
    await page.locator('#nextButton').click();
    await page.locator('#consent').check();

    // A server error must preserve answers and photo, never show false success.
    await page.route('**/api/applications', route => route.fulfill({status:422, contentType:'application/json', body:JSON.stringify({detail:'Sinov: ma’lumotni tekshiring'})}));
    await page.locator('#submitButton').click();
    await page.locator('#submitError').waitFor({state:'visible'});
    assert((await page.locator('#submitError').textContent()).includes('Sinov:'));
    assert.equal(await page.locator('#success').isVisible(), false);
    await page.unroute('**/api/applications');

    let posts = 0;
    let payload;
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().endsWith('/api/applications')) {
        posts++;
        assert.equal(request.headers()['x-telegram-init-data'], 'integration-test');
        payload = request.postDataBuffer().toString();
      }
    });
    await page.route('**/api/applications', async route => {
      await new Promise(resolve => setTimeout(resolve, 200));
      await route.continue();
    });
    await page.locator('#submitButton').evaluate(button => {button.click(); button.click();});
    assert.equal(await page.locator('#submitButton').isDisabled(), true);
    await page.locator('#success').waitFor({state:'visible'});
    assert.equal(posts, 1);
    assert(payload.includes('filename="photo.png"'));
    assert(payload.includes('name="consent"\r\n\r\nyes'));
    assert(payload.includes('Synthetic extra'));
    assert.match(await page.locator('#confirmation').textContent(), /Ariza raqami: \d+/);
    const storedResponse = await page.request.get(url + 'api/admin/applications', {headers:{'X-Telegram-Init-Data':'integration-test'}});
    assert.equal(storedResponse.status(), 200);
    const stored = await storedResponse.json();
    assert.equal(stored.length, 1);
    assert.equal(stored[0].telegram_id, 900001);
    assert.equal(stored[0].answers.first_name, 'Synthetic');
    assert(Object.values(stored[0].answers).includes('Synthetic extra'));
    const pdf = await page.request.get(url + `api/admin/applications/${stored[0].id}/pdf`, {headers:{'X-Telegram-Init-Data':'integration-test'}});
    assert.equal(pdf.status(), 200);
    assert((await pdf.body()).toString().startsWith('%PDF-'));
    assert.equal(await page.locator('#summary').textContent(), '');
    await page.locator('#zh').click();
    assert.match(await page.locator('#confirmation').textContent(), /申请编号：\d+/);
    assert.deepEqual(errors, []);
    console.log('PASS: live API vacancies/custom questions, required fields, language/edit preservation, consent, error retry, real multipart photo, one POST, server-confirmed success');
    await page.close();

    const expired = await browser.newPage();
    await expired.route('https://telegram.org/**', route => route.fulfill({contentType:'application/javascript', body:sdk.replace('integration-test','expired-test')}));
    await expired.goto(url);
    await expired.waitForFunction(() => document.getElementById('connectionStatus').textContent.includes('sessiyasi'));
    assert.equal(await expired.locator('#production').isDisabled(), true);
    console.log('PASS: rejected Telegram session keeps form disabled');
    await expired.close();
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
