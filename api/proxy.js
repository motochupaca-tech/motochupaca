export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro URL' });
  }

  try {
    // 1. Falsificamos la identidad (Spoofing) para saltar el bloqueo
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://tv.volleyballworld.com/', // Engañamos al servidor
        'Origin': 'https://tv.volleyballworld.com'
      }
    });

    if (!response.ok) {
       return res.status(response.status).send('Error al contactar el servidor de video');
    }

    const text = await response.text();

    // 2. Lógica del "Lector de Texto"
    const baseUrl = new URL(url);
    const basePath = baseUrl.origin + baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

    const rewrittenM3u8 = text.split('\n').map(line => {
      // Ignorar comentarios y líneas vacías
      if (line && !line.startsWith('#') && !line.startsWith('http')) {
        // Convertir ruta relativa a absoluta apuntando al servidor oficial
        let absoluteUrl = line.startsWith('/') ? baseUrl.origin + line : basePath + line;
        
        // Si el texto apunta a OTRA lista de resoluciones (.m3u8), la volvemos a pasar por nuestro lector
        if (absoluteUrl.includes('.m3u8')) {
          return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
        } else {
          // SI ES VIDEO PESADO (.ts, .m4s), SE VA DIRECTO AL NAVEGADOR DEL USUARIO
          // ¡ESTO SALVA TU ANCHO DE BANDA!
          return absoluteUrl;
        }
      }
      return line;
    }).join('\n');

    // 3. Devolvemos el texto a tu reproductor con permisos abiertos
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.status(200).send(rewrittenM3u8);

  } catch (error) {
    res.status(500).json({ error: 'Error interno del lector' });
  }
}
