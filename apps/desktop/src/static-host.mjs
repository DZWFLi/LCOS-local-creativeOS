import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, request as httpRequest } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
  ['.pdf', 'application/pdf'],
])

function safeFile(root, urlPath) {
  let decoded
  try { decoded = decodeURIComponent(urlPath.split('?')[0] || '/') } catch { return null }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
  const candidate = resolve(root, normalize(relative))
  const base = resolve(root)
  return candidate === base || candidate.startsWith(`${base}${process.platform === 'win32' ? '\\' : '/'}`)
    ? candidate
    : null
}

function proxyToCore(req, res, { corePort, token }) {
  const prefix = '/api/local-core/v1'
  const upstreamPath = req.url?.startsWith(prefix) ? req.url.slice(prefix.length) || '/' : req.url || '/'
  const headers = { ...req.headers }
  delete headers.origin
  delete headers.referer
  delete headers.host
  headers.authorization = `Bearer ${token}`
  headers.host = `127.0.0.1:${corePort}`

  const upstream = httpRequest({
    hostname: '127.0.0.1',
    port: corePort,
    path: upstreamPath,
    method: req.method,
    headers,
  }, (response) => {
    res.writeHead(response.statusCode ?? 502, response.headers)
    response.pipe(res)
  })
  upstream.on('error', (error) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: { code: 'DESKTOP_PROXY_ERROR', message: error.message } }))
  })
  req.pipe(upstream)
}

export async function startDesktopWebHost({ webRoot, corePort, token }) {
  if (!existsSync(join(webRoot, 'index.html'))) throw new Error(`Desktop web build missing: ${join(webRoot, 'index.html')}`)
  const server = createServer((req, res) => {
    const url = req.url ?? '/'
    if (url.startsWith('/api/local-core/v1')) {
      proxyToCore(req, res, { corePort, token })
      return
    }

    let file = safeFile(webRoot, url)
    if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    const missing = !file || !existsSync(file) || !statSync(file).isFile()
    if (missing) {
      const pathname = url.split('?')[0] || '/'
      if (extname(pathname)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        res.end('Not found')
        return
      }
      file = join(webRoot, 'index.html')
    }
    res.writeHead(200, {
      'content-type': MIME.get(extname(file).toLowerCase()) ?? 'application/octet-stream',
      'cache-control': file.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    })
    const stream = createReadStream(file)
    stream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end() })
    stream.pipe(res)
  })

  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolvePromise)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Desktop web host failed to bind.')
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolvePromise) => server.close(() => resolvePromise())),
  }
}
