export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro URL' });
  }

  try {
    // 1. Falsificación de cabeceras para engañar a CloudFront/JWPlayer
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://tv.volleyballworld.com/',
        'Origin': 'https://tv.volleyballworld.com'
      }
    });

    if (!response.ok) {
       return res.status(response.status).send(`Error del servidor origen: ${response.status}`);
    }

    // 2. PROCESAMIENTO BINARIO (Para video pesado y audio)
    // Extraemos el buffer directamente y lo pasamos al navegador
    if (url.includes('.ts') || url.includes('.m4s') || url.includes('.mp4') || url.includes('.aac') || url.includes('.vtt')) {
      const arrayBuffer = await response.arrayBuffer();
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', response.headers.get('content-type') || 'video/MP2T');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(Buffer.from(arrayBuffer));
    }

    // 3. PROCESAMIENTO DE TEXTO (Para listas .m3u8)
    const text = await response.text();
    const baseUrl = new URL(url);
    const basePath = baseUrl.origin + baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

    // Función constructora de URLs absolutas con proxy inyectado
    const wrapUrl = (targetUrl) => {
      let absUrl = targetUrl;
      if (!targetUrl.startsWith('http')) {
        absUrl = targetUrl.startsWith('/') ? baseUrl.origin + targetUrl : basePath + targetUrl;
      }
      return `/api/proxy?url=${encodeURIComponent(absUrl)}`;
    };

    // Leemos línea por línea
    let lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Si la línea es una URL suelta (fragmentos de video o sub-listas)
      if (line && !line.startsWith('#')) {
        lines[i] = wrapUrl(line);
      } 
      // LA CORRECCIÓN MAESTRA: Si la línea es una etiqueta que contiene una URI oculta
      else if (line.startsWith('#EXT-X-MEDIA:') || line.startsWith('#EXT-X-STREAM-INF:') || line.startsWith('#EXT-X-I-FRAME-STREAM-INF:')) {
        lines[i] = line.replace(/URI="([^"]+)"/g, (match, hiddenUrl) => {
          return `URI="${wrapUrl(hiddenUrl)}"`;
        });
      }
    }

    // 4. Entregamos el manifiesto completamente alterado a tu reproductor
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.status(200).send(lines.join('\n'));

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el motor del proxy' });
  }
}
