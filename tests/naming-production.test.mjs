import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createStaticServer } from '../server.mjs'

const storageKey = 'shards-observatory-v1'
const sequence = [
  { mask: 960, name: 'Reconciliation' },
  { mask: 964, name: 'Innovation' },
  { mask: 26564, name: 'Restraint' },
]

function edges(lineage) {
  if (!lineage.parents) return []
  return lineage.parents.flatMap(parent => [`${parent.mask}:${lineage.mask}`, ...edges(parent)])
}

test('approved v5 sequence, canonical mergers and legacy-save constellation survive production deployment', { timeout: 60_000 }, async () => {
  let server, browser
  let origin = process.env.SHARDS_PRODUCTION_URL
  try {
    if (!origin) {
      server = createStaticServer()
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
      origin = `http://127.0.0.1:${server.address().port}`
    }
    browser = await chromium.launch({ args: ['--disable-gpu'] })
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(origin)
    await page.getByRole('button', { name: /I accept the spoilers/ }).click()

    async function merge(left, right) {
      await page.locator(`.shard-node[data-mask="${left}"]`).click()
      await page.locator(`.shard-node[data-mask="${right}"]`).click()
      await page.locator(`.shard-node[data-mask="${left | right}"]`).waitFor()
    }

    async function append(mask, source) {
      const count = await page.locator('.shard-node').count()
      await page.locator(`[data-choice-key="source-${source}"]`).click()
      assert.equal(await page.locator('.shard-node').count(), count + 1, 'A source click must only stage it')
      await merge(mask, source)
      return mask | source
    }

    await merge(64, 512)
    assert.equal(await page.locator('.shard-node[data-mask="576"] .node-name').innerText(), 'Retribution')
    let mask = await append(576, 128)
    mask = await append(mask, 256)
    assert.equal(mask, sequence[0].mask)
    assert.equal(await page.locator(`.shard-node[data-mask="${mask}"] .node-name`).innerText(), sequence[0].name)
    mask = await append(mask, 4)
    assert.equal(mask, sequence[1].mask)
    assert.equal(await page.locator(`.shard-node[data-mask="${mask}"] .node-name`).innerText(), sequence[1].name)
    for (const source of [1024, 8192, 16384]) mask = await append(mask, source)
    assert.equal(mask, sequence[2].mask)
    assert.equal(await page.locator(`.shard-node[data-mask="${mask}"] .node-name`).innerText(), sequence[2].name)

    for (const source of [1024, 4096]) await page.locator(`[data-choice-key="source-${source}"]`).click()
    await merge(1024, 4096)
    assert.equal(await page.locator('.shard-node[data-mask="5120"] .node-name').innerText(), 'Harmony')

    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)
    const legacy = { ...saved, discoveries: saved.discoveries.map(({ paths: _paths, ...discovery }) => discovery) }
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: storageKey, state: legacy })
    await page.reload()
    await page.locator('.shard-node[data-mask="26564"]').waitFor()
    const migrated = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)
    assert.deepEqual(migrated.orbs, saved.orbs)
    assert.deepEqual(migrated.discoveries.map(record => record.mask), saved.discoveries.map(record => record.mask))
    for (const record of migrated.discoveries) {
      assert.deepEqual(record.lineage, saved.discoveries.find(previous => previous.mask === record.mask).lineage)
      assert.deepEqual(record.paths, [record.lineage])
    }

    await page.locator('.navigation button').click()
    for (const { mask: selected, name } of [...sequence, { mask: 576, name: 'Retribution' }, { mask: 5120, name: 'Harmony' }]) {
      await page.locator(`[data-constellation-mask="${selected}"]`).click()
      assert.equal(await page.locator('.constellation-detail h3').innerText(), name)
      const badge = page.locator('.constellation-detail .lore-badge')
      if (selected === 576 || selected === 5120) assert.equal(await badge.innerText(), 'CANON MERGER')
      else assert.equal(await badge.count(), 0)
      const displayed = await page.locator('[data-parent-mask]').evaluateAll(nodes => nodes.map(node => `${node.dataset.parentMask}:${node.dataset.childMask}`).sort())
      assert.deepEqual(displayed, edges(saved.discoveries.find(record => record.mask === selected).lineage).sort())
    }
    await page.locator('[data-constellation-mask="26564"]').click()
    assert.equal(await page.locator('.focused-constituents').innerText(), 'Cultivation + Honor + Invention + Mercy + Odium + Preservation + Valor + Virtuosity')
    if (process.env.SHARDS_SCREENSHOT_DIR) {
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: join(process.env.SHARDS_SCREENSHOT_DIR, 'shards-azure-naming-v5.png'), fullPage: true })
    }
    assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length), 0)
    assert.deepEqual(errors, [])
    console.log('Verified v5: Reconciliation (960) -> Innovation (964) -> Restraint (26564); Harmony, Retribution and legacy lineage preserved.')
  } finally {
    await browser?.close()
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
