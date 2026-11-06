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
  await p.evaluate(() => { location.hash = 'facturacion'; }); await p.waitForTimeout(80);
  await p.evaluate(() => { location.hash = 'planes'; }); await p.waitForTimeout(80);
  ok((await p.$$('main .plan')).length === 3, 'La supervisora ve la comparación de planes');
  ok(!(await p.$('[data-a="setplan"]')) && !(await p.$('[data-a="bt"][data-v="planes"]')), 'Sin botones para cambiar de plan ni pestaña de planes de administrador');
  ok(!/Admin GP|Administrador\/a|Mejorar a|Cambiar a/.test(await p.evaluate(() => document.body.innerText)), 'Comparación pública sin textos de administrador');
  await p.click('main .plan button:not([disabled]) >> nth=0');
  ok(await p.isVisible('#rnom') && !/Admin GP|Administrador\/a/.test(await p.evaluate(() => document.querySelector('#plansbox').innerText)), 'El registro simulado funciona en la versión pública');
  await browser.close();
  console.log(fallos ? 'Público: ' + fallos + ' fallan' : 'Público: todo correcto');
  process.exit(fallos ? 1 : 0);
})();
