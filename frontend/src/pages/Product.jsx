// Ficha de producto: fotos, precio, compatibilidad, stock, garantía, reseñas y relacionados (con SEO)
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { date, vehicleLabel } from '../lib/format.js';
import ProductCard, { Price, StockBadge } from '../components/ProductCard.jsx';
import PartImage from '../components/PartImage.jsx';
import Icon from '../components/Icon.jsx';
import Seo from '../components/Seo.jsx';
import { Badge, Empty, FormError, Loading, Stars } from '../components/ui.jsx';

/** Agrupa años consecutivos: Corolla 2009, 2010, 2011 → "2009–2011" */
function groupCompat(list) {
  const groups = {};
  for (const c of list) {
    const k = `${c.make}|${c.model}|${c.engine}`;
    (groups[k] ||= { make: c.make, model: c.model, engine: c.engine, years: [], note: c.note }).years.push(c.year);
  }
  return Object.values(groups).map((g) => {
    const ys = [...new Set(g.years)].sort((a, b) => a - b);
    const ranges = [];
    let start = ys[0], prev = ys[0];
    for (const y of ys.slice(1).concat(null)) {
      if (y !== prev + 1) { ranges.push(start === prev ? `${start}` : `${start}–${prev}`); start = y; }
      prev = y;
    }
    return { ...g, years: ranges.join(', ') };
  });
}

function Reviews({ product, onAdded }) {
  const { user, toast } = useApp();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await api.post(`/products/${product.id}/reviews`, { rating, comment });
      toast('¡Gracias por tu reseña!');
      setComment('');
      onAdded();
    } catch (err) { setError(err.message); } finally { setSending(false); }
  };

  return (
    <section id="resenas" className="mt-12">
      <h2 className="mb-1 text-3xl font-extrabold uppercase">Reseñas</h2>
      <p className="mb-4 flex items-center gap-2 text-sm text-ink-500"><Stars value={product.rating} /> {product.rating || 0} de 5 · {product.review_count} reseñas</p>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {product.reviews.length === 0 && <p className="text-sm text-ink-500">Este producto aún no tiene reseñas. ¡Sé el primero!</p>}
          {product.reviews.map((r) => (
            <article key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={r.rating} /> <b className="text-sm">{r.user_name}</b>
                {r.verified && <Badge color="green">Compra verificada</Badge>}
                <span className="ml-auto text-xs text-ink-400">{date(r.created_at)}</span>
              </div>
              {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
            </article>
          ))}
        </div>
        <div className="card h-fit p-4">
          {user ? (
            <form onSubmit={submit} className="space-y-3">
              <h3 className="text-xl font-bold">Escribe tu reseña</h3>
              <div className="flex gap-1" role="radiogroup" aria-label="Calificación">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button type="button" key={i} onClick={() => setRating(i)} role="radio" aria-checked={rating === i} aria-label={`${i} estrellas`} className="text-amber-500">
                    <Icon name="star" className="size-7" fill={i <= rating ? 'currentColor' : 'none'} strokeWidth={1.5} />
                  </button>
                ))}
              </div>
              <textarea className="input min-h-24" maxLength={1000} placeholder="¿Cómo te fue con este repuesto? ¿Para qué vehículo lo usaste?" value={comment} onChange={(e) => setComment(e.target.value)} />
              <FormError error={error} />
              <button className="btn-primary w-full" disabled={sending}>Publicar reseña</button>
            </form>
          ) : (
            <p className="text-sm">Para dejar una reseña, <Link to="/ingresar" className="font-semibold text-brand-700 underline">inicia sesión</Link>.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Product() {
  const { slug } = useParams();
  const { addToCart, toast, vehicle, user } = useApp();
  const [p, setP] = useState(undefined);
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [wish, setWish] = useState(false);

  const load = () => api.get(`/products/${slug}${vehicle ? `?vehicle_id=${vehicle.id}` : ''}`).then(setP).catch(() => setP(null));
  useEffect(() => { setP(undefined); setImg(0); setQty(1); load(); }, [slug, vehicle?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user && p) api.get('/account/wishlist').then((l) => setWish(l.some((x) => x.id === p.id))).catch(() => {});
  }, [user, p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const compat = useMemo(() => (p ? groupCompat(p.compatibility) : []), [p]);

  if (p === undefined) return <Loading />;
  if (p === null) return <Empty icon="search" title="Producto no encontrado" action={<Link to="/catalogo" className="btn-primary">Ir al catálogo</Link>} />;

  const add = () => { addToCart(p, qty); toast(`Agregado al carrito: ${qty} × ${p.name}`); };
  const toggleWish = async () => {
    if (!user) return toast('Inicia sesión para usar tu lista de deseos', 'error');
    if (wish) await api.del(`/account/wishlist/${p.id}`); else await api.post(`/account/wishlist/${p.id}`);
    setWish(!wish);
    toast(wish ? 'Quitado de tu lista de deseos' : 'Guardado en tu lista de deseos');
  };

  const url = typeof window !== 'undefined' ? window.location.origin + `/producto/${p.slug}` : '';
  const description = `${p.name}${p.oem_number ? ` (OEM ${p.oem_number})` : ''}. ${p.description || ''}`.slice(0, 158);
  // Datos estructurados schema.org/Product para Google
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.sku, mpn: p.oem_number || p.manufacturer_code,
    description: p.description, brand: { '@type': 'Brand', name: p.brand_name }, category: p.category_name,
    ...(p.images?.length ? { image: p.images.map((i) => window.location.origin + i) } : {}),
    offers: { '@type': 'Offer', url, priceCurrency: 'VES', price: p.pricing.price, itemCondition: 'https://schema.org/NewCondition',
      availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
    ...(p.review_count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.review_count } } : {}),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Seo title={p.name} description={description} canonical={url} jsonLd={jsonLd} image={p.images?.[0] && window.location.origin + p.images[0]} />
      <nav className="mb-4 text-xs text-ink-400" aria-label="Ruta">
        <Link to="/" className="hover:underline">Inicio</Link> / <Link to={`/categoria/${p.category_slug}`} className="hover:underline">{p.category_name}</Link> / <span>{p.sku}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Galería */}
        <div>
          <div className="card aspect-square overflow-hidden"><PartImage product={p} index={img} /></div>
          {p.images?.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {p.images.map((src, i) => (
                <button key={src} onClick={() => setImg(i)} className={`size-20 shrink-0 overflow-hidden rounded-lg border-2 ${i === img ? 'border-brand-600' : 'border-transparent'}`} aria-label={`Foto ${i + 1}`}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Información */}
        <div>
          <div className="flex flex-wrap gap-2">
            {p.is_original ? <Badge color="gray" className="bg-ink-900! text-white!">Original (OEM)</Badge> : <Badge>Genérico / alternativo</Badge>}
            {p.pricing.promo && <Badge color="brand" className="bg-brand-600! text-white!">{p.pricing.promo.name} · -{Math.round(p.pricing.promo.percent)}%</Badge>}
            {p.pricing.customer_price && <Badge color="blue">Precio {user?.customer_type}</Badge>}
          </div>
          <h1 className="mt-2 text-4xl leading-tight font-extrabold">{p.name}</h1>
          <a href="#resenas" className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-500"><Stars value={p.rating} /> {p.review_count} reseñas</a>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-ink-100 p-4 text-sm sm:grid-cols-3 dark:bg-ink-850">
            <div><dt className="text-xs text-ink-500">Marca</dt><dd className="font-semibold">{p.brand_name || '—'}</dd></div>
            <div><dt className="text-xs text-ink-500">SKU</dt><dd className="font-semibold">{p.sku}</dd></div>
            <div><dt className="text-xs text-ink-500">N.º de parte OEM</dt><dd className="font-semibold">{p.oem_number || '—'}</dd></div>
            <div><dt className="text-xs text-ink-500">Código fabricante</dt><dd className="font-semibold">{p.manufacturer_code || '—'}</dd></div>
            <div><dt className="text-xs text-ink-500">Garantía</dt><dd className="font-semibold">{p.warranty_months ? `${p.warranty_months} meses` : 'Por defecto de fábrica'}</dd></div>
            <div><dt className="text-xs text-ink-500">Categoría</dt><dd className="font-semibold">{p.category_name}</dd></div>
          </dl>

          {/* ¿Le sirve a mi vehículo? */}
          {vehicle && p.compatibility.length > 0 && (
            <div className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${p.fits ? 'bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'}`}>
              <Icon name={p.fits ? 'check' : 'alert'} className="size-5" />
              {p.fits ? `Compatible con tu ${vehicleLabel(vehicle)}` : `No figura como compatible con tu ${vehicleLabel(vehicle)}. Consúltanos antes de comprar.`}
            </div>
          )}
          {p.compatibility.length === 0 && (
            <p className="mt-4 rounded-xl bg-ink-100 px-4 py-3 text-sm dark:bg-ink-850">Producto de uso universal: verifica la especificación (viscosidad, medida o tipo) en el manual de tu vehículo.</p>
          )}

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <Price pricing={p.pricing} size="text-4xl" />
              <p className="text-xs text-ink-400">Precio sin IVA · {p.pricing.promo ? `Oferta válida hasta el ${date(p.pricing.promo.ends_at)}` : 'Precio unitario'}</p>
            </div>
            <StockBadge stock={p.stock} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="flex items-center rounded-lg border border-ink-200 dark:border-ink-700">
              <button className="p-2.5" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Restar"><Icon name="minus" className="size-4" /></button>
              <input className="w-12 bg-transparent text-center font-semibold" value={qty} inputMode="numeric" aria-label="Cantidad"
                onChange={(e) => setQty(Math.min(Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1), p.stock || 1))} />
              <button className="p-2.5" onClick={() => setQty((q) => Math.min(q + 1, p.stock))} aria-label="Sumar"><Icon name="plus" className="size-4" /></button>
            </div>
            <button className="btn-primary flex-1" disabled={p.stock <= 0} onClick={add}><Icon name="cart" className="size-4" /> {p.stock > 0 ? 'Agregar al carrito' : 'Agotado'}</button>
            <button className={`btn-ghost ${wish ? 'text-red-600!' : ''}`} onClick={toggleWish} aria-label="Lista de deseos" aria-pressed={wish}>
              <Icon name="heart" className="size-4" fill={wish ? 'currentColor' : 'none'} />
            </button>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm text-ink-600 dark:text-ink-300">
            <li className="flex gap-2"><Icon name="truck" className="size-4 text-brand-600" /> Envío a toda Venezuela o retiro en tienda</li>
            <li className="flex gap-2"><Icon name="shield" className="size-4 text-brand-600" /> <Link to="/garantia" className="underline">Garantía y devoluciones</Link></li>
          </ul>

          {p.description && (
            <div className="mt-6">
              <h2 className="mb-1 text-2xl font-bold">Descripción</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line">{p.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de compatibilidad */}
      {compat.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 text-3xl font-extrabold uppercase">Vehículos compatibles</h2>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Marca</th><th>Modelo</th><th>Años</th><th>Motor</th><th>Nota</th></tr></thead>
              <tbody>
                {compat.map((c) => (
                  <tr key={`${c.make}${c.model}${c.engine}`}>
                    <td className="font-semibold">{c.make}</td><td>{c.model}</td><td>{c.years}</td><td>{c.engine}</td><td className="text-ink-500">{c.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Reviews product={p} onAdded={load} />

      {p.related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-3xl font-extrabold uppercase">Productos relacionados</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {p.related.slice(0, 4).map((r) => <ProductCard key={r.id} product={r} />)}
          </div>
        </section>
      )}
    </div>
  );
}
