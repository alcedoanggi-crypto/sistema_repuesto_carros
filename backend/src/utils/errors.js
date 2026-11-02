// Error HTTP con código de estado y mensaje legible para el usuario
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (what = 'Recurso') => new HttpError(404, `${what} no encontrado`);

// Manejador global: traduce errores conocidos de PostgreSQL a mensajes claros
export function errorHandler(err, req, res, _next) {
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Ya existe un registro con ese valor único (código, SKU, correo...).' });
  }
  if (err.code === '23503') {
    return res.status(409).json({ error: 'No se puede completar: el registro está relacionado con otros datos.' });
  }
  if (err.code === '23514') {
    return res.status(400).json({ error: 'Algún valor no cumple las reglas permitidas.' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El archivo supera el tamaño máximo permitido.' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Error interno del servidor' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}
