/* Pruebas automáticas de Gestor Psicológico (demo).
   Uso: node gestor.test.js [ruta/a/page.html]
   Requiere Playwright y Google Chrome instalados. No usa red. */
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const URL = 'file://' + FILE;
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const info = [];
let current = '';
const ok = (cond, msg) => { results.push({ suite: current, ok: !!cond, msg }); if (!cond) console.log('  FALLA:', msg); };
const note = (m) => info.push(`[${current}] ${m}`);
const suite = (n) => { current = n; console.log('\n# ' + n); };

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const ext = []; const errs = [];
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith('file://') || u.startsWith('data:')) return r.continue();
    ext.push(u); return r.abort();
  });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
  page._ext = ext; page._errs = errs; page._ctx = ctx;
  await page.goto(URL);
  return page;
}
async function login(page, id) {
  await page.click(`.role[data-id="${id}"]`);
  await page.click('#lgo');
  await page.waitForSelector('#app:not([hidden])');
}
const navLabels = (page) => page.$$eval('#nav button', (b) => b.map((x) => x.textContent.trim()));
const txt = (page, sel) => page.$eval(sel, (e) => e.innerText);
const go = async (page, r) => { await page.click(`#nav button[data-r="${r}"]`); await page.waitForTimeout(60); };

/* ============ 1. FUNCIONALES ============ */
async function functional(browser) {
  suite('Funcional');
  const p = await newPage(browser, { viewport: { width: 1280, height: 860 } });

  ok(await p.isVisible('#login') && !(await p.isVisible('#app')), 'Al abrir solo se ve el login');
  await p.fill('#em', 'no-es-correo'); await p.click('#lgo');
  ok(await p.isVisible('#lerr'), 'Correo inválido muestra error visible');
  await p.fill('#em', 'otro@dominio.com'); await p.click('#lgo');
  ok((await txt(p, '#lerr')).includes('no está en la demo'), 'Correo desconocido explica qué hacer');
  ok(!(await p.isVisible('#app')), 'Correo desconocido no da acceso');

  // Roles y menú
  await login(p, 'carlos');
  let nav = await navLabels(p);
  ok(nav.length === 11 && !nav.includes('Equipo Clínico') && nav.includes('Facturación') && nav.includes('Planes y precios'), 'Psicólogo: ve Facturación y Planes y precios, y no Equipo Clínico');
  const heading = await txt(p, '#view h1');
  ok(/Buenos días, Dr\. Carlos/.test(heading), 'Saludo con el nombre del usuario');
  const kp = await p.$$eval('.kpi', (k) => k.map((x) => x.innerText.replace(/\s+/g, ' ')));
  ok(kp.some((k) => /Pacientes activos 84/.test(k)), 'Dashboard Carlos: 84 pacientes activos');
  ok(kp.some((k) => /Sesiones esta semana 37/.test(k)), 'Dashboard Carlos: 37 sesiones esta semana');
  ok(kp.some((k) => /Sesiones hoy 6/.test(k)), 'Dashboard Carlos: 6 sesiones hoy (calculadas desde la agenda)');
  ok(kp.some((k) => /Ingresos del mes US\$ 4,850/.test(k)), 'Dashboard Carlos: ingresos US$ 4,850');
  ok((await txt(p, 'main')).includes('José Salas'), 'Alerta de riesgo alto muestra a José Salas');

  // Pacientes
  await go(p, 'pacientes');
  ok((await p.$$('#ptb tr.clk')).length === 7, 'Carlos ve exactamente sus 7 pacientes');
  await p.fill('#q', 'burnout');
  ok((await p.$$('#ptb tr.clk')).length === 1, 'Búsqueda por motivo filtra a 1');
  await p.fill('#q', 'zzz');
  ok((await txt(p, '#ptb')).includes('Ningún paciente'), 'Búsqueda sin resultados muestra mensaje');
  await p.fill('#q', '');
  await p.click('[data-f="int"]');
  ok((await p.$$('#ptb tr.clk')).length === 1, 'Filtro Seguimiento intensivo: 1 paciente');
  await p.click('[data-f="risk"]');
  ok((await p.$$('#ptb tr.clk')).length === 3, 'Filtro riesgo moderado/alto: 3 pacientes');
  await p.click('[data-f="all"]');

  // Ficha
  await p.click('#ptb tr.clk >> nth=0');
  ok((await txt(p, '#view h1')) === 'Ana Ramírez', 'Clic en la primera fila abre a Ana Ramírez');
  for (const [t, esperado] of [['ses', 'Historial de sesiones'], ['soap', 'Sesión 12'], ['doc', 'Consentimiento informado'], ['ia', 'Patrones detectados'], ['res', 'Datos del paciente']]) {
    await p.click(`[data-t="${t}"]`);
    ok((await txt(p, '[role="tabpanel"]')).includes(esperado), `Pestaña ${t} muestra "${esperado}"`);
  }
  await p.click('[data-t="ses"]');
  ok((await p.$$eval('[role="tabpanel"] .li', (l) => l.length)) === 12, 'Ana tiene 12 sesiones en el historial');
  await p.click('[data-t="doc"]');
  ok((await txt(p, '[role="tabpanel"]')).includes('GAD-7'), 'Documentos incluye evaluación GAD-7');

  const sep = await p.evaluate(() => { const k = [...document.querySelector('[role="tabpanel"]').children]; const a = k[0].getBoundingClientRect(), b = k[1].getBoundingClientRect(); return b.top - a.bottom; });
  ok(sep >= 12, 'Ficha: separación vertical entre tarjetas de al menos 12 px (' + Math.round(sep) + ')');
  const kfill = await p.evaluate(() => 0);
  // Escalas
  await p.click('[data-t="esc"]');
  ok(await p.$eval('[data-a="scsave"]', (b) => b.disabled), 'Escalas: guardar está deshabilitado hasta responder todo');
  for (let i = 0; i < 7; i++) await p.check(`#gad-${i}-1`);
  let box = await txt(p, '#scoreBox');
  ok(/7\s*\/\s*21/.test(box) && box.includes('leve'), 'GAD-7: siete respuestas de 1 punto dan 7/21 (leve)');
  ok(await p.$eval('[data-a="scsave"]', (b) => !b.disabled), 'GAD-7: guardar se habilita al completar');
  for (let i = 0; i < 7; i++) await p.check(`#gad-${i}-3`);
  box = await txt(p, '#scoreBox');
  ok(/21\s*\/\s*21/.test(box) && box.includes('severa'), 'GAD-7: el máximo es 21/21 (severa)');
  await p.click('[data-a="scsave"]');
  ok((await txt(p, '[role="tabpanel"]')).includes('21 puntos'), 'GAD-7: el resultado guardado aparece en el historial');
  ok(await p.$eval('[data-a="scsave"]', (b) => b.disabled), 'GAD-7: tras guardar el formulario se reinicia');
  await p.click('[data-k="phq"]');
  for (let i = 0; i < 9; i++) await p.check(`#phq-${i}-0`);
  ok(!(await p.isVisible('#scoreBox .alert')), 'PHQ-9: sin alerta si el ítem 9 es 0');
  await p.check('#phq-8-1');
  box = await txt(p, '#scoreBox');
  ok(await p.isVisible('#scoreBox .alert') && box.includes('Ítem 9'), 'PHQ-9: un ítem 9 positivo muestra la alerta clínica');
  ok(/1\s*\/\s*27/.test(box) && box.includes('mínima'), 'PHQ-9: 1/27 es mínima');
  for (let i = 0; i < 9; i++) await p.check(`#phq-${i}-2`);
  ok((await txt(p, '#scoreBox')).includes('moderadamente severa'), 'PHQ-9: 18 puntos es moderadamente severa');

  // Resumen para copiar
  await p.click('[data-a="sum"]');
  const ta = await p.$eval('#sumta', (t) => t.value);
  ok(ta.includes('Ana Ramírez') && ta.includes('PAC-0001') && ta.includes('Registrado en la demo: GAD-7 21'), 'Resumen: incluye paciente, ID y lo registrado en la demo');
  await p.click('[data-a="copysum"]');
  ok(await p.isVisible('#toast'), 'Resumen: copiar muestra un aviso');
  await p.click('[data-a="sumx"]');
  ok(!(await p.$('#sumta')), 'Resumen: se puede cerrar');

  // Portal del paciente y reserva
  await p.click('[data-a="go"][data-r="portal"]');
  ok((await txt(p, '#view h1')).includes('Hola, Ana'), 'Portal: saluda al paciente');
  ok((await txt(p, 'main')).includes('Mañana · 09:00'), 'Portal: muestra la próxima cita');
  const slots = await p.$$('[data-a="slot"]');
  ok(slots.length >= 10, `Portal: hay horarios disponibles (${slots.length})`);
  ok(await p.$eval('[data-a="book"]', (b) => b.disabled), 'Portal: confirmar está deshabilitado sin elegir horario');
  const k0 = await slots[0].getAttribute('data-k'), t0 = await slots[0].getAttribute('data-t');
  await slots[0].click();
  await p.click('[data-a="book"]');
  ok((await txt(p, 'main')).includes('Reserva enviada'), 'Portal: la reserva se confirma en pantalla');
  ok((await p.$$(`[data-a="slot"][data-k="${k0}"][data-t="${t0}"]`)).length === 0, 'Portal: el horario reservado deja de estar disponible');
  await go(p, 'agenda');
  await p.click(`.cal button[data-d="${+k0.slice(8)}"]`);
  ok((await txt(p, 'main')).includes(t0) && (await txt(p, 'main')).includes('Pendiente'), 'La reserva aparece en la agenda como Pendiente');

  // Consentimiento
  await go(p, 'pacientes');
  await p.click('[data-a="pat"][data-id="PAC-0001"]');
  await p.click('[data-t="con"]');
  ok((await txt(p, '[role="tabpanel"]')).includes('Vigente') && (await txt(p, '[role="tabpanel"]')).includes('v2.1'), 'Consentimiento: paciente con autorización vigente y versión del texto');
  ok((await txt(p, '#view')).includes('Consentimiento vigente'), 'Consentimiento: el estado aparece en la cabecera de la ficha');
  await p.click('[data-a="conout"]');
  ok((await txt(p, '[role="tabpanel"]')).includes('Retirado') && !!(await p.$('#csig')), 'Consentimiento: al retirarlo se muestra Retirado y el formulario para uno nuevo');
  await p.click('#nav button[data-r="sesiones"]'); await p.waitForTimeout(80);
  ok((await txt(p, 'main')).includes('No se puede crear una sesión') && !(await p.$('[data-a="flowgo"]')), 'Sesiones: sin consentimiento no se puede procesar');
  await p.click('[data-a="concta"]');
  ok(!!(await p.$('#csig')), 'Sesiones: "Ir a Consentimiento" abre la pestaña de la ficha');
  ok(await p.$eval('#consave', (b) => b.disabled), 'Consentimiento: registrar está deshabilitado al inicio');
  await p.fill('#csig', 'Ana Ramírez');
  ok(await p.$eval('#consave', (b) => b.disabled), 'Consentimiento: firma sin marcar la casilla obligatoria no habilita el registro');
  await p.check('input[name="ck"][value="care"]');
  await p.fill('#csig', 'Otra Persona');
  ok(await p.$eval('#consave', (b) => b.disabled), 'Consentimiento: una firma que no coincide con el paciente no habilita el registro');
  await p.fill('#csig', ' ana  ramirez ');
  ok(await p.$eval('#consave', (b) => !b.disabled), 'Consentimiento: firma correcta (sin importar tildes ni mayúsculas) habilita el registro');
  await p.selectOption('#cmed', 'Enlace por WhatsApp o correo');
  await p.click('#consave');
  let ct = await txt(p, '[role="tabpanel"]');
  ok(ct.includes('Vigente') && ct.includes('Enlace por WhatsApp o correo') && ct.includes('Dr. Carlos Mendoza'), 'Consentimiento: se guarda con medio y profesional que lo registró');
  ok(ct.includes('Sin autorización de audio o IA'), 'Consentimiento: si no autorizó audio ni IA se avisa que no se puede grabar');
  await p.click('#nav button[data-r="sesiones"]'); await p.waitForTimeout(80);
  ok((await txt(p, 'main')).includes('no autorizó la grabación'), 'Sesiones: sin autorización de audio/IA no se procesa con IA');
  await p.click('[data-a="concta"]');
  await p.click('[data-a="conedit"]');
  await p.check('input[name="ck"][value="audio"]'); await p.check('input[name="ck"][value="ai"]');
  await p.fill('#csig', 'Ana Ramírez');
  await p.click('#consave');
  await p.click('#nav button[data-r="sesiones"]'); await p.waitForTimeout(80);
  ok(!!(await p.$('[data-a="flowgo"]')), 'Sesiones: con audio e IA autorizados vuelve a estar disponible');
  await go(p, 'pacientes');
  await p.click('[data-a="pat"][data-id="PAC-0005"]');
  await p.click('[data-t="con"]');
  ok((await txt(p, '[role="tabpanel"]')).includes('Pendiente'), 'Consentimiento: un paciente sin firma figura como Pendiente');
  await p.click('[data-t="doc"]');
  ok((await txt(p, '[role="tabpanel"]')).includes('Aún no se ha registrado'), 'Documentos: refleja que no hay consentimiento firmado');
  await go(p, 'pacientes');
  await p.click('[data-a="pat"][data-id="PAC-0001"]');

  // Agenda
  await go(p, 'agenda');
  ok((await txt(p, 'main')).includes('Noviembre 2026'), 'Agenda abre en noviembre 2026');
  await p.click('.cal button[data-d="6"]');
  ok((await txt(p, 'main')).includes('Ana Ramírez'), 'El 6 de noviembre aparece Ana Ramírez');
  ok(await p.$eval('[data-a="cal"][data-s="1"]', (b) => !b.disabled), 'Se puede avanzar a diciembre');
  await p.click('[data-a="cal"][data-s="1"]');
  ok(await p.$eval('[data-a="cal"][data-s="1"]', (b) => b.disabled), 'Diciembre es el límite: botón siguiente deshabilitado');

  // Flujo IA
  await go(p, 'sesiones');
  ok(await p.isVisible('[data-a="flowgo"]'), 'Sesiones: botón Procesar con IA visible');
  await p.click('[data-a="flowgo"]');
  await p.waitForSelector('[data-a="flowsave"]', { timeout: 15000 });
  const cards = await p.$$eval('.out h2', (h) => h.map((x) => x.textContent));
  ok(['Audio recibido', 'Transcripción', 'Resumen clínico', 'Nota SOAP', 'Supervisor IA', 'Seguimiento automático', 'Próxima cita'].every((t) => cards.includes(t)), 'El flujo completo genera las 7 etapas');
  ok((await p.$$('.stp.done')).length === 7, 'Las 7 etapas quedan marcadas como completadas');
  await p.click('[data-a="flowsave"]');
  ok((await txt(p, '#view h1')) === 'Ana Ramírez' && (await p.$eval('[data-t="soap"]', (b) => b.getAttribute('aria-selected'))) === 'true', 'Guardar lleva al SOAP del expediente');
  await go(p, 'sesiones');
  ok(await p.isVisible('[data-a="flowsave"]'), 'Al volver a Sesiones se conserva el resultado');

  // Biblioteca
  await go(p, 'biblioteca');
  ok((await p.$$('#bib > div')).length === 14, 'Biblioteca: 14 especialidades');
  const enl = await p.$$eval('#bib a.lk', (a) => a.map((x) => ({ h: x.href, t: x.target, r: x.rel })));
  ok(enl.length === 42 && enl.every((e) => e.h.startsWith('https://') && e.t === '_blank' && /noopener/.test(e.r) && /noreferrer/.test(e.r)), 'Biblioteca: 42 enlaces (3 por especialidad), todos https, en pestaña nueva y con noopener/noreferrer');
  const sc = await p.$$eval('#bib a.lk', (a) => a.filter((x) => /search\.scielo\.org/.test(x.href)).map((x) => decodeURIComponent(new URL(x.href).searchParams.get('q') || '')));
  ok(sc.length === 14 && sc.every((q) => q.length > 3) && sc.filter((q) => / OR /.test(q)).length === 4 && new Set(sc).size === 14, 'Biblioteca: SciELO tiene una consulta distinta por especialidad (4 con OR para ampliar resultados)');
  ok((await p.$$eval('#bib a.lk', (a) => a.filter((x) => /search\.scielo\.org/.test(x.href) && /filter%5Bin%5D%5B%5D=per/.test(x.href)).length)) === 14, 'Biblioteca: SciELO se limita a la colección de Perú');
  ok((await p.$$eval('#view section.card:nth-of-type(2) a.lk', (a) => a.length)) === 6, 'Biblioteca: 6 documentos oficiales del Colegio');
  await p.fill('#bq', 'deporte');
  ok((await p.$$('#bib > div')).length === 1, 'Biblioteca: buscar "deporte" deja 1 especialidad');
  await p.fill('#bq', 'PENITENCIARIA');
  ok((await p.$$('#bib > div')).length === 1, 'Biblioteca: la búsqueda ignora mayúsculas');
  await p.fill('#bq', 'zzz');
  ok((await txt(p, '#bib')).includes('Ninguna especialidad'), 'Biblioteca: sin resultados muestra mensaje');
  await p.fill('#bq', '<img src=x onerror="window.__xss=7">');
  ok(await p.evaluate(() => window.__xss === undefined && !document.querySelector('#bib img')), 'Biblioteca: la búsqueda no ejecuta HTML');

  // IA clínica
  await go(p, 'ia');
  await p.click('[data-q="0"]');
  ok((await txt(p, '#chat')).includes('José Salas'), 'Asistente IA: riesgo alto responde José Salas');
  await p.click('[data-q="2"]');
  ok((await txt(p, '#chat')).includes('abandono'), 'Asistente IA: abandono responde con datos');

  // Radar
  await go(p, 'radar');
  ok((await p.$$('svg.chart polygon.rp')).length === 3, 'Radar dibuja 3 polígonos');
  await p.selectOption('#rsel', 'PAC-0003');
  ok((await txt(p, 'main')).includes('41%'), 'Radar de José Salas muestra 41% de abandono');

  // Seguimiento
  await go(p, 'seguimiento');
  await p.click('[data-v="ok"]');
  ok((await txt(p, 'main')).includes('Asistencia confirmada'), 'WhatsApp: confirmar registra asistencia');
  await p.click('.chips [data-v="ask"]');
  await p.click('[data-v="rs"]'); await p.click('[data-v="p2"]');
  ok((await txt(p, 'main')).includes('martes 10/11'), 'WhatsApp: reprogramar completa el flujo');
  await p.click('[data-k="d"]');
  ok((await p.getAttribute('[data-k="d"]', 'aria-checked')) === 'true', 'Interruptor de automatización cambia de estado');

  // Facturación (psicólogo)
  await go(p, 'facturacion');
  ok((await txt(p, 'main')).includes('US$ 4,850') && !(await p.$('[data-a="bs"]')), 'Facturación de psicólogo: sus cifras y sin selector de clínica');

  // Configuración / tema
  await go(p, 'config');
  const bg1 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await p.click('#themeb');
  const bg2 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(bg1 !== bg2, 'El botón de tema cambia el fondo');

  // Recorrido guiado
  await p.click('#tourb');
  let pasos = 0;
  while (await p.isVisible('#tourbox')) {
    pasos++;
    if (pasos > 12) break;
    await p.click('#tourbox [data-a="tourn"]');
    await p.waitForTimeout(120);
  }
  ok(pasos === 7, `Recorrido de psicólogo tiene 7 pasos (sin Equipo) y termina (${pasos})`);

  // Salida
  await p.click('#outb');
  ok(await p.isVisible('#login') && !(await p.isVisible('#app')), 'Cerrar sesión vuelve al login');

  // Otros roles
  await login(p, 'patricia');
  nav = await navLabels(p);
  ok(nav.includes('Equipo Clínico') && !nav.includes('Facturación') && nav.includes('Planes y precios'), 'Supervisora: ve Equipo y Planes y precios, y no Facturación');
  await go(p, 'pacientes');
  ok((await p.$$('#ptb tr.clk')).length === 13, 'Supervisora ve los 13 pacientes de ejemplo');
  await p.click('#outb');
  await login(p, 'admin');
  nav = await navLabels(p);
  ok(nav.length === 12, 'Administrador ve los 12 módulos');
  await go(p, 'facturacion');
  await p.click('[data-a="bs"][data-v="clinic"]');
  ok((await txt(p, 'main')).includes('US$ 24,380'), 'Admin: facturación de clínica completa US$ 24,380');
  await p.click('[data-a="bt"][data-v="planes"]');
  await p.click('[data-a="cyc"][data-v="y"]');
  const precios = await p.$$eval('.plan .pr', (e) => e.map((x) => x.textContent.match(/US\$(\d+)/)[1]));
  ok(precios.join(',') === '15,39,79', `Planes anuales con 20% de descuento (${precios.join(',')})`);
  // Planes con candados
  ok(!(await p.$('#nav .pb')), 'Plan Clínica: ningún módulo aparece con candado');
  await p.click('[data-a="setplan"][data-p="basic"]');
  ok(await p.$$eval('.plan.cur', (e) => e.length === 1 && e[0].textContent.includes('Basic') && e[0].textContent.includes('Plan actual')), 'Planes: el plan actual pasa a Basic');
  let cand = await p.$$eval('#nav button', (b) => b.filter((x) => x.querySelector('.pb')).map((x) => x.dataset.r));
  ok(cand.join(',') === 'sesiones,ia,radar,seguimiento,equipo', `Basic: candado en sesiones, IA, radar, seguimiento y equipo (${cand})`);
  await go(p, 'sesiones');
  ok((await txt(p, 'main')).includes('Disponible en el plan Pro') && !(await p.$('[data-a="flowgo"]')), 'Basic: Sesiones muestra la pantalla de mejora y no el flujo de IA');
  await go(p, 'pacientes');
  await p.click('[data-a="pat"][data-id="PAC-0001"]');
  ok(await p.$eval('[data-t="soap"] .pb', (b) => b.textContent.includes('Pro')), 'Basic: la pestaña SOAP lleva la etiqueta Pro');
  await p.click('[data-t="soap"]');
  ok((await txt(p, '[role="tabpanel"]')).includes('Disponible en el plan Pro'), 'Basic: la pestaña SOAP pide mejorar el plan');
  await p.click('[data-t="res"]');
  ok(!(await txt(p, '[role="tabpanel"]')).includes('Disponible en el plan'), 'Basic: el resumen del expediente sigue disponible');
  await go(p, 'sesiones');
  await p.click('[data-a="setplan"][data-p="pro"]');
  ok(!!(await p.$('[data-a="flowgo"]')), 'Mejorar a Pro desbloquea Sesiones de inmediato');
  cand = await p.$$eval('#nav button', (b) => b.filter((x) => x.querySelector('.pb')).map((x) => x.dataset.r));
  ok(cand.join(',') === 'radar,equipo', `Pro: solo radar y equipo siguen con candado (${cand})`);
  await go(p, 'equipo');
  ok((await txt(p, 'main')).includes('Disponible en el plan Clínica'), 'Pro: Equipo Clínico requiere el plan Clínica');
  await p.click('[data-a="plans"]');
  ok(!!(await p.$('.plan')), 'Ver planes abre la pestaña de planes de Facturación');
  await p.click('[data-a="setplan"][data-p="clinica"]');
  ok(!(await p.$('#nav .pb')), 'Mejorar a Clínica quita todos los candados');
  await go(p, 'facturacion'); await p.click('[data-a="bt"][data-v="planes"]'); await p.click('[data-a="setplan"][data-p="basic"]');
  await p.click('[data-a="logout"]'); await login(p, 'carlos');
  await go(p, 'sesiones');
  ok((await txt(p, 'main')).includes('Pedir al administrador') && !(await p.$('[data-a="setplan"]')), 'Psicólogo sin permiso de administrador: puede pedir la mejora pero no cambiar el plan');
  await p.click('[data-a="logout"]'); await login(p, 'admin');
  await go(p, 'facturacion'); await p.click('[data-a="bt"][data-v="planes"]'); await p.click('[data-a="setplan"][data-p="clinica"]');

  // Comparador de planes: lo ven todos, solo el administrador cambia el plan
  await go(p, 'planes');
  ok((await p.$$('main .plan')).length === 3 && (await p.$$('main .cmp tbody tr')).length === 12, 'Planes y precios: 3 planes y tabla de 12 filas');
  ok((await p.$$('main [data-a="setplan"]')).length === 2, 'Admin: puede cambiar a los otros dos planes desde Planes y precios');
  await p.click('main [data-a="setplan"][data-p="basic"]');
  ok((await txt(p, 'main')).includes('38 de 50') && (await p.$eval('main [role="progressbar"]', (m) => m.getAttribute('aria-valuenow') === '38' && m.getAttribute('aria-valuemax') === '50')), 'Plan Basic: barra de uso "38 de 50"');
  await p.click('main [data-a="setplan"][data-p="clinica"]');
  ok((await txt(p, 'main')).includes('Sin límite de pacientes') || (await txt(p, 'main')).includes('no tiene límite'), 'Plan Clínica: sin límite de pacientes');
  await p.click('[data-a="logout"]'); await login(p, 'carlos');
  await go(p, 'planes');
  ok((await p.$$('main .plan')).length === 3 && !(await p.$('main [data-a="setplan"]')), 'Psicólogo: ve los 3 planes y no puede cambiar el plan');
  const quiero = await p.$$eval('main .plan button:not([disabled])', (b) => b.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  ok(quiero.length === 2 && quiero.every((t) => t.startsWith('Quiero este plan')), `Psicólogo: botón "Quiero este plan" en los otros planes (${quiero})`);
  await p.click('main .plan button:not([disabled])');
  ok((await txt(p, '#toast')).includes('se abre el pago'), 'Quiero este plan: aviso simulado de pago');
  await go(p, 'sesiones');
  await p.click('[data-a="logout"]');
  await p.click('[data-a="pbopen"]');
  ok(await p.isVisible('#plansbox') && (await p.$$('#plansbox .plan')).length === 3 && !(await p.$('#plansbox .plan.cur')), 'Login: "Ver planes y precios" abre la comparación sin marcar plan actual');
  ok(await p.evaluate(() => document.activeElement.id === 'pbx'), 'Comparación en login: el foco pasa al botón Cerrar');
  await p.keyboard.press('Escape');
  ok(!(await p.isVisible('#plansbox')) && await p.evaluate(() => document.activeElement.dataset.a === 'pbopen'), 'Escape cierra la comparación y devuelve el foco');
  await login(p, 'admin');

  await go(p, 'equipo');
  ok((await txt(p, 'main')).includes('243') && (await txt(p, 'main')).includes('518'), 'Equipo muestra 243 pacientes y 518 sesiones');
  ok(p._errs.length === 0, 'Sin errores de consola ni excepciones: ' + p._errs.join(' | '));
  await p._ctx.close();
}

/* ============ 2. SEGURIDAD ============ */
async function security(browser) {
  suite('Seguridad');
  const src = fs.readFileSync(FILE, 'utf8');
  ok(!/\son[a-z]+\s*=\s*["']/i.test(src.replace(/<script>[\s\S]*<\/script>/, '')), 'Sin manejadores de eventos en línea (onclick=…) en el HTML');
  ok(!/\beval\s*\(|new Function\s*\(|document\.write\s*\(/.test(src), 'Sin eval, new Function ni document.write');
  ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(src), 'El código no hace peticiones de red');
  ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(src), 'No guarda nada en el navegador');
  ok(!/href="javascript:/i.test(src), 'Sin enlaces javascript:');
  ok((src.match(/https?:\/\/[^\s"')]+/g) || []).every((u) => /fonts\.(googleapis|gstatic)\.com|www\.w3\.org|^https:\/\/(www\.)?(cpsp\.pe|cpsplimaycallao\.org\.pe|search\.scielo\.org|redalyc\.org|alicia\.concytec\.gob\.pe)/.test(u)), 'Los únicos recursos externos son fuentes de Google y enlaces a la Biblioteca (https, dominios esperados)');
  ok(/type="password"[^>]*autocomplete="off"|autocomplete="off"[^>]*type="password"/.test(src), 'El campo de contraseña es type=password');

  const p = await newPage(browser, { viewport: { width: 1280, height: 860 } });
  await login(p, 'carlos');
  await go(p, 'pacientes');
  const payloads = ['<img src=x onerror="window.__xss=1">', '"><script>window.__xss=2</script>', "'><svg onload=window.__xss=3>"];
  for (const pl of payloads) {
    await p.fill('#q', pl);
    await p.click('[data-f="act"]'); // fuerza re-render con el valor en el atributo
    await p.waitForTimeout(40);
  }
  ok(await p.evaluate(() => window.__xss === undefined), 'XSS en búsqueda: ningún payload se ejecuta');
  ok(await p.evaluate(() => !document.querySelector('#view img[src="x"], #view svg[onload], #view script')), 'XSS en búsqueda: no se inyectan elementos');
  ok((await p.$eval('#q', (e) => e.value)).startsWith("'><svg"), 'La búsqueda conserva el texto escrito como texto');
  await p.click('#outb');
  await p.fill('#em', '<img src=x onerror="window.__xss=9">@x.com'); await p.click('#lgo');
  ok(await p.evaluate(() => window.__xss === undefined && !document.querySelector('#lerr img')), 'XSS en login: no se ejecuta ni se refleja');

  // Control de acceso por URL
  await login(p, 'carlos');
  await p.evaluate(() => { location.hash = 'equipo'; });
  await p.waitForTimeout(80);
  ok((await txt(p, 'main')).includes('Acceso restringido'), 'Psicólogo que fuerza #equipo ve "Acceso restringido"');
  ok(!(await txt(p, 'main')).includes('Dra. Laura'), 'Y no se filtran datos del equipo');
  await p.click('#outb');
  await login(p, 'patricia');
  await p.evaluate(() => { location.hash = 'facturacion'; });
  await p.waitForTimeout(80);
  ok((await txt(p, 'main')).includes('Acceso restringido'), 'Supervisora que fuerza #facturacion ve "Acceso restringido"');
  await p.click('#outb');

  // Aislamiento entre psicólogos
  await login(p, 'ana');
  await p.evaluate(() => { location.hash = 'ficha'; });
  await p.waitForTimeout(80);
  const nombre = await txt(p, '#view h1');
  ok(['Rodrigo Paredes', 'Lucía Campos', 'Valeria Núñez'].includes(nombre), `Dra. Torres con #ficha ve solo un paciente propio (${nombre})`);
  const todo = await p.evaluate(() => document.body.innerText);
  ok(!/Ana Ramírez|José Salas|Luis Fernández/.test(todo), 'Dra. Torres no ve pacientes del Dr. Mendoza en ninguna parte de la página');
  await p.evaluate(() => { location.hash = 'portal'; });
  await p.waitForTimeout(80);
  ok(/Hola, (Rodrigo|Lucía|Valeria)/.test(await txt(p, '#view h1')), 'Dra. Torres con #portal ve solo un paciente propio');
  ok(!/Ana Ramírez|José Salas|Luis Fernández/.test(await txt(p, 'main')), 'El portal no muestra pacientes ajenos');
  await go(p, 'radar');
  const opts = await p.$$eval('#rsel option', (o) => o.map((x) => x.textContent));
  ok(opts.length === 3 && !opts.includes('Ana Ramírez'), 'El selector del radar solo lista pacientes propios');
  await go(p, 'ia');
  await p.click('[data-q="0"]'); await p.click('[data-q="2"]');
  ok(!/José Salas|Ana Ramírez/.test(await txt(p, '#chat')), 'El asistente IA solo responde con pacientes propios');

  // Cierre de sesión
  await p.click('#outb');
  const resto = await p.evaluate(() => ({ view: document.querySelector('#view').innerText, nav: document.querySelector('#nav').innerText, hash: location.hash, user: document.querySelector('#uchip').innerText }));
  ok(resto.view.trim() === '' && resto.nav.trim() === '' && resto.user.trim() === '', 'Tras cerrar sesión no quedan datos de pacientes ni usuario en el DOM');
  ok(resto.hash === '', 'Tras cerrar sesión se limpia la ruta (#)');
  await p.evaluate(() => { location.hash = 'pacientes'; });
  await p.waitForTimeout(80);
  ok(await p.isVisible('#login') && !(await p.isVisible('#app')), 'Sin sesión, forzar #pacientes no abre la app');
  ok(await p.$eval('#pw', (e) => e.value === ''), 'La contraseña no queda en el formulario');

  // Red y almacenamiento
  const otros = p._ext.filter((u) => !/fonts\.(googleapis|gstatic)\.com/.test(u));
  ok(otros.length === 0, 'Ninguna petición a dominios distintos de fuentes: ' + otros.join(','));
  ok(await p.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0 && document.cookie === ''), 'Sin cookies ni almacenamiento local tras usar la app');
  await p._ctx.close();
}

/* ============ 3. USABILIDAD (usuario simulado) ============ */
const ROUTES = { psi: ['dashboard', 'pacientes', 'agenda', 'sesiones', 'ia', 'biblioteca', 'radar', 'seguimiento', 'facturacion', 'planes', 'config'], adm: ['dashboard', 'pacientes', 'agenda', 'sesiones', 'ia', 'biblioteca', 'radar', 'seguimiento', 'facturacion', 'planes', 'equipo', 'config'] };

async function clickability(page, label, minH) {
  return page.evaluate(({ minH }) => {
    const bad = [], small = [];
    const sel = 'button:not([disabled]),a[href],input,select,[role="tab"],tr.clk,summary';
    document.querySelectorAll('#app:not([hidden]) ' + sel + ',#login:not([hidden]) ' + sel).forEach((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || el.closest('[hidden]') || el.closest('.side:not(.open)') && innerWidth <= 900) return;
      if (el.matches('tr.clk')) return;
      const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = r.top + r.height / 2;
      if (r.top < 0 || r.bottom > innerHeight) { el.scrollIntoView({ block: 'center' }); }
      const r2 = el.getBoundingClientRect(), y2 = r2.top + r2.height / 2;
      const top = document.elementFromPoint(x, y2);
      if (!top || !(el === top || el.contains(top) || top.contains(el))) bad.push((el.dataset.a || el.id || el.tagName) + ' tapado por ' + (top ? (top.id || top.className || top.tagName) : 'nada'));
      if (r2.height < minH - 0.6 || r2.width < 24) small.push((el.dataset.a || el.id || el.tagName) + ' ' + Math.round(r2.width) + 'x' + Math.round(r2.height));
    });
    return { bad, small };
  }, { minH });
}
async function overflowX(page) {
  return page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, off: [...document.querySelectorAll('#app:not([hidden]) *, #login:not([hidden]) *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.tw') && !e.closest('.tabs') && !e.closest('.side') && !e.closest('svg') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map((e) => e.tagName + '.' + e.className) }));
}

async function usability(browser) {
  suite('Usabilidad');
  const p = await newPage(browser, { viewport: { width: 1280, height: 860 } });

  // Teclado en el login
  await p.keyboard.press('Tab');
  const focusables = [];
  for (let i = 0; i < 9; i++) { focusables.push(await p.evaluate(() => document.activeElement.id || document.activeElement.dataset.a || document.activeElement.tagName)); await p.keyboard.press('Tab'); }
  ok(focusables.includes('em') && focusables.includes('pw') && focusables.includes('lgo'), 'Login: se llega a correo, contraseña y botón solo con Tab');
  await p.focus('#em'); await p.keyboard.press('Enter');
  ok(await p.isVisible('#app'), 'Login: Enter en el correo inicia sesión');

  // Teclado en tabla de pacientes
  await go(p, 'pacientes');
  await p.focus('#ptb tr.clk >> nth=0'); await p.keyboard.press('Enter');
  ok((await txt(p, '#view h1')) === 'Ana Ramírez', 'Pacientes: Enter sobre una fila abre el expediente');
  const outline = await p.evaluate(() => { document.querySelector('[data-t="ses"]').focus(); const s = getComputedStyle(document.activeElement); return s.outlineStyle + ' ' + s.outlineWidth; });
  note('Foco visible en pestañas: ' + outline);
  ok(!/none/.test(outline), 'El foco por teclado es visible');

  // Clics muertos: cada control cambia algo. Cada clic parte de un estado limpio.
  const dead = [];
  const snap = () => document.body.innerHTML + '|' + location.hash + '|' + (document.querySelector('#toast').hidden ? '' : 'toast');
  for (const rol of [['carlos', 'psi'], ['admin', 'adm']]) {
    for (const r of ROUTES[rol[1]]) {
      const fresh = async () => { await p.reload(); await login(p, rol[0]); await p.evaluate((h) => { location.hash = h; }, r); await p.waitForTimeout(60); };
      await fresh();
      // En facturación se prueba también la pestaña de planes
      const variantes = r === 'facturacion' && rol[1] === 'adm' ? [null, 'planes'] : [null];
      for (const v of variantes) {
        if (v) { await p.click('[data-a="bt"][data-v="planes"]'); }
        const lista = await p.evaluate(() => [...document.querySelectorAll('#view [data-a]')].map((e, i) => ({ i, a: e.dataset.a, dis: e.disabled, sel: e.getAttribute('aria-pressed') === 'true' || e.getAttribute('aria-selected') === 'true', t: (e.textContent || '').trim().slice(0, 24) })));
        const vistos = {};
        for (const it of lista) {
          if (it.dis || it.sel || ['logout', 'tour', 'menu'].includes(it.a)) continue;
          const k = it.a + (it.a === 'day' ? '' : it.t); vistos[k] = (vistos[k] || 0) + 1; if (vistos[k] > 2) continue;
          await fresh(); if (v) await p.click('[data-a="bt"][data-v="planes"]');
          const cambio = await p.evaluate((i) => { const el = document.querySelectorAll('#view [data-a]')[i]; document.querySelector('#toast').hidden = true; const b = document.body.innerHTML + '|' + location.hash + '|'; el.click(); const a = document.body.innerHTML + '|' + location.hash + '|' + (document.querySelector('#toast').hidden ? '' : 'toast'); return b !== a; }, it.i);
          if (!cambio) dead.push(`${rol[0]}/${r}: "${it.t}" (${it.a})`);
        }
      }
    }
  }
  ok(dead.length === 0, 'Ningún control responde sin efecto visible: ' + dead.join('; '));
  await p._ctx.close();
}

/* ============ 4. DISPOSITIVOS ============ */
const DEVICES = [
  ['Android · Pixel 7', 'Pixel 7'],
  ['Android · Galaxy S9+', 'Galaxy S9+'],
  ['iPhone 14', 'iPhone 14'],
  ['iPhone SE', 'iPhone SE'],
  ['iPad (portrait)', 'iPad (gen 7)'],
  ['iPad Pro 11 (landscape)', 'iPad Pro 11 landscape'],
  ['Escritorio 1366', null]
];
async function devicesSuite(browser) {
  suite('Dispositivos');
  for (const [label, key] of DEVICES) {
    const opts = key ? { ...devices[key] } : { viewport: { width: 1366, height: 768 } };
    delete opts.defaultBrowserType;
    const p = await newPage(browser, opts);
    const vw = (await p.evaluate(() => innerWidth));
    const mobile = vw <= 900;
    const slug = label.replace(/[^a-z0-9]+/gi, '_');
    const probs = { overflow: [], bad: [], small: [], err: [] };

    let o = await overflowX(p);
    if (o.sw > o.iw + 1 || o.off.length) probs.overflow.push('login ' + o.sw + '>' + o.iw + ' ' + o.off.join(','));
    const minH = opts.hasTouch ? 44 : 34;
    let c = await clickability(p, 'login', minH); probs.bad.push(...c.bad.map((x) => 'login:' + x)); probs.small.push(...c.small.map((x) => 'login:' + x));
    await p.screenshot({ path: path.join(OUT, slug + '_login.png') });

    await login(p, 'admin');
    for (const r of ROUTES.adm) {
      if (mobile) { await p.click('#menub'); await p.waitForTimeout(260); await p.click(`#nav button[data-r="${r}"]`); await p.waitForTimeout(260); }
      else { await go(p, r); }
      if (r === 'sesiones') { await p.click('[data-a="flowgo"]'); await p.waitForSelector('[data-a="flowsave"]', { timeout: 15000 }); }
      if (r === 'facturacion') { await p.click('[data-a="bt"][data-v="planes"]'); }
      o = await overflowX(p);
      if (o.sw > o.iw + 1 || o.off.length) probs.overflow.push(r + ' ' + o.sw + '>' + o.iw + ' ' + o.off.join(','));
      c = await clickability(p, r, minH); probs.bad.push(...c.bad.map((x) => r + ':' + x)); probs.small.push(...c.small.map((x) => r + ':' + x));
      if (['dashboard', 'sesiones', 'radar', 'seguimiento', 'agenda'].includes(r)) { await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: path.join(OUT, `${slug}_${r}.png`) }); }
    }
    // ficha
    if (mobile) { await p.click('#menub'); await p.waitForTimeout(260); await p.click('#nav button[data-r="pacientes"]'); } else await go(p, 'pacientes');
    await p.click('#ptb tr.clk >> nth=0'); await p.waitForTimeout(60);
    o = await overflowX(p); if (o.sw > o.iw + 1 || o.off.length) probs.overflow.push('ficha ' + o.sw + '>' + o.iw + ' ' + o.off.join(','));
    await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: path.join(OUT, slug + '_ficha.png') });
    // tema oscuro
    await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: path.join(OUT, slug + '_ficha_oscuro.png') });

    await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await p.click('[data-t="esc"]'); await p.waitForTimeout(60);
    o = await overflowX(p); if (o.sw > o.iw + 1 || o.off.length) probs.overflow.push('escalas ' + o.sw + '>' + o.iw + ' ' + o.off.join(','));
    c = await clickability(p, 'escalas', minH); probs.bad.push(...c.bad.map((x) => 'escalas:' + x)); probs.small.push(...c.small.map((x) => 'escalas:' + x));
    await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: path.join(OUT, slug + '_escalas.png') });
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.click('[data-t="con"]'); await p.waitForTimeout(60);
    await p.click('[data-a="conout"]'); await p.waitForTimeout(60);
    await p.evaluate(() => { document.querySelector('#toast').hidden = true; });
    o = await overflowX(p); if (o.sw > o.iw + 1 || o.off.length) probs.overflow.push('consentimiento ' + o.sw + '>' + o.iw + ' ' + o.off.join(','));
    c = await clickability(p, 'consentimiento', minH); probs.bad.push(...c.bad.map((x) => 'consentimiento:' + x)); probs.small.push(...c.small.map((x) => 'consentimiento:' + x));
    await p.screenshot({ path: path.join(OUT, slug + '_consentimiento.png') });
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.click('[data-t="esc"]'); await p.waitForTimeout(60);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.click('[data-a="go"][data-r="portal"]'); await p.waitForTimeout(60);
    o = await overflowX(p); if (o.sw > o.iw + 1 || o.off.length) probs.overflow.push('portal ' + o.sw + '>' + o.iw + ' ' + o.off.join(','));
    c = await clickability(p, 'portal', minH); probs.bad.push(...c.bad.map((x) => 'portal:' + x)); probs.small.push(...c.small.map((x) => 'portal:' + x));
    await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: path.join(OUT, slug + '_portal.png') });
    ok(probs.overflow.length === 0, `${label}: sin desplazamiento horizontal en ninguna pantalla ${probs.overflow.join(' | ')}`);
    ok(probs.bad.length === 0, `${label}: ningún botón tapado por otro elemento ${probs.bad.slice(0, 4).join(' | ')}`);
    ok(probs.small.length === 0, `${label}: objetivos táctiles suficientes (44 px en pantallas táctiles, 34 px en escritorio) ${probs.small.slice(0, 5).join(' | ')}`);
    ok(p._errs.length === 0, `${label}: sin errores de consola ${p._errs.join(' | ')}`);
    if (mobile) {
      // el menú lateral se abre, se cierra y no tapa botones cuando está cerrado
      await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
      const closed = await p.evaluate(() => { const r = document.querySelector('#side').getBoundingClientRect(); return r.right <= 1; });
      ok(closed, `${label}: el menú lateral está fuera de pantalla al inicio`);
      await p.click('#menub'); await p.waitForTimeout(260);
      ok(await p.evaluate(() => document.querySelector('#side').getBoundingClientRect().left >= 0), `${label}: el botón de menú abre el panel`);
      await p.click('#scrim', { position: { x: 340, y: 300 } }).catch(() => {});
      await p.keyboard.press('Escape'); await p.waitForTimeout(260);
      ok(await p.evaluate(() => document.querySelector('#side').getBoundingClientRect().right <= 1), `${label}: Escape cierra el panel`);
    }
    await p._ctx.close();
  }
}

/* ============ 5. CONTRASTE (WCAG AA) ============ */
async function contrast(browser) {
  suite('Contraste');
  const p = await newPage(browser, { viewport: { width: 1280, height: 860 } });
  for (const theme of ['light', 'dark']) {
    const fails = new Map();
    await login(p, 'admin');
    await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    for (const r of ROUTES.adm.concat(['ficha', 'ficha-con', 'portal'])) {
      await p.evaluate((h) => { location.hash = h; }, r === 'ficha-con' ? 'ficha' : r); await p.waitForTimeout(80);
      if (r === 'ficha-con') { await p.click('[data-t="con"]'); if (await p.$('[data-a="conout"]')) await p.click('[data-a="conout"]'); await p.check('input[name="ck"][value="care"]'); }
      if (r === 'ficha') { await p.click('[data-t="esc"]'); await p.click('[data-k="phq"]'); await p.check('#phq-8-1'); }
      if (r === 'facturacion') await p.click('[data-a="bt"][data-v="planes"]');
      const res = await p.evaluate(() => {
        const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(',').map(Number); return { r: a[0], g: a[1], b: a[2], a: a[3] === undefined ? 1 : a[3] }; };
        const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
        const bgOf = (el) => { let layers = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255 }; if (!layers.length || layers[layers.length - 1].a < 1) base = parse(getComputedStyle(document.body).backgroundColor) || base; layers.reverse().forEach((c) => { base = { r: base.r * (1 - c.a) + c.r * c.a, g: base.g * (1 - c.a) + c.g * c.a, b: base.b * (1 - c.a) + c.b * c.a }; }); return base; };
        const out = [];
        document.querySelectorAll('#app:not([hidden]) *').forEach((el) => {
          if (el.closest('svg') || el.closest('.side') || el.closest('.ph-h')) return;
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!own) return; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || el.closest('[hidden]') || el.offsetParent === null) return;
          const fg = parse(cs.color), bg = bgOf(el); const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
          const px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700; const need = (px >= 24 || (px >= 18.66 && bold)) ? 3 : 4.5;
          if (el.disabled) return;
          if (ratio < need) out.push({ k: cs.color + '|' + `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`, ratio: Math.round(ratio * 100) / 100, need, t: el.textContent.trim().slice(0, 28), cls: el.className });
        });
        return out;
      });
      res.forEach((x) => { if (!fails.has(x.k)) fails.set(x.k, { ...x, rutas: [r] }); else if (!fails.get(x.k).rutas.includes(r)) fails.get(x.k).rutas.push(r); });
    }
    const lst = [...fails.values()];
    ok(lst.length === 0, `Tema ${theme}: todos los textos cumplen contraste AA ` + lst.map((f) => `"${f.t}" ${f.ratio}:1 (${f.cls})`).slice(0, 6).join('; '));
    await p.click('#outb');
  }
  await p._ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const only = process.argv[3] || process.env.SUITE;
  const suites = { functional, security, usability, devicesSuite, contrast };
  for (const [n, f] of Object.entries(suites)) { if (only && only !== n) continue; try { await f(browser); } catch (e) { ok(false, `${n} se interrumpió: ${e.message.split('\n')[0]}`); } }
  await browser.close();
  const fail = results.filter((r) => !r.ok);
  const bySuite = {};
  results.forEach((r) => { (bySuite[r.suite] = bySuite[r.suite] || { p: 0, f: 0 })[r.ok ? 'p' : 'f']++; });
  console.log('\n==== RESUMEN ====');
  Object.entries(bySuite).forEach(([s, v]) => console.log(`${s}: ${v.p} ok, ${v.f} fallan`));
  console.log(`Total: ${results.length - fail.length}/${results.length}`);
  fs.writeFileSync(path.join(__dirname, 'resultado.json'), JSON.stringify({ results, info }, null, 1));
  if (info.length) console.log('\nNotas:\n' + info.join('\n'));
  process.exit(fail.length ? 1 : 0);
})();
