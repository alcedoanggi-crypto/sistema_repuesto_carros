// Rutas de la aplicación: tienda pública, cuenta del cliente y panel administrativo
import { Route, Routes } from 'react-router-dom';
import StoreLayout from './components/StoreLayout.jsx';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import Product from './pages/Product.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import { Login, Register } from './pages/Auth.jsx';
import { About, Contact, Warranty, NotFound } from './pages/InfoPages.jsx';
import { AccountLayout, MyOrders, MyOrder, Garage, Wishlist, Addresses, Profile } from './pages/account/Account.jsx';
import AdminLayout, { RequireModule } from './admin/AdminLayout.jsx';
import Dashboard from './admin/Dashboard.jsx';
import { ProductList, ProductForm } from './admin/Products.jsx';
import { Compat, Inventory, Orders, OrderDetail, Customers, Purchasing, Promotions, Reports, Users, Settings } from './admin/Modules.jsx';

/** Página del panel protegida por su módulo */
const guard = (module, el) => <RequireModule module={module}>{el}</RequireModule>;

export default function App() {
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<Home />} />
        <Route path="catalogo" element={<Catalog />} />
        <Route path="categoria/:slug" element={<Catalog />} />
        <Route path="producto/:slug" element={<Product />} />
        <Route path="carrito" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="ingresar" element={<Login />} />
        <Route path="registro" element={<Register />} />
        <Route path="nosotros" element={<About />} />
        <Route path="contacto" element={<Contact />} />
        <Route path="garantia" element={<Warranty />} />
        <Route path="cuenta" element={<AccountLayout />}>
          <Route index element={<MyOrders />} />
          <Route path="pedidos/:code" element={<MyOrder />} />
          <Route path="garaje" element={<Garage />} />
          <Route path="deseos" element={<Wishlist />} />
          <Route path="direcciones" element={<Addresses />} />
          <Route path="perfil" element={<Profile />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="admin" element={<AdminLayout />}>
        <Route index element={guard('dashboard', <Dashboard />)} />
        <Route path="productos" element={guard('productos', <ProductList />)} />
        <Route path="productos/:id" element={guard('productos', <ProductForm />)} />
        <Route path="compatibilidad" element={guard('compatibilidad', <Compat />)} />
        <Route path="inventario" element={guard('inventario', <Inventory />)} />
        <Route path="pedidos" element={guard('pedidos', <Orders />)} />
        <Route path="pedidos/:id" element={guard('pedidos', <OrderDetail />)} />
        <Route path="clientes" element={guard('clientes', <Customers />)} />
        <Route path="compras" element={guard('proveedores', <Purchasing />)} />
        <Route path="promociones" element={guard('promociones', <Promotions />)} />
        <Route path="reportes" element={guard('reportes', <Reports />)} />
        <Route path="usuarios" element={guard('usuarios', <Users />)} />
        <Route path="configuracion" element={guard('configuracion', <Settings />)} />
      </Route>
    </Routes>
  );
}
