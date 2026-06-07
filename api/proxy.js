export default async function handler(req, res) {
  // Obtenemos la URL del M3U8 o del fragmento .ts que queremos reproducir
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro URL' });
  }

  try {
    // El proxy hace la petición al servidor de JWPlayer por ti
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });

    // 🔴 LA MAGIA: Le inyectamos las cabeceras CORS para que tu página no sea bloqueada
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Manejar peticiones de pre-vuelo (OPTIONS)
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Devolvemos el contenido exacto (el texto del m3u8 o el video de los .ts)
    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/vnd.apple.mpegurl');
    res.status(response.status).send(Buffer.from(buffer));

  } catch (error) {
    res.status(500).json({ error: 'Error interno del proxy' });
  }
}
