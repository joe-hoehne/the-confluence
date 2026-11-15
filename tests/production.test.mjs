import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createStaticServer } from '../server.mjs'

test('individual original and compound removal preserves Arcanum, supports Undo and persists on reload', { timeout: 45_000 }, async () => {
  let server, browser
  let origin = process.env.SHARDS_PRODUCTION_URL
  try {
    if (!origin) {
      server = createStaticServer()
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
      origin = `http://127.0.0.1:${server.address().port}`
    }
    browser = await chromium.launch({ args: ['--disable-gpu'] })
    const context = await browser.newContext({ reducedMotion: 'reduce', hasTouch: true, viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const savedState = () => page.evaluate(() => JSON.parse(localStorage.getItem('shards-observatory-v1')))
    await page.goto(origin)
    await page.getByRole('button', { name: /I accept the spoilers/ }).click()
    const initial = await savedState()
    assert.equal(await page.locator('.remove-shard').count(), 0, 'Unselected crystals have no Remove control')
    await page.locator('.shard-node[data-mask="64"]').click()
    assert.equal(await page.locator('.remove-shard').count(), 1, 'Only the selected crystal exposes Remove')
    const removeHonor = page.getByRole('button', { name: 'Remove Honor from well', exact: true })
    await removeHonor.focus()
    await removeHonor.press('Enter')
    assert.deepEqual((await savedState()).orbs, initial.orbs.filter(orb => orb.lineage.mask !== 64))
    assert.equal(await page.locator('.shard-node[data-mask="512"]').evaluate(node => node === document.activeElement), true)
    assert.equal(await page.locator('.shard-node[aria-pressed="true"]').count(), 0)
    assert.match(await page.getByRole('status').innerText(), /Honor removed from the well/)
    assert.equal(await page.locator('[data-choice-key="source-64"]').count(), 1)
    await page.getByRole('button', { name: 'Undo action', exact: true }).click()
    assert.deepEqual((await savedState()).orbs, initial.orbs)
    await page.locator('.shard-node[data-mask="64"]').click()
    await page.locator('.shard-node[data-mask="512"]').click()
    await page.locator('.shard-node[data-mask="576"]').waitFor()
    const compound = await savedState()
    assert.equal(await page.locator('.remove-shard').count(), 0)
    await page.locator('.shard-node[data-mask="576"]').click()
    await page.getByRole('button', { name: 'Remove Retribution from well', exact: true }).tap()
    assert.equal(await page.locator('.shard-node').count(), 0)
    assert.deepEqual((await savedState()).discoveries, compound.discoveries)
    assert.equal(await page.locator('#well').evaluate(node => node === document.activeElement), true)
    await page.getByRole('button', { name: 'Undo action', exact: true }).click()
    assert.deepEqual((await savedState()).orbs, compound.orbs)
    assert.deepEqual((await savedState()).discoveries, compound.discoveries)
    await page.locator('.shard-node[data-mask="576"]').click()
    await page.getByRole('button', { name: 'Remove Retribution from well', exact: true }).click()
    await page.reload()
    await page.locator('.empty-well').waitFor()
    assert.equal(await page.locator('.shard-node').count(), 0)
    assert.deepEqual((await savedState()).discoveries, compound.discoveries)
    await page.locator('.navigation button').click()
    await page.locator('[data-constellation-mask="576"]').click()
    assert.equal(await page.locator('[data-parent-mask]').count(), 2)
    await page.getByRole('button', { name: /Recall Retribution in the well/ }).click()
    await page.locator('[data-choice-key="source-4"]').tap()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.shard-node[data-mask="576"]').tap()
    await page.getByRole('button', { name: 'Remove Retribution from well', exact: true }).tap()
    const remaining = await savedState()
    assert.equal(remaining.orbs.length, 1)
    assert.equal(remaining.orbs[0].lineage.mask, 4)
    assert.deepEqual(remaining.discoveries, compound.discoveries)
    await page.reload()
    await page.locator('.shard-node[data-mask="4"]').waitFor()
    assert.deepEqual((await savedState()).orbs, remaining.orbs)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    await page.locator('[data-choice-key="source-4"]').tap()
    const duplicates = await savedState()
    await page.locator('.shard-node').first().tap()
    await page.locator('.remove-shard').first().tap()
    assert.deepEqual((await savedState()).orbs, [duplicates.orbs[1]], 'Only the chosen staged instance is removed')
    await page.getByRole('button', { name: 'Undo action', exact: true }).click()
    assert.deepEqual((await savedState()).orbs, duplicates.orbs)
    if (process.env.SHARDS_SCREENSHOT_DIR) {
      await page.locator('.shard-node').first().tap()
      await page.locator('.remove-shard').first().tap()
      await page.locator('.shard-node').first().tap()
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: join(process.env.SHARDS_SCREENSHOT_DIR, 'shards-remove-mobile.png'), fullPage: true })
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.locator('.navigation button').click()
      await page.locator('[data-constellation-mask="576"]').click()
      await page.getByRole('button', { name: /Recall Retribution in the well/ }).click()
      await page.locator('.shard-node[data-mask="576"]').click()
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: join(process.env.SHARDS_SCREENSHOT_DIR, 'shards-remove-desktop.png'), fullPage: true })
    }
    assert.deepEqual(errors, [])
    assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length), 0)
  } finally {
    await browser?.close()
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
test('production CSP, entry, direct placement, canonical fusion, constellation and reload', { timeout: 45_000 }, async () => {
  let server, browser
  let origin = process.env.SHARDS_PRODUCTION_URL
  try {
    if (!origin) {
      server = createStaticServer()
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
      origin = `http://127.0.0.1:${server.address().port}`
    }
    browser = await chromium.launch({ args: ['--disable-gpu'] })
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      window.productionCspViolations = []
      document.addEventListener('securitypolicyviolation', event => window.productionCspViolations.push(event.violatedDirective))
    })
    const response = await page.goto(origin)
    assert.equal(response.status(), 200)
    assert.match(response.headers()['content-security-policy'], /script-src 'self'/)
    assert.equal(await page.locator('.shard-node').count(), 0)
    await page.getByRole('button', { name: /I accept the spoilers/ }).click()
    await page.locator('.shard-node[data-mask="64"]').click()
    await page.locator('.shard-node[data-mask="512"]').click()
    await page.locator('.shard-node[data-mask="576"]').waitFor()
    assert.equal(await page.locator('.node-name').innerText(), 'Retribution')
    await page.locator('[data-choice-key="source-4"]').click()
    assert.equal(await page.locator('.shard-node').count(), 2)
    if (process.env.SHARDS_SCREENSHOT_DIR) {
      await page.locator('.shard-node[data-mask="4"]').focus()
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: join(process.env.SHARDS_SCREENSHOT_DIR, 'shards-azure-desktop.png'), fullPage: true })
      await page.setViewportSize({ width: 390, height: 844 })
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: join(process.env.SHARDS_SCREENSHOT_DIR, 'shards-azure-mobile.png'), fullPage: true })
      await page.setViewportSize({ width: 1280, height: 900 })
    }
    await page.locator('.navigation button').click()
    await page.locator('[data-constellation-mask="576"]').click()
    assert.equal(await page.locator('.constellation-detail h3').innerText(), 'Retribution')
    assert.equal(await page.locator('[data-parent-mask]').count(), 2)
    if (process.env.SHARDS_SCREENSHOT_DIR) {
      await page.screenshot({ path: join(process.env.SHARDS_SCREENSHOT_DIR, 'shards-azure-constellation.png'), fullPage: true })
    }
    await page.getByRole('button', { name: /Recall Retribution in the well/ }).click()
    assert.equal(await page.locator('.shard-node').count(), 3)
    await page.reload()
    await page.locator('.shard-node').first().waitFor()
    assert.equal(await page.locator('.shard-node').count(), 3)
    assert.equal(await page.locator('.shard-node[data-mask="576"]').count(), 2)
    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length), 0)
    assert.deepEqual(await page.evaluate(() => window.productionCspViolations), [])
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
