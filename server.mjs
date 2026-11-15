import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { realpathSync, statSync } from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), 'dist')
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

export function createStaticServer(root = defaultRoot) {
  const directory = realpathSync(root)
  if (!statSync(resolve(directory, 'index.html')).isFile()) throw new Error('Production index.html is missing. Run npm run build.')

  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'")
    if (process.env.WEBSITE_HOSTNAME || request.headers['x-forwarded-proto'] === 'https') {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000')
    }

    function finish(status, body, type = 'text/plain; charset=utf-8', cache = 'no-store') {
      response.writeHead(status, {
        'Content-Type': type,
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': cache,
      })
      response.end(request.method === 'HEAD' ? undefined : body)
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD')
      return finish(405, 'Method not allowed.')
    }

    let pathname
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    } catch {
      return finish(400, 'Invalid request path.')
    }
    if (pathname.includes('\0') || pathname.includes('\\')) return finish(400, 'Invalid request path.')
    if (pathname === '/healthz') return finish(200, 'ok')
    if (pathname.split('/').some(part => part.startsWith('.'))) return finish(404, 'Not found.')

    let filename = pathname === '/' ? 'index.html' : pathname.slice(1)
    const target = resolve(directory, filename)
    const inside = relative(directory, target)
    if (inside.startsWith(`..${sep}`) || inside === '..' || isAbsolute(inside)) return finish(404, 'Not found.')

    try {
      let body
      try {
        body = await readFile(target)
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR' && error.code !== 'EISDIR') throw error
        // Only HTML navigation gets the app shell; missing assets must remain failures.
        if (extname(pathname) || !request.headers.accept?.includes('text/html')) return finish(404, 'Not found.')
        filename = 'index.html'
        body = await readFile(resolve(directory, filename))
      }
      const cache = filename.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'
      finish(200, body, contentTypes[extname(filename)] ?? 'application/octet-stream', cache)
    } catch (error) {
      console.error('Static response failed:', error)
      finish(500, 'The Confluence could not serve this request.')
    }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8080)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.')
  const server = createStaticServer()
  server.requestTimeout = 30_000
  server.headersTimeout = 15_000
  server.listen(port, '0.0.0.0', () => console.log(`The Confluence is listening on port ${port}.`))
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(error => { if (error) { console.error('Server shutdown failed:', error); process.exitCode = 1 } })
      const timeout = setTimeout(() => { console.error('Server shutdown timed out.'); process.exit(1) }, 10_000)
      timeout.unref()
    })
  }
}
