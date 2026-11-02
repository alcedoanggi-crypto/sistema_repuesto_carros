// Estructura de la tienda pública: header, navegación de categorías, footer y botón de WhatsApp
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp, canAccess } from '../context/AppContext.jsx';
import { api } from '../lib/api.js';
import { vehicleLabel } from '../lib/format.js';
import Icon from './Icon.jsx';
import VehicleSelector from './VehicleSelector.jsx';
import { Modal } from './ui.jsx';

export function Logo({ light = false }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="MACAI Autopartes, inicio">
      <span className="grid size-9 place-items-center rounded-lg bg-brand-600 font-display text-xl font-extrabold text-white">M</span>
      <span className="leading-none">
        <span className={`block font-display text-2xl font-extrabold tracking-wide ${light ? 'text-white' : ''}`}>MACAI</span>
        <span className="block text-[10px] font-semibold tracking-[0.2em] text-ink-400 uppercase">Autopartes</span>
      </span>
    </Link>
  );
}

/** Buscador con autocompletado por nombre, SKU u OEM */
function SearchBox({ className = '' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const [suggest, setSuggest] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setSuggest([]); return; }
    timer.current = setTimeout(() => api.get(`/products/suggest?q=${encodeURIComponent(q)}`).then(setSuggest).catch(() => {}), 220);
  }, [q]);

  const submit = (e) => {
    e.preventDefault();
    setOpen(false);
    navigate(`/catalogo?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <form onSubmit={submit} className={`relative ${className}`} role="search">
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Busca por nombre, número de parte (OEM) o código"
        className="input rounded-full! pl-9" aria-label="Buscar repuestos" />
      {open && suggest.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-900">
          {suggest.map((s) => (
            <li key={s.id}>
              <Link to={`/producto/${s.slug}`} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-800">
                <Icon name={s.category_icon} className="size-4 shrink-0 text-ink-400" />
                <span className="flex-1 truncate">{s.name}</span>
                <span className="text-xs text-ink-400">{s.oem_number || s.sku}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

function Header() {
  const { user, logout, cartCount, dark, toggleTheme, vehicle, setVehicle } = useApp();
  const [menu, setMenu] = useState(false);
  const [pickVehicle, setPickVehicle] = useState(false);
  const [categories, setCategories] = useState([]);
  const location = useLocation();

  useEffect(() => { api.get('/categories').then(setCategories).catch(() => {}); }, []);
  useEffect(() => { setMenu(false); }, [location.pathname, location.search]);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur dark:border-ink-800 dark:bg-ink-900/95">
      <div className="hidden bg-ink-900 text-xs text-ink-300 sm:block dark:bg-ink-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5">
          <span className="flex items-center gap-1.5"><Icon name="truck" className="size-3.5" /> Envíos a toda Venezuela · Retiro en tienda en Caracas</span>
          <span className="flex items-center gap-4">
            <Link to="/garantia" className="hover:text-white">Garantía y devoluciones</Link>
            <Link to="/contacto" className="hover:text-white">Contacto</Link>
          </span>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <button className="rounded-lg p-2 hover:bg-ink-100 lg:hidden dark:hover:bg-ink-800" onClick={() => setMenu((m) => !m)} aria-label="Menú">
          <Icon name={menu ? 'x' : 'menu'} />
        </button>
        <Logo />
        <SearchBox className="mx-4 hidden flex-1 md:block" />
        <div className="ml-auto flex items-center gap-1">
          <button onClick={toggleTheme} className="rounded-lg p-2 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}>
            <Icon name={dark ? 'sun' : 'moon'} />
          </button>
          {canAccess(user) && (
            <Link to="/admin" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 sm:block dark:text-brand-400 dark:hover:bg-ink-800">Panel</Link>
          )}
          {user ? (
            <div className="group relative">
              <Link to="/cuenta" className="flex items-center gap-1.5 rounded-lg p-2 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Mi cuenta">
                <Icon name="user" /> <span className="hidden max-w-28 truncate text-sm font-medium lg:inline">{user.name.split(' ')[0]}</span>
              </Link>
              <div className="invisible absolute right-0 mt-1 w-48 rounded-xl border border-ink-200 bg-white p-1 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 dark:border-ink-700 dark:bg-ink-900">
                {[['/cuenta', 'Mis pedidos'], ['/cuenta/garaje', 'Mi garaje'], ['/cuenta/deseos', 'Lista de deseos'], ['/cuenta/direcciones', 'Direcciones'], ['/cuenta/perfil', 'Mis datos']].map(([to, l]) => (
                  <Link key={to} to={to} className="block rounded-lg px-3 py-2 text-sm hover:bg-ink-100 dark:hover:bg-ink-800">{l}</Link>
                ))}
                <button onClick={logout} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">Cerrar sesión</button>
              </div>
            </div>
          ) : (
            <Link to="/ingresar" className="flex items-center gap-1.5 rounded-lg p-2 text-sm font-medium hover:bg-ink-100 dark:hover:bg-ink-800">
              <Icon name="user" /> <span className="hidden lg:inline">Ingresar</span>
            </Link>
          )}
          <Link to="/carrito" className="relative rounded-lg p-2 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label={`Carrito, ${cartCount} artículos`}>
            <Icon name="cart" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">{cartCount}</span>
            )}
          </Link>
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden"><SearchBox /></div>

      {/* Barra de vehículo + categorías */}
      <div className="border-t border-ink-100 dark:border-ink-800">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2">
          <button onClick={() => setPickVehicle(true)}
            className="flex shrink-0 items-center gap-2 rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800 dark:bg-white dark:text-ink-900">
            <Icon name="car" className="size-4" />
            <span className="max-w-[46vw] truncate sm:max-w-xs">{vehicle ? vehicleLabel(vehicle) : 'Selecciona tu vehículo'}</span>
          </button>
          {vehicle && (
            <>
              <Link to={`/catalogo?vehicle_id=${vehicle.id}`} className="shrink-0 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">Ver compatibles</Link>
              <button onClick={() => setVehicle(null)} className="shrink-0 rounded-full p-1 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Quitar vehículo"><Icon name="x" className="size-3.5" /></button>
            </>
          )}
          <nav className="ml-4 hidden gap-1 overflow-x-auto lg:flex" aria-label="Categorías">
            {categories.map((c) => (
              <NavLink key={c.id} to={`/categoria/${c.slug}`}
                className={({ isActive }) => `rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${isActive ? 'bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'}`}>
                {c.name}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Menú móvil */}
      {menu && (
        <nav className="border-t border-ink-200 bg-white px-4 py-3 lg:hidden dark:border-ink-800 dark:bg-ink-900" aria-label="Menú principal">
          <div className="grid grid-cols-2 gap-1">
            {categories.map((c) => (
              <Link key={c.id} to={`/categoria/${c.slug}`} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-ink-100 dark:hover:bg-ink-800">
                <Icon name={c.icon} className="size-4 text-brand-600" /> {c.name}
              </Link>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 border-t border-ink-100 pt-3 text-sm dark:border-ink-800">
            <Link to="/nosotros">Sobre nosotros</Link><Link to="/contacto">Contacto</Link><Link to="/garantia">Garantía</Link>
            {canAccess(user) && <Link to="/admin" className="font-semibold text-brand-700">Panel administrativo</Link>}
          </div>
        </nav>
      )}

      <Modal open={pickVehicle} onClose={() => setPickVehicle(false)} title="Mi vehículo" size="max-w-3xl">
        <VehicleSelector compact onDone={() => setPickVehicle(false)} />
      </Modal>
    </header>
  );
}

function Footer() {
  const { storeInfo } = useApp();
  const s = storeInfo?.store;
  return (
    <footer className="mt-16 bg-ink-900 text-ink-300 dark:bg-ink-950">
      <div className="hazard h-2" />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-3 text-sm">Repuestos originales y genéricos con garantía para dueños de vehículos, talleres y distribuidores.</p>
          {s && <p className="mt-2 text-xs text-ink-400">{s.legal_name} · RIF {s.rif}</p>}
        </div>
        <div>
          <h3 className="mb-3 text-lg font-bold text-white">Tienda</h3>
          <ul className="space-y-1.5 text-sm">
            <li><Link to="/catalogo" className="hover:text-white">Catálogo completo</Link></li>
            <li><Link to="/catalogo?sort=best_sellers" className="hover:text-white">Más vendidos</Link></li>
            <li><Link to="/cuenta" className="hover:text-white">Seguimiento de pedidos</Link></li>
            <li><Link to="/registro" className="hover:text-white">Cuenta para talleres y mayoristas</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-bold text-white">Información</h3>
          <ul className="space-y-1.5 text-sm">
            <li><Link to="/nosotros" className="hover:text-white">Sobre nosotros</Link></li>
            <li><Link to="/garantia" className="hover:text-white">Garantía y devoluciones</Link></li>
            <li><Link to="/contacto" className="hover:text-white">Contacto</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-bold text-white">Contacto</h3>
          {s && (
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2"><Icon name="pin" className="size-4 shrink-0" /> {s.address}</li>
              <li className="flex gap-2"><Icon name="phone" className="size-4 shrink-0" /> {s.phone}</li>
              <li className="flex gap-2"><Icon name="mail" className="size-4 shrink-0" /> {s.email}</li>
              <li className="flex gap-2"><Icon name="clock" className="size-4 shrink-0" /> {s.hours}</li>
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-ink-800 py-4 text-center text-xs text-ink-500">© {new Date().getFullYear()} MACAI Autopartes. Precios en bolívares, IVA no incluido.</div>
    </footer>
  );
}

/** Botón flotante de WhatsApp con mensaje según la página */
function WhatsAppButton() {
  const { storeInfo } = useApp();
  const location = useLocation();
  const number = storeInfo?.store?.whatsapp;
  if (!number) return null;
  const text = location.pathname.startsWith('/producto/')
    ? `Hola MACAI, quiero consultar por este repuesto: ${window.location.href}`
    : 'Hola MACAI, quiero consultar por un repuesto.';
  return (
    <a href={`https://wa.me/${number}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
      className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 font-semibold text-white shadow-lg transition hover:scale-105"
      aria-label="Escríbenos por WhatsApp">
      <Icon name="whatsapp" className="size-6" />
      <span className="hidden sm:inline">¿Dudas? Escríbenos</span>
    </a>
  );
}

export default function StoreLayout() {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1"><Outlet /></main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
