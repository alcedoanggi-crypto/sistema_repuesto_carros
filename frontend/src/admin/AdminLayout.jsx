// Estructura del panel: menú lateral filtrado por permisos y protección de rutas por rol
import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useApp, canAccess } from '../context/AppContext.jsx';
import Icon from '../components/Icon.jsx';
import Seo from '../components/Seo.jsx';
import { Empty, Loading } from '../components/ui.jsx';

export const ADMIN_NAV = [
  { to: '/admin', icon: 'dashboard', label: 'Dashboard', module: 'dashboard', end: true },
  { to: '/admin/pedidos', icon: 'receipt', label: 'Pedidos', module: 'pedidos' },
  { to: '/admin/productos', icon: 'package', label: 'Productos', module: 'productos' },
  { to: '/admin/inventario', icon: 'layers', label: 'Inventario', module: 'inventario' },
  { to: '/admin/compatibilidad', icon: 'car', label: 'Compatibilidad', module: 'compatibilidad' },
  { to: '/admin/clientes', icon: 'users', label: 'Clientes', module: 'clientes' },
  { to: '/admin/compras', icon: 'truck', label: 'Proveedores y compras', module: 'proveedores' },
  { to: '/admin/promociones', icon: 'tag', label: 'Promociones', module: 'promociones' },
  { to: '/admin/reportes', icon: 'chart', label: 'Reportes', module: 'reportes' },
  { to: '/admin/usuarios', icon: 'user', label: 'Usuarios y permisos', module: 'usuarios' },
  { to: '/admin/configuracion', icon: 'settings', label: 'Configuración', module: 'configuracion' },
];

/** Protege una página del panel por módulo */
export function RequireModule({ module, children }) {
  const { user } = useApp();
  if (!canAccess(user, module)) {
    return <Empty icon="shield" title="Sin acceso a este módulo">Pide a un administrador que te asigne el permiso “{module}”.</Empty>;
  }
  return children;
}

/** Encabezado estándar de cada página del panel */
export function PageHeader({ title, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-3xl font-extrabold uppercase sm:text-4xl">{title}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function AdminLayout() {
  const { user, authReady, logout, dark, toggleTheme } = useApp();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (!authReady) return <Loading />;
  if (!user) return <Navigate to={`/ingresar?next=${location.pathname}`} replace />;
  if (!canAccess(user)) return <Navigate to="/" replace />;

  const nav = ADMIN_NAV.filter((n) => canAccess(user, n.module));
  // Si no tiene dashboard, entra directo al primer módulo permitido
  if (location.pathname === '/admin' && !canAccess(user, 'dashboard') && nav[0]) return <Navigate to={nav[0].to} replace />;

  const sidebar = (
    <nav className="flex flex-col gap-0.5 p-3" aria-label="Panel">
      {nav.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-600 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white'}`}>
          <Icon name={n.icon} className="size-4.5" /> {n.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <Seo title="Panel administrativo" noindex />
      <aside className="hidden bg-ink-900 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto dark:bg-ink-950 dark:lg:border-r dark:lg:border-ink-800">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 font-display text-lg font-extrabold text-white">M</span>
          <div className="leading-tight"><b className="font-display text-xl text-white">MACAI</b><span className="block text-[10px] tracking-widest text-ink-400 uppercase">Panel de gestión</span></div>
        </div>
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-ink-900">{sidebar}</aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-ink-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-ink-800 dark:bg-ink-900/95">
          <button className="rounded-lg p-2 hover:bg-ink-100 lg:hidden dark:hover:bg-ink-800" onClick={() => setOpen(true)} aria-label="Menú"><Icon name="menu" /></button>
          <Link to="/" className="flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-brand-600"><Icon name="store" className="size-4" /> Ver tienda</Link>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggleTheme} className="rounded-lg p-2 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Cambiar tema"><Icon name={dark ? 'sun' : 'moon'} /></button>
            <span className="hidden text-right text-sm leading-tight sm:block">
              <b className="block">{user.name}</b><span className="text-xs text-ink-400 capitalize">{user.role}</span>
            </span>
            <button onClick={logout} className="rounded-lg p-2 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Cerrar sesión"><Icon name="logout" /></button>
          </div>
        </header>
        <main className="p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
