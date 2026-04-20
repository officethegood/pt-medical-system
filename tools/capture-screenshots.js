// Capture screenshots for user + admin manuals
// Run: node tools/capture-screenshots.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE = 'https://supwilaimedical.github.io/pt-medical-system';
const OUT = path.join(__dirname, '..', 'docs', 'manual-screenshots');
const USER = 'test1234';
const PASS = '1234';

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const p = path.join(OUT, name + '.png');
  await page.screenshot({ path: p, fullPage: false });
  console.log('  saved', name);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function login(page, username, password) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1500);
  // If already logged in (landing shows), logout first
  const logoutBtn = await page.$('button[onclick*="logout"], [onclick*="logout"]');
  // Check if we're on login page by username field presence
  const hasLoginField = await page.$('input[placeholder*="รหัสพนักงาน"], #username, input[type="text"]');
  if (!hasLoginField) {
    // maybe logged in - try logout
    const logoutEl = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button,a')].find(b => /ออกจาก|logout/i.test(b.textContent)));
    if (logoutEl && logoutEl.asElement) {
      const el = logoutEl.asElement();
      if (el) { await el.click(); await sleep(2000); }
    }
  }
  // Fill login
  await page.waitForSelector('input', { timeout: 10000 });
  const inputs = await page.$$('input');
  // Find username + password by type
  let uField, pField;
  for (const inp of inputs) {
    const type = await (await inp.getProperty('type')).jsonValue();
    if (type === 'password') pField = inp;
    else if (type === 'text' && !uField) uField = inp;
  }
  await uField.click({ clickCount: 3 });
  await uField.type(username);
  await pField.click({ clickCount: 3 });
  await pField.type(password);
  // Submit
  await page.keyboard.press('Enter');
  await sleep(3500);
}

async function captureUserFlow(page) {
  console.log('=== USER ROLE ===');
  await login(page, USER, PASS);
  await sleep(1500);

  // 01 landing
  await shot(page, 'u01-landing');

  // 02 firstaid module
  await page.goto(BASE + '/firstaid/', { waitUntil: 'networkidle2' });
  await sleep(2500);
  await shot(page, 'u02-firstaid-main');

  // Try to click "เพิ่มงาน" or event button
  try {
    const addEv = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find(b => /เพิ่มงาน|เพิ่ม\s*event|new\s*event/i.test(b.textContent)));
    if (addEv && addEv.asElement && addEv.asElement()) {
      await addEv.asElement().click();
      await sleep(1500);
      await shot(page, 'u03-firstaid-new-event');
      await page.keyboard.press('Escape');
      await sleep(500);
    }
  } catch(e) { console.log('  skip new event:', e.message); }

  // 03 transport module
  await page.goto(BASE + '/transport/', { waitUntil: 'networkidle2' });
  await sleep(3000);
  await shot(page, 'u04-transport-main');

  // Try scroll to form
  await page.evaluate(() => window.scrollTo(0, 300));
  await sleep(500);
  await shot(page, 'u05-transport-form');

  // 04 location module
  await page.goto(BASE + '/location/', { waitUntil: 'networkidle2' });
  await sleep(3000);
  await shot(page, 'u06-location-main');

  // 05 gps - user may not have access, capture what they see
  await page.goto(BASE + '/gps/', { waitUntil: 'networkidle2' });
  await sleep(3500);
  await shot(page, 'u07-gps-main');

  // 06 monitor - user likely no access
  await page.goto(BASE + '/monitor/', { waitUntil: 'networkidle2' });
  await sleep(3500);
  await shot(page, 'u08-monitor-main');
}

async function captureAdminFlow(page) {
  console.log('=== ADMIN (BYPASS) ===');
  // Bypass: set localStorage role=admin
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.evaluate(() => {
    const meta = JSON.parse(localStorage.getItem('pt_user_meta') || '{}');
    meta.role = 'admin';
    localStorage.setItem('pt_user_meta', JSON.stringify(meta));
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2000);
  await shot(page, 'a01-landing-admin');

  // Admin panel
  await page.goto(BASE + '/admin.html', { waitUntil: 'networkidle2' });
  await sleep(3000);
  await shot(page, 'a02-admin-main');

  // Try clicking each sidebar section
  const sections = [
    { sel: 'organization', name: 'a03-admin-org' },
    { sel: 'users', name: 'a04-admin-users' },
    { sel: 'vehicles', name: 'a05-admin-vehicles' },
    { sel: 'hospitals', name: 'a06-admin-hospitals' },
    { sel: 'tokens', name: 'a07-admin-tokens' },
    { sel: 'integrations', name: 'a08-admin-integrations' },
    { sel: 'system', name: 'a09-admin-system' },
  ];
  for (const s of sections) {
    try {
      const found = await page.evaluate((key) => {
        const items = [...document.querySelectorAll('[onclick*="adm_show"], .sidebar-item, a[href*="#"]')];
        const match = items.find(el => (el.getAttribute('onclick') || '').toLowerCase().includes(key)
                                    || el.id.toLowerCase().includes(key)
                                    || el.textContent.toLowerCase().includes(key));
        if (match) { match.click(); return true; }
        return false;
      }, s.sel);
      if (found) {
        await sleep(1500);
        await shot(page, s.name);
      } else {
        console.log('  section not found:', s.sel);
      }
    } catch(e) { console.log('  err', s.sel, e.message); }
  }

  // Monitor (admin can see)
  await page.goto(BASE + '/monitor/', { waitUntil: 'networkidle2' });
  await sleep(4000);
  await shot(page, 'a10-monitor-main');

  // GPS (admin sees fleet+shared tabs)
  await page.goto(BASE + '/gps/', { waitUntil: 'networkidle2' });
  await sleep(4000);
  await shot(page, 'a11-gps-main');
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1400, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('[page-err]', m.text().slice(0,150)); });

  try {
    await captureUserFlow(page);
    await captureAdminFlow(page);
  } catch(e) {
    console.error('Capture failed:', e.message);
  } finally {
    await browser.close();
  }
  console.log('Done. Files in', OUT);
})();
