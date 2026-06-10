export default async function handler(req, res) {
  const { url } = req.query;
  const origin = req.headers.origin || '';

  if (origin && !origin.includes('voleylibre.com') && !origin.includes('motochupaca.vercel.app')) {
    return res.status(403).json({ error: 'Robo de señal detectado. Acceso denegado.' });
  }

  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro URL' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });

    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/vnd.apple.mpegurl');
    res.status(response.status).send(Buffer.from(buffer));

  } catch (error) {
    res.status(500).json({ error: 'Error interno del proxy' });
  }
}
