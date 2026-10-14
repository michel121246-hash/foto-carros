/* Run with the dev server on port 3000. Uses a real browser and honest API errors. */
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const sharp=require('sharp');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const errors=[];
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000',{waitUntil:'networkidle'});
  assert.equal(await page.locator('.style-card').count(),9);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow on mobile');
  await page.screenshot({path:'/tmp/auto-vision-mobile.png',fullPage:true});
  const picker=page.locator('#vehicle-input');
  await picker.setInputFiles('public/styles/hero.jpg');
  await page.waitForFunction(()=>document.querySelector('.file-meta')?.textContent.includes('hero.jpg'));
  assert.equal(await page.locator('.photo-preview').evaluate(img=>img.naturalWidth>0),true);
  await picker.setInputFiles('public/styles/hero.jpg');
  await page.waitForFunction(()=>!document.querySelector('.preparing'));
  await picker.setInputFiles({name:'wrong.pdf',mimeType:'application/pdf',buffer:Buffer.from('not an image')});
  assert.match(await page.locator('.error-message[role=alert]').textContent(),/Formato não suportado/);
  const rotated=await sharp({create:{width:300,height:200,channels:3,background:'#123456'}}).jpeg().withMetadata({orientation:6}).toBuffer();
  await picker.setInputFiles({name:'portrait.JPG',mimeType:'',buffer:rotated});
  await page.waitForFunction(()=>document.querySelector('.file-meta')?.textContent.includes('portrait.JPG') && !document.querySelector('.preparing'));
  assert.match(await page.locator('.file-meta').textContent(),/200 × 300/,'EXIF portrait orientation preserved');
  if(fs.existsSync('/tmp/auto-vision-test.heic')){
   await picker.setInputFiles({name:'IPHONE.HEIC',mimeType:'',buffer:fs.readFileSync('/tmp/auto-vision-test.heic')});
   await page.waitForFunction(()=>!document.querySelector('.preparing'),{},{timeout:60000});
   assert.equal(await page.locator('.error-message').count(),0,'Real HEIC conversion works');
   assert.equal(await page.locator('.photo-preview').evaluate(img=>img.naturalWidth>0),true);
  }
  await picker.setInputFiles('public/styles/hero.jpg');
  await page.waitForFunction(()=>document.querySelector('.file-meta')?.textContent.includes('hero.jpg') && !document.querySelector('.preparing'));
  await page.getByRole('button',{name:/Bokeh/}).click();
  assert.equal(await page.locator('.style-card[aria-pressed=true]').count(),2);
  await page.getByRole('button',{name:'9:16',exact:true}).click();
  await page.getByRole('button',{name:/Gerar minhas imagens/}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.result-state.error').length===2);
  assert.match(await page.locator('.result-state.error').first().textContent(),/OPENAI_API_KEY/,'Unconfigured API fails honestly');
  assert.equal(await page.locator('.result-image img').count(),0,'No fake generated output');
  // Controlled provider output exists only in this test, never in application code.
  const resultFixture=await sharp({create:{width:864,height:1536,channels:3,background:'#345678'}}).jpeg().toBuffer();
  await page.route('**/api/edit',route=>route.fulfill({status:200,contentType:'image/jpeg',body:resultFixture}));
  await page.getByRole('button',{name:/Gerar minhas imagens/}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.result-image img').length===2);
  assert.equal(await page.locator('.download').count(),2,'Each result can be downloaded');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('.download').first().click();
  const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'auto-vision-proshot-9x16.jpg');
  await page.locator('.result-image button').first().click();
  assert.equal(await page.getByRole('dialog').count(),1);
  await page.keyboard.press('Escape');
  await page.unroute('**/api/edit');
  await page.getByRole('button',{name:/Guia do estúdio/}).click();
  assert.equal(await page.getByRole('dialog').count(),1);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(),0);
  await page.setViewportSize({width:1440,height:1000});await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'/tmp/auto-vision-desktop.png',fullPage:true});
  assert.deepEqual(errors,[],'No uncaught browser errors');
  console.log('PASS: 9 visual cards, mobile overflow, JPEG preview, repeat import, validation, EXIF orientation, HEIC conversion (when fixture present), multiselect, ratio, real configuration error, test-isolated result/download fixture, modal, desktop layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
