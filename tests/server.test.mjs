import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStaticServer } from '../server.mjs'

let root, server, origin
const html = '<!doctype html><title>The Confluence</title>'

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'confluence-server-test-'))
  await mkdir(join(root, 'assets'))
  await writeFile(join(root, 'index.html'), html)
  await writeFile(join(root, 'assets', 'app-12345678.js'), 'console.log("Confluence")')
  await writeFile(join(root, 'NAMING-NOTICES.txt'), 'Naming attribution')
  server = createStaticServer(root)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  if (root) await rm(root, { recursive: true })
})

test('production shell and assets use appropriate types, caching and security headers', async () => {
  const shell = await fetch(origin, { headers: { 'x-forwarded-proto': 'https' } })
  assert.equal(shell.status, 200)
  assert.equal(await shell.text(), html)
  assert.equal(shell.headers.get('cache-control'), 'no-cache')
  assert.match(shell.headers.get('content-type'), /text\/html/)
  assert.equal(shell.headers.get('x-content-type-options'), 'nosniff')
  assert.match(shell.headers.get('content-security-policy'), /script-src 'self'/)
  assert.match(shell.headers.get('content-security-policy'), /frame-ancestors 'none'/)
  assert.equal(shell.headers.get('strict-transport-security'), 'max-age=31536000')
  const asset = await fetch(`${origin}/assets/app-12345678.js`)
  assert.equal(asset.status, 200)
  assert.match(asset.headers.get('content-type'), /text\/javascript/)
  assert.match(asset.headers.get('cache-control'), /immutable/)
  const notice = await fetch(`${origin}/NAMING-NOTICES.txt`)
  assert.equal(notice.status, 200)
  assert.equal(notice.headers.get('content-type'), 'text/plain; charset=utf-8')
  assert.equal(await notice.text(), 'Naming attribution')
})

test('routing fallback applies to HTML navigation, never missing assets or private paths', async () => {
  const route = await fetch(`${origin}/study/recalled`, { headers: { accept: 'text/html' } })
  assert.equal(route.status, 200)
  assert.equal(await route.text(), html)
  for (const path of ['/assets/missing.js', '/package.json', '/server.mjs', '/.env', '/%2e%2e%2fsecret.txt']) {
    assert.equal((await fetch(`${origin}${path}`, { headers: { accept: 'text/html' } })).status, 404, path)
  }
  assert.equal((await fetch(`${origin}/unknown`)).status, 404)
  assert.equal((await fetch(`${origin}/%ZZ`)).status, 400)
  assert.equal((await fetch(`${origin}/%00`)).status, 400)
  assert.equal((await fetch(`${origin}/%5csecret`)).status, 400)
})

test('readiness and HEAD work and mutations are explicitly rejected', async () => {
  assert.equal(await (await fetch(`${origin}/healthz`)).text(), 'ok')
  const head = await fetch(origin, { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(head.headers.get('content-length'), String(Buffer.byteLength(html)))
  assert.equal(await head.text(), '')
  const post = await fetch(origin, { method: 'POST' })
  assert.equal(post.status, 405)
  assert.equal(post.headers.get('allow'), 'GET, HEAD')
})
