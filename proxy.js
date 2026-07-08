export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Falta la URL' });
  }

  try {
    // 1. Nos disfrazamos para saltar el Error 403
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://tv.volleyballworld.com/', // JWPlayer creerá que somos la página oficial
        'Origin': 'https://tv.volleyballworld.com'
      }
    });

    if (!response.ok) {
       return res.status(response.status).send(`Error de JWPlayer: ${response.status}`);
    }

    const text = await response.text();

    // 2. Lógica del "Lector de Texto" (Manifest Rewriting)
    const baseUrl = new URL(url);
    const basePath = baseUrl.origin + baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

    const rewrittenM3u8 = text.split('\n').map(line => {
      if (line && !line.startsWith('#') && !line.startsWith('http')) {
        // Convertimos rutas relativas a absolutas
        let absoluteUrl = line.startsWith('/') ? baseUrl.origin + line : basePath + line;
        
        // LA MAGIA: Si la línea apunta a otra lista de texto (.m3u8), la volvemos a pasar por Vercel
        if (absoluteUrl.includes('.m3u8')) {
          return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
        } 
        // Si la línea apunta a video pesado (.ts, .m4s, .mp4), se va DIRECTO a JWPlayer
        else {
          return absoluteUrl;
        }
      }
      return line;
    }).join('\n');

    // 3. Devolvemos el texto limpio y con permisos abiertos a tu página
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.status(200).send(rewrittenM3u8);

  } catch (error) {
    res.status(500).json({ error: 'Error interno en el lector de Vercel' });
  }
}
