export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro URL' });
  }

  try {
    // 1. Falsificamos la identidad para saltar el bloqueo de CloudFront
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://tv.volleyballworld.com/',
        'Origin': 'https://tv.volleyballworld.com'
      }
    });

    if (!response.ok) {
       return res.status(response.status).send(`Error de origen: ${response.status}`);
    }

    // 2. Si lo que nos piden es un fragmento de VIDEO PESADO (.ts, .m4s) o AUDIO
    // Lo procesamos como datos binarios (Buffer)
    if (url.includes('.ts') || url.includes('.m4s') || url.includes('.mp4') || url.includes('.aac')) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', response.headers.get('content-type') || 'video/MP2T');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Ayuda a que Vercel no sufra tanto
      return res.status(200).send(buffer);
    }

    // 3. Si lo que nos piden es el TEXTO (.m3u8)
    const text = await response.text();
    const baseUrl = new URL(url);
    const basePath = baseUrl.origin + baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

    // Reescribimos TODAS las rutas (texto y video) para que pasen obligatoriamente por este Proxy
    const rewrittenM3u8 = text.split('\n').map(line => {
      if (line && !line.startsWith('#')) {
        // Convertir relativas a absolutas
        let absoluteUrl = line;
        if (!line.startsWith('http')) {
           absoluteUrl = line.startsWith('/') ? baseUrl.origin + line : basePath + line;
        }
        // Envolvemos la ruta en nuestro proxy
        return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
      }
      return line;
    }).join('\n');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.status(200).send(rewrittenM3u8);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno en el proxy' });
  }
}
