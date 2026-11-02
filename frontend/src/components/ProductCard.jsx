// Tarjeta de producto para listados
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { bs } from '../lib/format.js';
import PartImage from './PartImage.jsx';
import Icon from './Icon.jsx';
import { Badge, Stars } from './ui.jsx';

export function Price({ pricing, size = 'text-xl' }) {
  if (!pricing) return null;
  const discounted = pricing.price < pricing.list_price;
  return (
    <div>
      <div className={`font-display font-bold text-ink-900 dark:text-white ${size}`}>{bs(pricing.price)}</div>
      {discounted && <div className="text-xs text-ink-400 line-through">{bs(pricing.list_price)}</div>}
    </div>
  );
}

export function StockBadge({ stock }) {
  if (stock <= 0) return <Badge color="red">Agotado</Badge>;
  if (stock <= 3) return <Badge color="amber">Últimas {stock} unidades</Badge>;
  return <Badge color="green"><Icon name="check" className="size-3" /> Disponible</Badge>;
}

export default function ProductCard({ product }) {
  const { addToCart, toast, vehicle } = useApp();
  const p = product;
  const promo = p.pricing?.promo;
  const add = (e) => {
    e.preventDefault();
    addToCart(p);
    toast(`Agregado al carrito: ${p.name}`);
  };
  return (
    <Link to={`/producto/${p.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3]">
        <PartImage product={p} />
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {promo && <Badge color="brand" className="bg-brand-600! text-white!">-{Math.round(promo.percent)}%</Badge>}
          {p.is_original && <Badge color="gray" className="bg-ink-900! text-white!">Original</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="text-xs font-medium text-ink-400">{p.category_name} · SKU {p.sku}</span>
        <h3 className="line-clamp-2 font-sans text-sm leading-snug font-semibold group-hover:text-brand-700 dark:group-hover:text-brand-400">{p.name}</h3>
        {p.oem_number && <span className="text-xs text-ink-500">OEM {p.oem_number}</span>}
        {p.review_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-ink-500"><Stars value={p.rating} size="size-3.5" /> ({p.review_count})</span>
        )}
        {vehicle && p.fits_vehicle && <span className="text-xs font-semibold text-green-700 dark:text-green-400">✓ Compatible con tu {vehicle.model}</span>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <Price pricing={p.pricing} />
          <button onClick={add} disabled={p.stock <= 0} className="btn-primary btn-sm px-2.5" aria-label={`Agregar ${p.name} al carrito`}>
            <Icon name="cart" className="size-4" /> <span className="hidden sm:inline">Agregar</span>
          </button>
        </div>
        <StockBadge stock={p.stock} />
      </div>
    </Link>
  );
}
