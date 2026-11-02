// Panel → Usuarios y permisos: empleados y administradores con módulos asignados
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../db/index.js';
import { check } from '../../middleware/validate.js';
import { HttpError, notFound } from '../../utils/errors.js';
import { ADMIN_MODULES } from '../../middleware/auth.js';

const r = Router();
const LABELS = { name: 'Nombre', email: 'Correo', password: 'Contraseña', role: 'Rol' };

r.get('/', async (_req, res) => {
  res.json({
    modules: ADMIN_MODULES,
    items: await db.many(
      `SELECT id, name, email, role, permissions, active, created_at FROM users WHERE role IN ('empleado','admin') ORDER BY role, name`
    ),
  });
});

const cleanPerms = (list) => (Array.isArray(list) ? list.filter((m) => ADMIN_MODULES.includes(m)) : []);

r.post('/', async (req, res) => {
  const b = req.body;
  check(b, { name: 'required|minlen:3', email: 'required|email', password: 'required|minlen:8', role: 'required|in:empleado,admin' }, LABELS);
  if (req.user.role !== 'admin' && b.role === 'admin') throw new HttpError(403, 'Solo un administrador puede crear administradores');
  const u = await db.one(
    `INSERT INTO users (name, email, password_hash, role, permissions) VALUES ($1, LOWER($2), $3, $4, $5)
     RETURNING id, name, email, role, permissions, active`,
    [b.name.trim(), b.email.trim(), await bcrypt.hash(b.password, 10), b.role, cleanPerms(b.permissions)]
  );
  res.status(201).json(u);
});

r.put('/:id', async (req, res) => {
  const b = req.body;
  const id = Number(req.params.id);
  check(b, { name: 'required|minlen:3', email: 'required|email', password: 'minlen:8', role: 'required|in:empleado,admin' }, LABELS);
  const target = await db.one(`SELECT role FROM users WHERE id = $1 AND role IN ('empleado','admin')`, [id]);
  if (!target) throw notFound('Usuario');
  if (req.user.role !== 'admin' && (target.role === 'admin' || b.role === 'admin')) {
    throw new HttpError(403, 'Solo un administrador puede modificar administradores');
  }
  if (id === req.user.id && (b.role !== 'admin' || b.active === false) && req.user.role === 'admin') {
    throw new HttpError(400, 'No puedes quitarte el rol de administrador ni desactivar tu propia cuenta');
  }
  const u = await db.one(
    `UPDATE users SET name = $1, email = LOWER($2), role = $3, permissions = $4, active = $5,
       password_hash = COALESCE($6, password_hash) WHERE id = $7 RETURNING id, name, email, role, permissions, active`,
    [b.name.trim(), b.email.trim(), b.role, cleanPerms(b.permissions), b.active ?? true,
     b.password ? await bcrypt.hash(b.password, 10) : null, id]
  );
  res.json(u);
});

export default r;
