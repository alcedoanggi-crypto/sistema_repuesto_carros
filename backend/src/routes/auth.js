// Registro, inicio de sesión y perfil
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../utils/errors.js';

const r = Router();
const LABELS = { name: 'Nombre', email: 'Correo', password: 'Contraseña', doc_id: 'Cédula/RIF', phone: 'Teléfono' };

/** Datos públicos del usuario (sin hash) */
export const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, customer_type: u.customer_type,
  doc_id: u.doc_id, phone: u.phone, permissions: u.permissions || [],
});

// Intentos fallidos de login por IP (protección básica contra fuerza bruta)
const attempts = new Map();
function throttle(ip) {
  const now = Date.now();
  const a = attempts.get(ip) || { count: 0, until: 0 };
  if (a.until > now) throw new HttpError(429, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
  return a;
}

r.post('/register',
  validate({ name: 'required|minlen:3|maxlen:120', email: 'required|email', password: 'required|minlen:8',
             doc_id: 'docid', phone: 'phone' }, LABELS),
  async (req, res) => {
    const { name, email, password, doc_id, phone } = req.body;
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new HttpError(422, 'Revisa los datos del formulario', { password: 'La contraseña debe combinar letras y números' });
    }
    const exists = await db.one('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (exists) throw new HttpError(409, 'Ya existe una cuenta con ese correo', { email: 'Correo ya registrado' });
    const hash = await bcrypt.hash(password, 10);
    const user = await db.one(
      `INSERT INTO users (name, email, password_hash, doc_id, phone) VALUES ($1, LOWER($2), $3, $4, $5) RETURNING *`,
      [name.trim(), email.trim(), hash, doc_id?.toUpperCase() || null, phone || null]
    );
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  });

r.post('/login', validate({ email: 'required|email', password: 'required' }, LABELS), async (req, res) => {
  const a = throttle(req.ip);
  const user = await db.one('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [req.body.email.trim()]);
  const ok = user && (await bcrypt.compare(req.body.password, user.password_hash));
  if (!ok) {
    a.count += 1;
    if (a.count >= 5) { a.until = Date.now() + 5 * 60_000; a.count = 0; }
    attempts.set(req.ip, a);
    throw new HttpError(401, 'Correo o contraseña incorrectos');
  }
  if (!user.active) throw new HttpError(403, 'Tu cuenta está desactivada. Contacta a la tienda.');
  attempts.delete(req.ip);
  res.json({ token: signToken(user), user: publicUser(user) });
});

r.get('/me', requireAuth, async (req, res) => {
  const u = await db.one('SELECT * FROM users WHERE id = $1', [req.user.id]);
  res.json(publicUser(u));
});

r.put('/me', requireAuth,
  validate({ name: 'required|minlen:3|maxlen:120', doc_id: 'docid', phone: 'phone' }, LABELS),
  async (req, res) => {
    const u = await db.one(
      'UPDATE users SET name = $1, doc_id = $2, phone = $3 WHERE id = $4 RETURNING *',
      [req.body.name.trim(), req.body.doc_id?.toUpperCase() || null, req.body.phone || null, req.user.id]
    );
    res.json(publicUser(u));
  });

r.put('/password', requireAuth, validate({ current: 'required', password: 'required|minlen:8' }, { current: 'Contraseña actual', password: 'Nueva contraseña' }),
  async (req, res) => {
    const u = await db.one('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await bcrypt.compare(req.body.current, u.password_hash))) {
      throw new HttpError(422, 'Revisa los datos del formulario', { current: 'La contraseña actual no coincide' });
    }
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(req.body.password, 10), req.user.id]);
    res.json({ ok: true });
  });

export default r;
