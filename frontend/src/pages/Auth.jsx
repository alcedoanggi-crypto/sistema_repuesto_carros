// Inicio de sesión y registro de clientes
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Seo from '../components/Seo.jsx';
import { Field, FormError, Input } from '../components/ui.jsx';

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
      <div className="hidden flex-col justify-center rounded-2xl bg-ink-900 p-8 text-white md:flex dark:bg-ink-850">
        <div className="hazard mb-6 h-2 w-24 rounded" />
        <h2 className="text-4xl leading-none font-extrabold uppercase">Tu garaje, tus pedidos y tus precios en un solo lugar.</h2>
        <ul className="mt-6 space-y-2 text-sm text-ink-300">
          <li>✓ Guarda tus vehículos y encuentra repuestos compatibles al instante</li>
          <li>✓ Sigue tus pedidos y descarga tus comprobantes</li>
          <li>✓ Precios especiales para talleres y mayoristas</li>
        </ul>
      </div>
      <div className="card p-6 sm:p-8">
        <h1 className="text-4xl font-extrabold uppercase">{title}</h1>
        <p className="mb-6 text-sm text-ink-500">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

/** Destino seguro tras iniciar sesión (solo rutas internas) */
const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null);

export function Login() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setErrors({});
    if (!form.email || !form.password) return setError('Escribe tu correo y contraseña');
    setSending(true);
    try {
      const u = await login(form.email, form.password);
      navigate(safeNext(params.get('next')) || (u.role === 'cliente' ? '/cuenta' : '/admin'), { replace: true });
    } catch (err) { setError(err.message); setErrors(err.details); } finally { setSending(false); }
  };

  return (
    <AuthShell title="Ingresar" subtitle="Accede a tu cuenta de cliente o al panel de la tienda.">
      <Seo title="Ingresar" noindex />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError error={error} />
        <Field label="Correo" error={errors.email}><Input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Contraseña" error={errors.password}><Input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <button className="btn-primary w-full py-3" disabled={sending}>{sending ? 'Ingresando...' : 'Ingresar'}</button>
        <p className="text-center text-sm">¿No tienes cuenta? <Link to={`/registro${params.get('next') ? `?next=${params.get('next')}` : ''}`} className="font-semibold text-brand-700 underline dark:text-brand-400">Regístrate</Link></p>
      </form>
      <details className="mt-6 rounded-lg bg-ink-100 p-3 text-xs dark:bg-ink-850">
        <summary className="cursor-pointer font-semibold">Usuarios de prueba (demo)</summary>
        <ul className="mt-2 space-y-1 font-mono">
          <li>admin@macai.com / Admin1234</li>
          <li>ventas@macai.com / Ventas1234</li>
          <li>cliente@macai.com / Cliente1234</li>
          <li>taller@macai.com / Cliente1234</li>
        </ul>
      </details>
    </AuthShell>
  );
}

export function Register() {
  const { register } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', doc_id: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const errs = {};
    if (form.name.trim().length < 3) errs.name = 'Escribe tu nombre completo';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) errs.email = 'Correo electrónico inválido';
    if (form.password.length < 8) errs.password = 'Mínimo 8 caracteres';
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) errs.password = 'Combina letras y números';
    if (form.password !== form.confirm) errs.confirm = 'Las contraseñas no coinciden';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSending(true);
    try {
      const { confirm, ...data } = form; // eslint-disable-line no-unused-vars
      await register(data);
      navigate(safeNext(params.get('next')) || '/cuenta', { replace: true });
    } catch (err) { setError(err.message); setErrors(err.details); } finally { setSending(false); }
  };

  const f = (k) => ({ value: form[k], error: errors[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  return (
    <AuthShell title="Crear cuenta" subtitle="Regístrate en menos de un minuto.">
      <Seo title="Crear cuenta" noindex />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError error={error} />
        <Field label="Nombre completo o razón social" error={errors.name}><Input autoComplete="name" {...f('name')} /></Field>
        <Field label="Correo" error={errors.email}><Input type="email" autoComplete="email" {...f('email')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cédula / RIF (opcional)" error={errors.doc_id}><Input placeholder="V-12345678" {...f('doc_id')} /></Field>
          <Field label="Teléfono (opcional)" error={errors.phone}><Input type="tel" placeholder="0414-1234567" {...f('phone')} /></Field>
        </div>
        <Field label="Contraseña" error={errors.password} hint="Mínimo 8 caracteres, con letras y números"><Input type="password" autoComplete="new-password" {...f('password')} /></Field>
        <Field label="Repite la contraseña" error={errors.confirm}><Input type="password" autoComplete="new-password" {...f('confirm')} /></Field>
        <button className="btn-primary w-full py-3" disabled={sending}>{sending ? 'Creando cuenta...' : 'Crear cuenta'}</button>
        <p className="text-center text-xs text-ink-500">¿Eres taller o mayorista? Regístrate y escríbenos por WhatsApp para activar tus precios especiales.</p>
        <p className="text-center text-sm">¿Ya tienes cuenta? <Link to="/ingresar" className="font-semibold text-brand-700 underline dark:text-brand-400">Ingresa</Link></p>
      </form>
    </AuthShell>
  );
}
