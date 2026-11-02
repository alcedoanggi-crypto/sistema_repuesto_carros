// Monta los módulos del panel, cada uno protegido por su permiso
import { Router } from 'express';
import { requireStaff } from '../../middleware/auth.js';
import dashboard from './dashboard.js';
import products from './products.js';
import compat from './compat.js';
import inventory from './inventory.js';
import orders from './orders.js';
import customers from './customers.js';
import suppliers from './suppliers.js';
import promotions from './promotions.js';
import reports from './reports.js';
import users from './users.js';
import settings from './settings.js';

const r = Router();

r.use('/dashboard', requireStaff('dashboard'), dashboard);
r.use('/products', requireStaff('productos'), products);
r.use('/compat', requireStaff('compatibilidad'), compat);
r.use('/inventory', requireStaff('inventario'), inventory);
r.use('/orders', requireStaff('pedidos'), orders);
r.use('/customers', requireStaff('clientes'), customers);
r.use('/purchasing', requireStaff('proveedores'), suppliers);
r.use('/marketing', requireStaff('promociones'), promotions);
r.use('/reports', requireStaff('reportes'), reports);
r.use('/users', requireStaff('usuarios'), users);
r.use('/settings', requireStaff('configuracion'), settings);

export default r;
