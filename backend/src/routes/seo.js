// SEO: sitemap.xml con todas las fichas de producto y categorías, y robots.txt
import { Router } from 'express';
import { db } from '../db/index.js';
import { config } from '../config.js';

const r = Router();

r.get('/sitemap.xml', async (_req, res) => {
  const base = config.publicUrl.replace(/\/$/, '');
  const [products, categories] = await Promise.all([
    db.many('SELECT slug, updated_at FROM products WHERE active ORDER BY id'),
    db.many('SELECT slug FROM categories ORDER BY sort_order'),
  ]);
  const urls = [
    { loc: `${base}/`, priority: '1.0' },
    { loc: `${base}/catalogo`, priority: '0.9' },
    ...categories.map((c) => ({ loc: `${base}/categoria/${c.slug}`, priority: '0.8' })),
    ...products.map((p) => ({ loc: `${base}/producto/${p.slug}`, lastmod: new Date(p.updated_at).toISOString().slice(0, 10), priority: '0.7' })),
    ...['nosotros', 'contacto', 'garantia'].map((s) => ({ loc: `${base}/${s}`, priority: '0.4' })),
  ];
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n') +
    '\n</urlset>'
  );
});

r.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /cuenta\nDisallow: /checkout\nSitemap: ${config.publicUrl.replace(/\/$/, '')}/sitemap.xml\n`);
});

export default r;
