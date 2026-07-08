export default async function handler(req, res) {
  const { url } = req.query;

  // 1. Verificación básica de seguridad
  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro URL' });
  }

  // 2. Blindaje: Solo permitimos que se use si la petición viene de tu dominio
  const referer = req.headers.referer || "";
  if (!referer.includes('voleylibre.com') && !referer.includes('motochupaca.vercel.app')) {
    return res.status(403).json({ error: 'Acceso denegado: dominio no autorizado' });
  }

  try {
    // 3. Falsificación de cabeceras para saltar el bloqueo de CloudFront
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://tv.volleyballworld.com/',
        'Origin': 'https://tv.volleyballworld.com'
      }
    });

    if (!response.ok) {
       return res.status(response.status).send(`Error del servidor origen: ${response.status}`);
    }

    // 4. PROCESAMIENTO BINARIO (Para video pesado .ts, .m4s, .aac, .vtt)
    // Esto pasa el video directo al navegador sin que Vercel se sature
    const contentType = response.headers.get('content-type') || '';
    if (url.includes('.ts') || url.includes('.m4s') || url.includes('.mp4') || 
        url.includes('.aac') || url.includes('.vtt') || contentType.includes('video/')) {
      
      const arrayBuffer = await response.arrayBuffer();
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(Buffer.from(arrayBuffer));
    }

    // 5. PROCESAMIENTO DE TEXTO (Para listas .m3u8)
    // Aquí reescribimos las rutas internas para que también pasen por este proxy
    const text = await response.text();
    const baseUrl = new URL(url);
    const basePath = baseUrl.origin + baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

    const rewrittenM3u8 = text.split('\n').map(line => {
      // Si la línea es una URL (sin el # al inicio)
      if (line && !line.startsWith('#')) {
        let absoluteUrl = line.startsWith('http') ? line : (line.startsWith('/') ? baseUrl.origin + line : basePath + line);
        return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
      } 
      // Si es una etiqueta con una ruta oculta (ej: audios o sub-listas)
      else if (line.startsWith('#EXT-X-MEDIA:') || line.startsWith('#EXT-X-STREAM-INF:')) {
        return line.replace(/URI="([^"]+)"/g, (match, hiddenUrl) => {
          let absUrl = hiddenUrl.startsWith('http') ? hiddenUrl : (hiddenUrl.startsWith('/') ? baseUrl.origin + hiddenUrl : basePath + hiddenUrl);
          return `URI="/api/proxy?url=${encodeURIComponent(absUrl)}"`;
        });
      }
      return line;
    }).join('\n');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.status(200).send(rewrittenM3u8);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno en el proxy' });
  }
}
