// SEO básico: React 19 lleva <title> y <meta> al <head> automáticamente.
// jsonLd agrega datos estructurados (schema.org) para que Google muestre precio y stock.
export default function Seo({ title, description, image, jsonLd, canonical, noindex }) {
  const full = title ? `${title} | MACAI Autopartes` : 'MACAI Autopartes — Repuestos para tu carro en Venezuela';
  return (
    <>
      <title>{full}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:title" content={full} />
      {description && <meta property="og:description" content={description} />}
      {image && <meta property="og:image" content={image} />}
      <meta property="og:site_name" content="MACAI Autopartes" />
      <meta property="og:locale" content="es_VE" />
      {canonical && <link rel="canonical" href={canonical} />}
      {noindex && <meta name="robots" content="noindex" />}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </>
  );
}
