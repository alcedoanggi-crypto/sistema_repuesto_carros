// Páginas informativas: Sobre nosotros, Contacto, Garantía y devoluciones, 404
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Icon from '../components/Icon.jsx';
import Seo from '../components/Seo.jsx';
import { Empty, Field, Input, Textarea } from '../components/ui.jsx';

const Page = ({ title, children }) => (
  <div className="mx-auto max-w-4xl px-4 py-10">
    <h1 className="mb-6 text-5xl font-extrabold uppercase">{title}</h1>
    <div className="space-y-4 leading-relaxed text-ink-700 dark:text-ink-300 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink-900 dark:[&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc">
      {children}
    </div>
  </div>
);

export function About() {
  return (
    <Page title="Sobre nosotros">
      <Seo title="Sobre nosotros" description="MACAI Autopartes: repuestos originales y genéricos con garantía para dueños de vehículos, talleres y distribuidores en Venezuela." />
      <p className="text-lg">En <b>MACAI Autopartes</b> creemos que encontrar el repuesto correcto no debería ser una adivinanza. Por eso construimos un catálogo donde cada pieza está asociada a los vehículos en los que funciona: marca, modelo, año y motor.</p>
      <div className="grid gap-3 py-4 sm:grid-cols-3">
        {[['+2.500', 'clientes atendidos'], ['+120', 'talleres aliados'], ['24 h', 'delivery en Gran Caracas']].map(([n, l]) => (
          <div key={l} className="card p-5 text-center"><div className="font-display text-4xl font-extrabold text-brand-600">{n}</div><div className="text-sm">{l}</div></div>
        ))}
      </div>
      <h2>Qué hacemos</h2>
      <p>Distribuimos repuestos para las marcas más comunes en Venezuela: Toyota, Chevrolet, Ford, Hyundai, Mitsubishi y Kia. Trabajamos con piezas originales (OEM) y con alternativas genéricas de fabricantes reconocidos, para que elijas según tu presupuesto.</p>
      <h2>Para quién</h2>
      <ul>
        <li><b>Dueños de vehículos</b> que quieren la pieza exacta y con garantía.</li>
        <li><b>Talleres mecánicos</b> con precios preferenciales y despacho rápido.</li>
        <li><b>Distribuidores y mayoristas</b> con tarifas por volumen.</li>
      </ul>
      <p className="text-sm text-ink-500">Las cifras de esta página son ilustrativas de la tienda de demostración.</p>
    </Page>
  );
}

export function Contact() {
  const { storeInfo } = useApp();
  const s = storeInfo?.store;
  const [form, setForm] = useState({ name: '', message: '' });
  const [errors, setErrors] = useState({});
  // El formulario abre WhatsApp con el mensaje armado (no requiere servidor de correo)
  const send = (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 3) errs.name = 'Escribe tu nombre';
    if (form.message.trim().length < 10) errs.message = 'Cuéntanos un poco más (mínimo 10 caracteres)';
    setErrors(errs);
    if (Object.keys(errs).length || !s) return;
    window.open(`https://wa.me/${s.whatsapp}?text=${encodeURIComponent(`Hola, soy ${form.name}. ${form.message}`)}`, '_blank', 'noopener');
  };
  return (
    <Page title="Contacto">
      <Seo title="Contacto" description="Escríbenos por WhatsApp, llámanos o visítanos en nuestra tienda en Caracas." />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          {s && [['pin', s.address], ['phone', s.phone], ['whatsapp', `+${s.whatsapp}`], ['mail', s.email], ['clock', s.hours]].map(([icon, v]) => (
            <p key={icon} className="flex gap-3"><Icon name={icon} className="size-5 shrink-0 text-brand-600" /> {v}</p>
          ))}
        </div>
        <form onSubmit={send} className="card space-y-3 p-5" noValidate>
          <h2 className="mt-0!">Escríbenos</h2>
          <Field label="Nombre" error={errors.name}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="¿Qué repuesto buscas?" error={errors.message} hint="Incluye marca, modelo, año y motor de tu vehículo">
            <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </Field>
          <button className="btn-primary w-full"><Icon name="whatsapp" className="size-4" /> Enviar por WhatsApp</button>
        </form>
      </div>
    </Page>
  );
}

export function Warranty() {
  return (
    <Page title="Garantía y devoluciones">
      <Seo title="Garantía y devoluciones" description="Conoce la política de garantía y devoluciones de MACAI Autopartes." />
      <p>Todos nuestros repuestos tienen garantía contra defectos de fabricación. El plazo se indica en la ficha de cada producto y en tu comprobante.</p>
      <h2>Plazos de garantía</h2>
      <ul>
        <li>Frenos, filtros y accesorios: de 3 a 6 meses.</li>
        <li>Suspensión, motor y transmisión: 12 meses.</li>
        <li>Baterías: 18 meses.</li>
        <li>Aceites, lubricantes y líquidos: no aplica garantía una vez abiertos.</li>
      </ul>
      <h2>Cómo hacer un reclamo</h2>
      <ul>
        <li>Presenta tu comprobante de pedido (lo descargas desde <Link to="/cuenta" className="underline">Mi cuenta</Link>).</li>
        <li>La pieza debe haber sido instalada por un taller o un mecánico, siguiendo las especificaciones del fabricante.</li>
        <li>Evaluamos la pieza en un máximo de 5 días hábiles. Si procede, la cambiamos por una igual o te devolvemos el dinero.</li>
      </ul>
      <h2>Devoluciones</h2>
      <ul>
        <li>Tienes <b>7 días</b> desde que recibes tu pedido para devolver un repuesto <b>sin instalar</b>, en su empaque original.</li>
        <li>Si el repuesto no es compatible con el vehículo que seleccionaste en nuestro buscador, cubrimos el costo del envío de la devolución.</li>
        <li>No se aceptan devoluciones de piezas eléctricas instaladas ni de productos con el empaque dañado.</li>
      </ul>
      <h2>No cubre la garantía</h2>
      <ul>
        <li>Daños por mala instalación, accidentes, uso indebido o modificaciones.</li>
        <li>Desgaste normal de piezas de consumo (pastillas, bandas, plumillas).</li>
      </ul>
    </Page>
  );
}

export function NotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Seo title="Página no encontrada" noindex />
      <Empty icon="search" title="Esta página no existe" action={<Link to="/" className="btn-primary">Volver al inicio</Link>}>
        Puede que el enlace esté mal escrito o que el producto ya no esté disponible.
      </Empty>
    </div>
  );
}
