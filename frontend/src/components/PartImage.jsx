// Imagen del producto. Si no tiene fotos subidas, muestra una ilustración técnica
// según la categoría (para que el catálogo de demo se vea completo sin fotos reales).
import Icon from './Icon.jsx';

export default function PartImage({ product, index = 0, className = '' }) {
  const src = product?.images?.[index];
  if (src) {
    return <img src={src} alt={product.name} loading="lazy" className={`h-full w-full object-contain ${className}`} />;
  }
  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-ink-100 to-ink-200 dark:from-ink-850 dark:to-ink-800 ${className}`}
      role="img" aria-label={product?.name}>
      {/* cuadrícula de plano técnico */}
      <svg className="absolute inset-0 h-full w-full text-ink-300/60 dark:text-ink-700/60" aria-hidden="true">
        <defs>
          <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0H0V16" fill="none" stroke="currentColor" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <Icon name={product?.category_icon || 'box'} className="relative size-1/3 text-ink-500 dark:text-ink-400" strokeWidth={1.2} />
      {product?.brand_name && (
        <span className="absolute bottom-2 left-2 rounded bg-white/80 px-1.5 py-0.5 font-display text-[11px] font-bold tracking-wider text-ink-600 uppercase dark:bg-ink-900/80 dark:text-ink-300">
          {product.brand_name}
        </span>
      )}
    </div>
  );
}
