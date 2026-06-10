export default async function handler(req, res) {
  const { url } = req.query;
  const origin = req.headers.origin || '';

  // 🔴 EL CANDADO: Si la petición viene de otra web que no sea Voley Libre o tu propio Vercel, la bloqueamos.
  if (origin && !origin.includes('voleylibre.com') && !origin.includes('motochupaca.vercel.app')) {
    return res.status(403).json({ error: 'Robo de señal detectado. Acceso denegado.' });
  }

  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro URL' });
  }

  // 🔴 DOBLE CANDADO GEOGRÁFICO: Bloqueo a nivel de servidor Vercel (Europa y USA)
  const country = req.headers['x-vercel-ip-country'];
  const blockedCountries = ['CH', 'FR', 'DE', 'GB', 'NL', 'US', 'IT', 'AT'];

  if (country && blockedCountries.includes(country)) {
    return res.status(451).json({ error: 'Unavailable For Legal Reasons' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });

    // Le damos acceso CORS estrictamente al dominio que pasó la prueba (tu web)
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
