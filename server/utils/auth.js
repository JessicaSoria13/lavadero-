const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const SECRETO_DE_EJEMPLO = 'cambiar-este-secreto-en-produccion';

// Sin un JWT_SECRET propio, cualquiera que conozca el secreto de ejemplo podría fabricarse una sesión.
// En ese caso usamos uno aleatorio (las sesiones se cierran cada vez que se reinicia el servidor).
let SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET === SECRETO_DE_EJEMPLO) {
  console.warn('⚠️  JWT_SECRET no configurado (o es el de ejemplo): se usa uno aleatorio. Configuralo en las variables de entorno.');
  SECRET = crypto.randomBytes(32).toString('hex');
}

function firmarToken() {
  return jwt.sign({ rol: 'admin' }, SECRET, { expiresIn: '12h' });
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o vencida' });
  }
}

// Límite de intentos de login por IP, para que no puedan adivinar la contraseña probando muchas
const MAX_INTENTOS = 10;
const VENTANA_MS = 15 * 60 * 1000;
const intentosFallidos = new Map(); // ip -> { cantidad, desde }

function loginBloqueado(ip) {
  const registro = intentosFallidos.get(ip);
  if (!registro) return false;
  if (Date.now() - registro.desde > VENTANA_MS) {
    intentosFallidos.delete(ip);
    return false;
  }
  return registro.cantidad >= MAX_INTENTOS;
}

function registrarLoginFallido(ip) {
  const registro = intentosFallidos.get(ip);
  if (!registro || Date.now() - registro.desde > VENTANA_MS) {
    intentosFallidos.set(ip, { cantidad: 1, desde: Date.now() });
  } else {
    registro.cantidad++;
  }
}

function registrarLoginExitoso(ip) {
  intentosFallidos.delete(ip);
}

module.exports = { firmarToken, requireAdmin, loginBloqueado, registrarLoginFallido, registrarLoginExitoso };
