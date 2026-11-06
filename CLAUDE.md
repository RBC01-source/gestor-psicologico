# Gestor Psicológico (demo)

Demo navegable de un software de gestión para psicólogos y clínicas (Perú). Todo es simulado: sin servidor, sin IA real, datos ficticios.

## Estructura
- `index.html`: la app completa en un solo archivo (HTML + CSS + JS sin dependencias). Versión completa, con perfil de administrador.
- `scripts/build-publico.js`: genera `dist/index.html` sin el perfil de administrador. Esa versión se publica en la rama `gh-pages` (GitHub Pages).
- `tests/gestor.test.js`: pruebas con Playwright (baterías `functional`, `security`, `usability`, `devicesSuite`, `contrast`). `tests/publico.test.js`: comprueba que la versión pública no ofrece el modo administrador.
- `.github/workflows/tests.yml`: corre `npm test` en cada push.

## Comandos
- `npm install`, luego `npm test` (todas las baterías, unos 4 min) o `SUITE=functional npm test` (una sola).
- `npm run test:publico`: construye la versión pública y la prueba.
- Si Chrome no está en `/usr/bin/google-chrome`, define `CHROME_PATH`.

## Cómo está hecha la app
- Estado en el objeto `S`; rutas por hash con `go(r)`; vistas en `V`, pestañas de la ficha en `T`.
- Eventos por delegación: botones con `data-a="accion"` y un mapa de acciones `A`. No hay manejadores en línea, ni `eval`, ni red, ni almacenamiento del navegador.
- Roles: `psi`, `sup`, `adm`. El acceso se decide en `allowed()`. Cada psicólogo solo ve sus pacientes.
- Fecha fija de la demo: 5 nov 2026, 10:12.
- Módulos: dashboard, pacientes, expediente (Resumen, Sesiones, SOAP, Escalas GAD-7/PHQ-9, Consentimiento, Documentos, IA), agenda, flujo de IA, radar, WhatsApp, facturación y planes, equipo, Biblioteca, portal del paciente con reserva. Planes simulados: `S.plan` (basic/pro/clinica) con candados por módulo (`RMIN`) y por pestaña (`TMIN`); solo el administrador cambia el plan.

## Reglas al cambiar cosas
- Cuida el tema claro y oscuro (variables en `:root`), el contraste AA y los objetivos táctiles de 44 px.
- Textos de la interfaz en español.
- Después de cada cambio corre las baterías y no subas nada con fallos.
- Si tocas el perfil de administrador, revisa que `scripts/build-publico.js` siga encontrando su línea en `US`.

## Publicación
- `main`: código completo. `gh-pages`: solo la demo pública (sin administrador). Para actualizarla: `npm run build:publico` y copiar `dist/index.html` a la rama `gh-pages` como `index.html`.
- Existe además una copia privada en un artefacto de Claude. Eso no depende del repositorio.

## Pendiente / ideas
- Barra de uso por plan (por ejemplo "pacientes 38 de 50"), si se quiere reforzar la diferencia entre planes.
- Enlaces de búsqueda de SciELO, Redalyc y ALICIA en la Biblioteca: sin verificar. Los 6 oficiales del Colegio de Psicólogos sí están verificados.
- Probar en un iPhone o iPad reales (las pruebas solo emulan con Chrome).
- Para producto real: servidor, autenticación, cifrado, registro de accesos, IA real, WhatsApp oficial, cobros y cumplimiento de la Ley 29733. El texto del consentimiento es de ejemplo y debe revisarlo un abogado.
