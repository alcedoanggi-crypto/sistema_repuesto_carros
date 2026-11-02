// Configuración central leída de variables de entorno (.env)
import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4600,
  jwtSecret: process.env.JWT_SECRET || 'macai-dev-secret-cambiar',
  jwtExpires: '7d',
  databaseUrl: process.env.DATABASE_URL || '',
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:5180',
};

if (!process.env.JWT_SECRET) {
  console.warn('[config] JWT_SECRET no definido: usando clave de desarrollo. No usar así en producción.');
}
