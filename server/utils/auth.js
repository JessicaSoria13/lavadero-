const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'cambiar-este-secreto-en-produccion';

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

module.exports = { firmarToken, requireAdmin };
