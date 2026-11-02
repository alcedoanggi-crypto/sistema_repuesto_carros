// Estado global de la app: sesión, carrito, tema, vehículo seleccionado, datos de la tienda y avisos (toasts).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken, getToken } from '../lib/api.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

/** localStorage tolerante a fallos (modo privado, almacenamiento bloqueado) */
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignorar */ }
  },
};

export function AppProvider({ children }) {
  // ---------- Sesión ----------
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api.get('/auth/me').then(setUser).catch(() => setToken(null)).finally(() => setAuthReady(true));
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user } = await api.post('/auth/login', { email, password });
    setToken(token);
    setUser(user);
    return user;
  }, []);
  const register = useCallback(async (data) => {
    const { token, user } = await api.post('/auth/register', data);
    setToken(token);
    setUser(user);
    return user;
  }, []);
  const logout = useCallback(() => { setToken(null); setUser(null); }, []);

  // ---------- Carrito (se guarda en el navegador; los precios se recalculan en el servidor) ----------
  const [cart, setCart] = useState(() => store.get('macai-cart', []));
  useEffect(() => store.set('macai-cart', cart), [cart]);

  const addToCart = useCallback((product, quantity = 1) => {
    setCart((c) => {
      const found = c.find((i) => i.product_id === product.id);
      const max = product.stock ?? 999;
      if (found) return c.map((i) => (i.product_id === product.id ? { ...i, quantity: Math.min(i.quantity + quantity, max) } : i));
      return [...c, { product_id: product.id, quantity: Math.min(quantity, max), name: product.name, slug: product.slug }];
    });
  }, []);
  const setQty = useCallback((id, quantity) =>
    setCart((c) => (quantity <= 0 ? c.filter((i) => i.product_id !== id) : c.map((i) => (i.product_id === id ? { ...i, quantity } : i)))), []);
  const clearCart = useCallback(() => setCart([]), []);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  // ---------- Vehículo seleccionado ("Mi vehículo") ----------
  const [vehicle, setVehicleState] = useState(() => store.get('macai-vehicle', null));
  const setVehicle = useCallback((v) => { setVehicleState(v); store.set('macai-vehicle', v); }, []);

  // ---------- Tema claro/oscuro ----------
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggleTheme = useCallback(() => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle('dark', next);
      try { localStorage.setItem('macai-theme', next ? 'dark' : 'light'); } catch { /* ignorar */ }
      return next;
    });
  }, []);

  // ---------- Información pública de la tienda ----------
  const [storeInfo, setStoreInfo] = useState(null);
  useEffect(() => { api.get('/store').then(setStoreInfo).catch(() => {}); }, []);

  // ---------- Avisos ----------
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, type = 'success') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const value = useMemo(() => ({
    user, setUser, authReady, login, register, logout,
    cart, addToCart, setQty, clearCart, cartCount,
    vehicle, setVehicle, dark, toggleTheme, storeInfo, toast,
  }), [user, authReady, login, register, logout, cart, addToCart, setQty, clearCart, cartCount, vehicle, setVehicle, dark, toggleTheme, storeInfo, toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto max-w-md rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
              t.type === 'error' ? 'bg-red-600 text-white' : 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

/** ¿El usuario puede ver este módulo del panel? */
export const canAccess = (user, module) =>
  user?.role === 'admin' || (user?.role === 'empleado' && (!module || user.permissions?.includes(module)));
