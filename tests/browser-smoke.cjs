/* Test-only fixtures intercept image edits; the production app always uses OpenAI. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomFillSync } = require('node:crypto');
const sharp = require('sharp');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Execute este teste somente contra um servidor local de teste.');
const testPassword = process.env.TEST_STUDIO_PASSWORD || 'test-studio-password';
const maxBytes = Math.floor(3.5 * 1024 * 1024);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.style-card').count(), 9);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.getByRole('button', { name: 'Entrar no estúdio', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Entrar no estúdio', exact: true }).click();
    assert.match(await page.locator('.access-error').textContent(), /Digite a senha/);
    await page.locator('#password').fill('wrong-password');
    await page.locator('#password').press('Enter');
    await page.waitForFunction(() => document.querySelector('.access-error')?.textContent.includes('Senha incorreta'));
    await page.locator('#password').fill(testPassword);
    await page.getByRole('button', { name: 'Entrar no estúdio', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.access-approved')?.textContent.includes('Estúdio liberado'));
    const cookies = await context.cookies();
    const session = cookies.find(cookie => cookie.name === 'auto_vision_session');
    assert.equal(session?.httpOnly, true);
    assert.equal(await page.locator('#password').count(), 0, 'Password cleared after sign-in');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!document.querySelector('.access-approved'));

    const picker = page.locator('#vehicle-input');
    assert.equal(await picker.getAttribute('multiple'), '');
    fs.mkdirSync('/tmp/auto-vision-tests', {recursive:true});
    const portrait = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#123456' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    fs.writeFileSync('/tmp/auto-vision-tests/portrait.JPG', portrait);
    await picker.setInputFiles('/tmp/auto-vision-tests/portrait.JPG');
    await page.waitForFunction(() => document.querySelector('.reference-status')?.textContent.includes('1 foto pronta'));
    assert.deepEqual(await page.locator('.photo-preview').evaluate(img => [img.naturalWidth, img.naturalHeight]), [200, 300]);
    await picker.setInputFiles('/tmp/auto-vision-tests/portrait.JPG');
    assert.equal(await page.locator('.reference-thumb').count(), 1, 'Repeated selection is not duplicated');
    await page.getByRole('button', { name: 'Remover portrait.JPG', exact: true }).click();
    assert.equal(await page.locator('.reference-thumb').count(), 0);
    if (fs.existsSync('/tmp/auto-vision-test.heic')) {
      await picker.setInputFiles({ name: 'IPHONE.HEIC', mimeType: '', buffer: fs.readFileSync('/tmp/auto-vision-test.heic') });
      await page.waitForFunction(() => document.querySelector('.reference-status')?.textContent.includes('1 foto pronta'), {}, { timeout: 60000 });
      assert.equal(await page.locator('.photo-preview').evaluate(img => img.naturalWidth > 0), true);
      await page.getByRole('button', { name: 'Remover IPHONE.HEIC', exact: true }).click();
    }
    await picker.setInputFiles({ name: 'wrong.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not an image') });
    assert.match(await page.locator('.error-message').textContent(), /Formato não suportado/);
    await picker.setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('broken jpeg data') });
    await page.waitForFunction(() => document.querySelector('.reference-thumb p')?.textContent.includes('Não foi possível'));
    await page.getByRole('button', { name: 'Remover broken.jpg', exact: true }).click();

    // Large references force the real browser-side upload-budget compression path.
    const pixels = randomFillSync(Buffer.alloc(1500 * 1000 * 3));
    const noisy = await sharp(pixels, { raw: { width: 1500, height: 1000, channels: 3 } }).jpeg({ quality: 98 }).toBuffer();
    await picker.setInputFiles(Array.from({ length: 5 }, (_, i) => ({ name: `angle-${i + 1}.jpg`, mimeType: 'image/jpeg', buffer: noisy })));
    await page.waitForFunction(() => document.querySelector('.reference-status')?.textContent.includes('5 fotos prontas'), {}, { timeout: 60000 });
    assert.equal(await page.locator('.reference-thumb').count(), 5);
    await page.getByRole('button', { name: 'Usar angle-3.jpg como foto principal', exact: true }).click();
    assert.match(await page.locator('.reference-select').first().getAttribute('aria-label'), /angle-3/);
    await page.getByRole('button', { name: 'Remover angle-2.jpg', exact: true }).click();
    assert.equal(await page.locator('.reference-thumb').count(), 4);
    await picker.setInputFiles({ name: 'angle-2.jpg', mimeType: 'image/jpeg', buffer: noisy });
    await page.waitForFunction(() => document.querySelector('.reference-status')?.textContent.includes('5 fotos prontas'));
    await page.getByRole('button', { name: /Bokeh/ }).click();
    await page.getByRole('button', { name: '9:16', exact: true }).click();
    // Server intentionally has no API key in this test run: show its real configuration error.
    await page.getByRole('button', { name: 'Gerar minhas imagens', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.generation-notice')?.textContent.includes('OPENAI_API_KEY'), {}, { timeout: 60000 });
    assert.equal(await page.locator('.result-image img').count(), 0, 'No fake production result');
    assert.equal(await page.locator('.result-state.error').count(), 2);

    const output = await sharp({ create: { width: 864, height: 1536, channels: 3, background: '#345678' } }).jpeg().toBuffer();
    const requests = [];
    let mode = 'success';
    await page.route('**/api/edit', async route => {
      if (mode === 'timeout') return route.fulfill({ status: 504, contentType: 'text/html', body: '<html>Gateway timeout</html>' });
      const request = route.request();
      const headers = await request.allHeaders();
      const body = await new Request(`${base}/api/edit`, { method: 'POST', headers, body: request.postDataBuffer() }).formData();
      const images = body.getAll('images');
      assert.match(headers.cookie || '', /auto_vision_session=/);
      assert.equal(headers['x-app-password'], undefined, 'Password is not resent in request headers');
      assert.equal(body.get('ratio'), '9:16');
      assert.ok(images.reduce((sum, file) => sum + file.size, 0) <= maxBytes, 'Combined files fit Vercel payload budget');
      requests.push(images.length);
      return route.fulfill({ status: 200, contentType: 'image/jpeg', body: output });
    });
    await page.getByRole('button', { name: 'Gerar minhas imagens', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.result-image img').length === 2, {}, { timeout: 60000 });
    assert.deepEqual(requests, [5, 5], 'All five references sent for every selected style');
    assert.equal(await page.locator('.download').count(), 2);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.download').first().click();
    assert.equal((await downloadPromise).suggestedFilename(), 'auto-vision-proshot-9x16.jpg');
    await page.locator('.result-image button').first().click();
    assert.equal(await page.getByRole('dialog').count(), 1);
    await page.keyboard.press('Escape');

    const small = fs.readFileSync('public/styles/hero.jpg');
    await picker.setInputFiles(Array.from({ length: 6 }, (_, i) => ({ name: `extra-${i}.jpg`, mimeType: 'image/jpeg', buffer: small })));
    await page.waitForFunction(() => document.querySelector('.reference-status')?.textContent.includes('10 fotos prontas'), {}, { timeout: 60000 });
    assert.equal(await page.locator('.reference-thumb').count(), 10);
    assert.match(await page.locator('.error-message').textContent(), /Limite de 10/);
    await page.getByRole('button', { name: 'Gerar minhas imagens', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.result-image img').length === 2, {}, { timeout: 60000 });
    assert.deepEqual(requests, [5, 5, 10, 10]);
    mode = 'timeout';
    await page.getByRole('button', { name: 'Gerar minhas imagens', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.generation-notice')?.textContent.includes('limite do servidor'), {}, { timeout: 60000 });
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await page.waitForFunction(() => !!document.querySelector('#password'));
    assert.equal((await context.cookies()).some(c => c.name === 'auto_vision_session'), false);
    await page.screenshot({ path: '/tmp/auto-vision-mobile-updated.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: '/tmp/auto-vision-desktop-updated.png', fullPage: true });
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log('PASS: password button and Enter, wrong-password feedback, real cookie login/logout/restoration, JPEG/EXIF/HEIC, repeat import, corrupt/invalid files, 5 and 10 references, main photo/remove/add, real compression budget, multipart references for each style, server error feedback, download, modal, mobile and desktop.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
