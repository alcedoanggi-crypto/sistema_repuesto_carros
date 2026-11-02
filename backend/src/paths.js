// Rutas de carpetas usadas por el servidor
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const UPLOAD_DIR = path.join(root, 'uploads');
export const FRONTEND_DIST = path.resolve(root, '../frontend/dist');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
