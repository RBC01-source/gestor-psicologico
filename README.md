# Gestor Psicológico (demo)

Demo navegable de un software de gestión para psicólogos y clínicas: login por roles, dashboard, CRM de pacientes, expediente clínico con pestañas, agenda, flujo de IA (audio → transcripción → resumen → SOAP → supervisor IA → seguimiento), radar clínico, seguimiento por WhatsApp, facturación, planes y equipo clínico.

Es un único archivo, `index.html`, sin dependencias ni paso de compilación. Ábrelo en el navegador.

## Aviso importante

Todo es simulado. No hay servidor, ni autenticación real, ni IA real. Los pacientes, cifras y conversaciones son ficticios. La app no guarda datos y no hace peticiones de red (solo carga fuentes de Google).

Antes de usar datos clínicos reales hacen falta, como mínimo: autenticación y permisos en el servidor, cifrado en tránsito y en reposo, registro de accesos y cumplimiento de la normativa de datos de salud aplicable.

## Perfiles de la demo

| Perfil | Rol | Qué ve |
|---|---|---|
| Dr. Carlos Mendoza | Psicólogo | Solo sus pacientes y su facturación |
| Dra. Ana Torres | Psicóloga | Solo sus pacientes |
| Patricia Rivas | Supervisora | Todos los pacientes y el equipo clínico |
| Admin GP | Administrador | Todo, incluida facturación de la clínica y planes |

El botón "Recorrido de 3 min" de la barra superior guía por las pantallas clave.

## Pruebas automáticas

Requisitos: Node 18 o superior y Google Chrome.

```bash
npm install
npm test                      # todas las baterías (unos 4 minutos)
SUITE=security npm test       # una sola batería
```

Baterías: `functional`, `security`, `usability`, `devicesSuite`, `contrast`.

| Batería | Qué comprueba |
|---|---|
| functional | Roles, datos por perfil, búsqueda, expediente, agenda, flujo IA, radar, WhatsApp, facturación, recorrido |
| security | Sin XSS, control de acceso por URL, aislamiento entre psicólogos, limpieza al cerrar sesión, sin red ni almacenamiento |
| usability | Teclado, foco visible y controles sin efecto |
| devicesSuite | Pixel 7, Galaxy S9+, iPhone 14, iPhone SE, iPad y escritorio: sin desborde, sin botones tapados, objetivos táctiles de 44 px |
| contrast | Contraste WCAG AA en tema claro y oscuro |

Las capturas por dispositivo se guardan en `tests/shots/`.

Los dispositivos se emulan con Chrome. No sustituyen una prueba en un iPhone o iPad reales, porque Safari usa otro motor (WebKit).

Si Chrome no está en `/usr/bin/google-chrome`, define `CHROME_PATH`.
