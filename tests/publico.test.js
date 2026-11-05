// Comprueba que la versión pública no ofrece el modo administrador
const { chromium } = require('playwright');
const path = require('path');
let fallos = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FALLA ') + m); if (!c) fallos++; };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' });
  const p = await browser.newPage();
  await p.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html'));
  ok((await p.$$('.role')).length === 3, 'La pantalla de inicio ofrece solo 3 perfiles');
  ok(!/Admin GP|Administrador/.test(await p.evaluate(() => document.body.innerText)), 'No aparece "Admin GP" ni "Administrador"');
  await p.fill('#em', 'admin@gestorpsico.com');
  await p.click('#lgo');
  ok(await p.isVisible('#login') && await p.isVisible('#lerr'), 'Escribir el correo del administrador no permite entrar');
  await p.click('.role[data-id="patricia"]'); await p.click('#lgo'); await p.waitForSelector('#app:not([hidden])');
  for (const r of ['facturacion', 'configuracion']) {
    await p.evaluate((h) => { location.hash = h; }, r); await p.waitForTimeout(80);
    ok((await p.evaluate(() => document.querySelector('main').innerText)).includes('Acceso restringido'), 'La supervisora no accede a #' + r);
  }
  ok(!(await p.evaluate(() => document.body.innerText)).includes('Planes'), 'No aparece la pestaña de planes');
  await browser.close();
  console.log(fallos ? 'Público: ' + fallos + ' fallan' : 'Público: todo correcto');
  process.exit(fallos ? 1 : 0);
})();
