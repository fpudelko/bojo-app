// Brama udająca Supabase dla `scripts/stos-bez-dockera.sh`.
//
// W prawdziwym Supabase jeden adres (`:54321`) rozdziela ruch między GoTrue
// (`/auth/v1`) a PostgREST (`/rest/v1`) i odpowiada na CORS. supabase-js zna
// wyłącznie ten jeden adres, więc bez bramy aplikacja nie ma jak dojść do
// dwóch osobnych procesów. Realtime, Storage i funkcji brzegowych tu nie ma:
// żądanie na inną ścieżkę dostaje 404, a skrypt mówi o tym na starcie.
//
// Porty przychodzą ze zmiennych, żeby skrypt był jedynym miejscem, gdzie
// są zapisane.
import http from 'node:http';

const PORT = Number(process.env.PORT_BRAMY || 54321);
const CELE = [
  ['/auth/v1', Number(process.env.PORT_GOTRUE || 9999)],
  ['/rest/v1', Number(process.env.PORT_POSTGREST || 3001)],
];

http.createServer((req, res) => {
  const cors = {
    'access-control-allow-origin': req.headers.origin || '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': req.headers['access-control-request-headers'] || '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-expose-headers': 'content-range, content-profile, x-supabase-api-version',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

  const cel = CELE.find(([prefiks]) => req.url.startsWith(prefiks));
  if (!cel) { res.writeHead(404, cors); return res.end('{"message":"brak tej usługi w stosie bez Dockera"}'); }

  const [prefiks, port] = cel;
  const przekaz = http.request({
    host: '127.0.0.1',
    port,
    path: req.url.slice(prefiks.length) || '/',
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${port}` },
  }, (odp) => {
    res.writeHead(odp.statusCode, { ...odp.headers, ...cors });
    odp.pipe(res);
  });
  przekaz.on('error', (e) => { res.writeHead(502, cors); res.end(JSON.stringify({ message: String(e) })); });
  req.pipe(przekaz);
}).listen(PORT, '127.0.0.1', () => console.log(`brama :${PORT}`));
