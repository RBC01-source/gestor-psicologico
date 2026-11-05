// Genera la versión pública de la demo (sin perfil de administrador) en dist/index.html
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const linea = /,\n \{id:'admin',[^\n]*\}\];/;
if (!linea.test(src)) throw new Error('No se encontró el perfil de administrador');
let out = src.replace(linea, '];');
out = out.replace('Elige uno de los cuatro perfiles.', 'Elige uno de los tres perfiles.');
if (/id:'admin'|admin@gestorpsico/.test(out)) throw new Error('Quedó rastro del perfil de administrador');
fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'index.html'), out);
console.log('dist/index.html generado (' + out.length + ' bytes)');
