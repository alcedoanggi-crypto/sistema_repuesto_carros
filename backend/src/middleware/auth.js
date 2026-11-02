// Autenticación JWT y autorización por rol y por módulo del panel
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { HttpError } from '../utils/errors.js';

/** Módulos del panel administrativo que se pueden asignar a empleados */
export const ADMIN_MODULES = [
  'dashboard', 'productos', 'compatibilidad', 'inventario', 'pedidos', 'clientes',
  'proveedores', 'promociones', 'reportes', 'usuarios', 'configuracion',
];

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpires });

/** Carga el usuario si viene un token válido (no obliga a iniciar sesión) */
async function loadUser(req) {
  if (req.user !== undefined) return req.user;
  req.user = null;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await db.one(
      'SELECT id, name, email, role, customer_type, permissions, active FROM users WHERE id = $1',
      [payload.sub]
    );
    if (user?.active) req.user = user;
  } catch {
    /* token inválido o vencido: se trata como visitante */
  }
  return req.user;
}

export async function optionalAuth(req, _res, next) {
  await loadUser(req);
  next();
}

/** Exige sesión iniciada */
export async function requireAuth(req, _res, next) {
  if (!(await loadUser(req))) return next(new HttpError(401, 'Debes iniciar sesión'));
  next();
}

/** ¿El usuario puede ver este módulo del panel? */
export const canAccess = (user, module) =>
  user?.role === 'admin' || (user?.role === 'empleado' && (!module || user.permissions.includes(module)));

/** Exige rol de personal (empleado o admin) y, si se indica, permiso sobre un módulo */
export const requireStaff = (module) => async (req, _res, next) => {
  const u = await loadUser(req);
  if (!u) return next(new HttpError(401, 'Debes iniciar sesión'));
  if (u.role === 'cliente') return next(new HttpError(403, 'Acceso restringido al personal de la tienda'));
  if (!canAccess(u, module)) return next(new HttpError(403, `No tienes permiso para el módulo "${module}"`));
  next();
};
