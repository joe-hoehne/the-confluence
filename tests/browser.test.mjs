import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { SHARDS, STORAGE_KEY, SPOILER_KEY, addOrb, combine, constituents, emptyState, leaf, lineageSignature, maskOf, resolveName } from '../src/engine.ts'
import { buildConstellation, historyEdges } from '../src/constellation.ts'

let server, browser, url

before(async () => {
  server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
  await server.listen()
  const address = server.httpServer.address()
  url = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch()
})

after(async () => {
  await browser?.close()
  await server?.close()
})

function tree(mask) {
  const bits = SHARDS.map((_, index) => 1 << index).filter(bit => mask & bit)
  return bits.slice(1).reduce((lineage, bit) => combine(lineage, leaf(bit)), leaf(bits[0]))
}

function fixtures() {
  const honor = leaf(maskOf('Honor')), odium = leaf(maskOf('Odium')), cultivation = leaf(maskOf('Cultivation'))
  const retribution = combine(honor, odium)
  const reformation = combine(retribution, cultivation)
  const alternate = combine(combine(honor, cultivation), odium)
  const names = new Map()
  let duplicates
  for (let mask = 1; mask <= 65535 && !duplicates; mask++) {
    if (constituents(mask).length < 2) continue
    const name = resolveName(mask).name
    if (names.has(name)) duplicates = [names.get(name), mask]
    else names.set(name, mask)
  }
  const records = new Map()
  function record(lineage) {
    lineage.parents?.forEach(record)
    if (lineage.parents && !records.has(lineage.mask)) records.set(lineage.mask, {
      mask: lineage.mask, lineage, paths: [lineage], discoveredAt: '2026-11-08T00:00:00Z',
    })
  }
  const featured = [
    tree(maskOf('Preservation', 'Ruin')), reformation, tree(maskOf('Invention', 'Virtuosity')),
    tree(maskOf('Endowment', 'Mercy')), tree(maskOf('Cultivation', 'Ruin')),
    tree(maskOf('Autonomy', 'Dominion')), tree(maskOf('Honor', 'Mercy', 'Valor')),
    ...duplicates.map(tree), tree(65535),
  ]
  featured.forEach(record)
  records.get(reformation.mask).paths.push(alternate)
  let state = { ...emptyState(), discoveries: [...records.values()] }
  state = addOrb(state, retribution, .32, .43)
  state = addOrb(state, tree(maskOf('Preservation', 'Ruin')), .68, .47)
  return { state, duplicates, reformation }
}

async function seed(page, state) {
  await page.goto(url)
  await page.evaluate(({ state, saveKey, consentKey }) => {
    localStorage.setItem(saveKey, JSON.stringify(state))
    localStorage.setItem(consentKey, 'yes')
  }, { state, saveKey: STORAGE_KEY, consentKey: SPOILER_KEY })
  await page.reload()
  await page.locator('.shard-node').first().waitFor()
}

async function capture(page, name, selector) {
  if (!process.env.SHARDS_SCREENSHOT_DIR) return
  const options = { path: join(process.env.SHARDS_SCREENSHOT_DIR, name) }
  if (selector) await page.locator(selector).screenshot(options)
  else await page.screenshot({ ...options, fullPage: true })
}

async function currentState(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)
}

function edgeIds(edges) {
  return edges.map(edge => `${edge.parent}:${edge.child}`).sort()
}

async function visibleEdges(page) {
  return page.locator('[data-parent-mask]').evaluateAll(nodes => nodes.map(node => ({
    parent: Number(node.dataset.parentMask), child: Number(node.dataset.childMask),
  })))
}

test('native drag, direct source activation, intentional merges and canon-only presentation', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(url)
    assert.equal(await page.locator('.shard-node').count(), 0)
    await page.getByRole('button', { name: /I accept the spoilers/ }).click()
    const a = await page.locator('[data-mask="64"]').boundingBox()
    const b = await page.locator('[data-mask="512"]').boundingBox()
    await page.mouse.move(a.x + a.width / 2, a.y + 65)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2, b.y + 65, { steps: 16 })
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelector('.node-name')?.textContent === 'Retribution')
    await page.locator('[data-choice-key="source-4"]').click()
    assert.equal(await page.locator('.shard-node').count(), 2)
    assert.equal(await page.locator('.place-button').count(), 0)
    await page.locator('[data-mask="576"]').click()
    await page.locator('[data-choice-key="source-1024"]').click()
    assert.equal(await page.locator('.shard-node').count(), 3)
    assert.equal((await currentState(page)).fusions, 1)
    assert.equal(await page.locator('.shard-node[aria-pressed="true"]').count(), 0)
    await page.locator('[data-mask="576"]').click()
    await page.locator('[data-mask="4"]').click()
    await page.waitForFunction(() => document.querySelector('[data-mask="580"]'))
    await page.locator('[data-choice-key="source-64"]').focus()
    await page.keyboard.press('Enter')
    await page.locator('[data-mask="64"]').click()
    await page.locator('[data-mask="580"]').click()
    assert.match(await page.getByRole('status').innerText(), /share Honor/)
    await page.keyboard.press('Escape')
    assert.doesNotMatch(await page.locator('body').innerText(), /fan conjecture|null\./i)
    await page.locator('.navigation button').click()
    await page.locator('[data-constellation-mask="580"]').focus()
    await page.keyboard.press('Space')
    assert.equal(await page.locator('.constellation-detail h3').innerText(), 'Reformation')
    assert.equal(await page.locator('.constellation-detail .lore-badge').count(), 0)
    await page.locator('[data-constellation-mask="576"]').click()
    assert.equal(await page.locator('.constellation-detail .lore-badge').innerText(), 'CANON MERGER')
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('dialog').count(), 0)
    await page.reload()
    assert.ok((await currentState(page)).discoveries.some(discovery => discovery.mask === 580))
    assert.deepEqual(errors, [])
  } finally { await context.close() }
})

test('constellation topology, duplicate-name identity, recorded route choice, search and one-click reuse', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const { state, duplicates, reformation } = fixtures()
  try {
    await seed(page, state)
    const entryBounds = await page.locator('.archive-entry').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom }
    }))
    assert.ok(entryBounds.every((rect, index) => index === 0 || rect.top >= entryBounds[index - 1].bottom - 1), 'Long constituent lists overlap')
    await capture(page, 'shards-desktop.png')
    await page.locator('.navigation button').click()
    const graph = buildConstellation(state.discoveries, state.orbs)
    const masks = await page.locator('[data-constellation-mask]').evaluateAll(nodes => nodes.map(node => Number(node.dataset.constellationMask)).sort((a, b) => a - b))
    assert.deepEqual(masks, graph.nodes.map(node => node.mask))
    for (const mask of duplicates) {
      await page.locator(`[data-constellation-mask="${mask}"]`).click()
      assert.equal(await page.locator('.constellation-detail h3').innerText(), resolveName(mask).name)
      assert.equal(await page.locator('.focused-constituents').innerText(), constituents(mask).map(part => part.name).join(' + '))
    }
    await page.locator('[data-constellation-mask="65535"]').click()
    assert.equal(await page.locator('.constellation-detail .lore-badge').count(), 0)
    assert.match(await page.locator('.focused-note').innerText(), /not known to restore/)
    assert.equal(await page.locator('.focused-history li').count(), 31)
    await page.locator(`[data-constellation-mask="${reformation.mask}"]`).click()
    assert.deepEqual(edgeIds(await visibleEdges(page)), edgeIds(historyEdges(reformation)))
    await page.getByLabel('Recorded combination route').selectOption('1')
    const alternate = state.discoveries.find(discovery => discovery.mask === reformation.mask).paths[1]
    assert.deepEqual(edgeIds(await visibleEdges(page)), edgeIds(historyEdges(alternate)))
    assert.ok(await page.locator('.constellation-star.dimmed').count() > 0)
    await capture(page, 'shards-constellation.png', 'dialog')
    await page.getByRole('button', { name: 'Compact list', exact: true }).click()
    await page.getByRole('searchbox').fill('Honor')
    const expected = graph.nodes.filter(node => `${resolveName(node.mask).name} ${constituents(node.mask).map(part => part.name).join(' ')}`.toLowerCase().includes('honor'))
    assert.equal(await page.locator('.constellation-list-entry').count(), expected.length)
    await page.getByRole('searchbox').fill('')
    for (const mask of duplicates) assert.equal(await page.locator(`[data-list-mask="${mask}"]`).count(), 1)
    await page.locator(`[data-list-mask="${reformation.mask}"]`).click()
    await page.getByLabel('Recorded combination route').selectOption('1')
    await page.locator('.recall-star').click()
    assert.equal(await page.locator('dialog').count(), 0)
    const saved = await currentState(page)
    assert.equal(saved.orbs.length, state.orbs.length + 1)
    assert.equal(lineageSignature(saved.orbs.at(-1).lineage), lineageSignature(alternate))
    assert.equal(saved.discoveries.find(discovery => discovery.mask === reformation.mask).paths.length, 2)
    assert.equal(await page.locator(':focus').getAttribute('data-mask'), String(reformation.mask))
    await page.reload()
    await page.locator('.navigation button').click()
    assert.equal(await page.getByLabel('Recorded combination route').locator('option').count(), 2)
    assert.deepEqual(await page.locator('[data-constellation-mask]').evaluateAll(nodes => nodes.map(node => Number(node.dataset.constellationMask)).sort((a, b) => a - b)), masks)
  } finally { await context.close() }
})

test('legacy-save migration, actual touch, small-screen constellation and reduced motion', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  const { state } = fixtures()
  const legacy = { ...state, discoveries: state.discoveries.map(({ paths: _paths, ...discovery }) => discovery) }
  try {
    await seed(page, legacy)
    const migrated = await currentState(page)
    assert.deepEqual(migrated.discoveries.map(discovery => discovery.mask), legacy.discoveries.map(discovery => discovery.mask))
    assert.ok(migrated.discoveries.every(discovery => discovery.paths.length === 1))
    const count = await page.locator('.shard-node').count()
    await page.locator('[data-choice-key="source-4"]').tap()
    assert.equal(await page.locator('.shard-node').count(), count + 1)
    await page.locator('.navigation button').tap()
    await page.locator('[data-constellation-mask="580"]').tap()
    assert.equal(await page.locator('.constellation-detail h3').innerText(), 'Reformation')
    for (const width of [320, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 })
      const metrics = await page.evaluate(() => {
        const dialog = document.querySelector('dialog')
        return { pageWidth: document.documentElement.scrollWidth, dialogWidth: dialog.clientWidth, dialogScroll: dialog.scrollWidth }
      })
      assert.ok(metrics.pageWidth <= width, `Page overflow at ${width}: ${metrics.pageWidth}`)
      assert.ok(metrics.dialogScroll <= metrics.dialogWidth + 1, `Constellation overflow at ${width}: ${JSON.stringify(metrics)}`)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const motion = await page.locator('.constellation-star, .star-crystal, .crystal').evaluateAll(nodes => nodes.map(node => {
      const style = getComputedStyle(node)
      return { animation: style.animationName, transition: style.transitionDuration }
    }))
    assert.ok(motion.every(style => style.animation === 'none' && style.transition.split(',').every(duration => duration.trim() === '0s')))
    await capture(page, 'shards-constellation-mobile.png', 'dialog')
    await page.getByRole('button', { name: 'Compact list', exact: true }).tap()
    await page.getByRole('searchbox').fill('Harmony')
    await page.locator(`[data-list-mask="${maskOf('Preservation', 'Ruin')}"]`).tap()
    await page.locator('.recall-star').tap()
    assert.equal(await page.locator('dialog').count(), 0)
    assert.equal(await page.locator('.shard-node').count(), count + 2)
  } finally { await context.close() }
})
