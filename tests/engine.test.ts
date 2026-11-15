import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALL_MASK, SHARDS, STORAGE_KEY, addOrb, classification, combine, constituents, decodeState, emptyState, fuseOrbs, leaf, maskOf, openPosition, resolveName } from '../src/engine.ts'

test('all 65,519 merged sets have a stable nonempty name and complete constituents', () => {
  let total = 0
  for (let mask = 1; mask <= ALL_MASK; mask++) {
    const parts = constituents(mask)
    assert.equal(maskOf(...parts.map(part => part.name)), mask)
    if (parts.length === 1) continue
    total++
    const entry = resolveName(mask)
    assert.ok(entry.name.trim())
    assert.deepEqual(resolveName(mask), entry)
    assert.match(entry.name, /^[A-Za-z]+$/, `Not a single-word concept at mask ${mask}`)
    const forward = parts.reduce((tree, part) => tree ? combine(tree, leaf(maskOf(part.name))) : leaf(maskOf(part.name)), null as ReturnType<typeof leaf> | null)!
    const backward = [...parts].reverse().reduce((tree, part) => tree ? combine(tree, leaf(maskOf(part.name))) : leaf(maskOf(part.name)), null as ReturnType<typeof leaf> | null)!
    assert.equal(forward.mask, backward.mask)
    assert.deepEqual(resolveName(forward.mask), resolveName(backward.mask))
  }
  assert.equal(total, 65519)
  assert.equal(SHARDS.length, 16)
})

test('canonical names win, Dor is distinct, and all-sixteen is speculative', () => {
  assert.equal(resolveName(maskOf('Ruin', 'Preservation')).name, 'Harmony')
  assert.equal(resolveName(maskOf('Honor', 'Odium')).name, 'Retribution')
  assert.equal(resolveName(maskOf('Devotion', 'Dominion')).kind, 'gameplay')
  assert.match(resolveName(maskOf('Devotion', 'Dominion')).note, /Splintered/)
  assert.equal(resolveName(ALL_MASK).kind, 'speculative')
})

test('compound merges flatten identities but preserve immutable ancestry', () => {
  const harmony = combine(leaf(maskOf('Ruin')), leaf(maskOf('Preservation')))
  const retribution = combine(leaf(maskOf('Honor')), leaf(maskOf('Odium')))
  const before = JSON.stringify(harmony)
  const joined = combine(harmony, retribution)
  assert.equal(constituents(joined.mask).length, 4)
  assert.strictEqual(joined.parents?.[0], harmony)
  assert.strictEqual(joined.parents?.[1], retribution)
  assert.ok(Object.isFrozen(joined))
  assert.ok(Object.isFrozen(joined.parents))
  assert.ok(Object.isFrozen(harmony))
  assert.equal(JSON.stringify(harmony), before)
  assert.throws(() => combine(harmony, leaf(maskOf('Preservation'))), /share Preservation/)
  assert.throws(() => combine(harmony, harmony), /share/)
  assert.throws(() => leaf(harmony.mask), /Only original/)
})

test('fusion consumes operands, deduplicates discoveries and persists provenance', () => {
  let state = addOrb(emptyState(), leaf(maskOf('Preservation')), 0.3, 0.4)
  state = addOrb(state, leaf(maskOf('Ruin')), 0.7, 0.4)
  const first = fuseOrbs(state, 's1', 's2', '2026-11-08T00:00:00Z')
  assert.equal(first.state.orbs.length, 1)
  assert.equal(first.isNew, true)
  assert.equal(first.state.fusions, 1)
  const second = fuseOrbs(first.state, leaf(maskOf('Honor')), first.result.id)
  assert.equal(constituents(second.result.lineage.mask).length, 3)
  assert.equal(second.result.lineage.parents?.[1].parents?.[0].mask, maskOf('Preservation'))
  assert.deepEqual(decodeState(JSON.stringify(second.state)), second.state)
  let again = addOrb(second.state, leaf(maskOf('Preservation')), 0.2, 0.4)
  again = addOrb(again, leaf(maskOf('Ruin')), 0.6, 0.4)
  const duplicate = fuseOrbs(again, again.orbs.at(-2)!.id, again.orbs.at(-1)!.id)
  assert.equal(duplicate.isNew, false)
  assert.equal(duplicate.state.discoveries.length, 2)
  assert.equal(STORAGE_KEY, 'shards-observatory-v1')
})

test('bad saves are rejected explicitly instead of quietly resetting', () => {
  assert.throws(() => decodeState('{'))
  assert.throws(() => decodeState(JSON.stringify({ ...emptyState(), version: 2 })), /supported/)
  const good = addOrb(emptyState(), leaf(maskOf('Honor')), 0.4, 0.4)
  assert.throws(() => decodeState(JSON.stringify({ ...good, orbs: [...good.orbs, ...good.orbs] })), /canvas/)
  const bad = { ...good, orbs: [{ ...good.orbs[0], lineage: { mask: maskOf('Honor', 'Ruin'), parents: null } }] }
  assert.throws(() => decodeState(JSON.stringify(bad)), /original/)
  assert.throws(() => constituents(0), /identity/)
  assert.throws(() => constituents(65536), /identity/)
})

test('automatic placement gives recalled and selected Shards distinct open positions', () => {
  let state = emptyState()
  for (let i = 0; i < 9; i++) {
    const spot = openPosition(state.orbs)
    assert.ok(!state.orbs.some(orb => orb.x === spot.x && orb.y === spot.y))
    state = addOrb(state, leaf(1 << i), spot.x, spot.y)
  }
})

test('only established mergers receive positive canon labels', () => {
  assert.equal(classification(maskOf('Honor', 'Odium')), 'Canon merger')
  assert.equal(classification(maskOf('Ruin', 'Preservation')), 'Canon merger')
  assert.equal(classification(maskOf('Honor')), 'Original Shard')
  for (let mask = 1; mask <= ALL_MASK; mask++) {
    if (constituents(mask).length < 2 || resolveName(mask).kind === 'canon') continue
    assert.equal(classification(mask), null)
    assert.doesNotMatch(resolveName(mask).note, /fan conjecture/i)
  }
  assert.match(resolveName(ALL_MASK).note, /not known to restore/)
})
