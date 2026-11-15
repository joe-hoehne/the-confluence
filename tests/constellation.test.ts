import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addOrb, combine, decodeState, emptyState, fuseOrbs, leaf, lineageSignature, maskOf, resolveName } from '../src/engine.ts'
import { buildConstellation, historyEdges, historyMasks } from '../src/constellation.ts'
import type { Ancestry, Discovery } from '../src/engine.ts'

function discovery(lineage: Ancestry): Discovery {
  return { mask: lineage.mask, lineage, paths: [lineage], discoveredAt: '2026-11-08T00:00:00Z' }
}

test('graph topology consists only of actual recorded parent relationships', () => {
  const honor = leaf(maskOf('Honor')), odium = leaf(maskOf('Odium')), cultivation = leaf(maskOf('Cultivation'))
  const retribution = combine(honor, odium)
  const reformation = combine(retribution, cultivation)
  const graph = buildConstellation([discovery(retribution), discovery(reformation)])
  assert.deepEqual(new Set(graph.nodes.map(node => node.mask)), new Set([honor.mask, odium.mask, cultivation.mask, retribution.mask, reformation.mask]))
  assert.deepEqual(new Set(graph.edges.map(edge => `${edge.parent}:${edge.child}`)), new Set([
    `${honor.mask}:${retribution.mask}`, `${odium.mask}:${retribution.mask}`,
    `${retribution.mask}:${reformation.mask}`, `${cultivation.mask}:${reformation.mask}`,
  ]))
  assert.deepEqual(historyMasks(reformation), new Set(graph.nodes.map(node => node.mask)))
  assert.equal(historyEdges(reformation).length, 4)
  assert.deepEqual(buildConstellation([], [addOrb(emptyState(), honor, .5, .5).orbs[0]]).nodes, [])
  assert.deepEqual(buildConstellation([discovery(reformation), discovery(retribution)]).nodes, graph.nodes)
})

test('same-named combinations remain distinct graph nodes', () => {
  const matches = new Map<string, number>()
  let pair: [number, number] | null = null
  for (let mask = 1; mask < 65536 && !pair; mask++) {
    if ((mask & (mask - 1)) === 0) continue
    const name = resolveName(mask).name
    if (matches.has(name)) pair = [matches.get(name)!, mask]
    else matches.set(name, mask)
  }
  assert.ok(pair)
  const tree = (mask: number): Ancestry => {
    const bits = Array.from({ length: 16 }, (_, i) => 1 << i).filter(bit => mask & bit)
    return bits.slice(1).reduce((lineage, bit) => combine(lineage, leaf(bit)), leaf(bits[0]))
  }
  const graph = buildConstellation(pair.map(mask => discovery(tree(mask))))
  assert.notEqual(pair[0], pair[1])
  assert.equal(resolveName(pair[0]).name, resolveName(pair[1]).name)
  assert.ok(graph.byMask.has(pair[0]))
  assert.ok(graph.byMask.has(pair[1]))
})

test('known alternate routes persist while mirrored operands do not fabricate new paths', () => {
  const honor = leaf(maskOf('Honor')), odium = leaf(maskOf('Odium')), cultivation = leaf(maskOf('Cultivation'))
  const first = combine(combine(honor, odium), cultivation)
  const alternateParent = combine(honor, cultivation)
  const alternate = combine(alternateParent, odium)
  let state = { ...emptyState(), discoveries: [discovery(first)] }
  state = addOrb(state, alternateParent, .3, .4)
  state = addOrb(state, odium, .7, .4)
  state = fuseOrbs(state, state.orbs[0].id, state.orbs[1].id).state
  assert.equal(state.discoveries.length, 1)
  assert.equal(state.discoveries[0].paths.length, 2)
  const mirrored = combine(odium, alternateParent)
  assert.equal(lineageSignature(alternate), lineageSignature(mirrored))
  state = addOrb(state, odium, .3, .4)
  state = addOrb(state, alternateParent, .7, .4)
  state = fuseOrbs(state, state.orbs.at(-2)!.id, state.orbs.at(-1)!.id).state
  assert.equal(state.discoveries[0].paths.length, 2)
  const restored = decodeState(JSON.stringify(state))
  assert.deepEqual(restored, state)
  const graph = buildConstellation(restored.discoveries)
  assert.equal(graph.byMask.get(first.mask)?.paths.length, 2)
  assert.equal(historyEdges(graph.byMask.get(first.mask)!.paths[0]).length, 4)
  assert.ok(graph.byMask.has(alternateParent.mask))
})

test('legacy saves migrate one real path without renaming or losing history', () => {
  const lineage = combine(leaf(maskOf('Honor')), leaf(maskOf('Odium')))
  const legacy = { ...emptyState(), discoveries: [{ mask: lineage.mask, lineage, discoveredAt: '2026-11-08T00:00:00Z' }] }
  const restored = decodeState(JSON.stringify(legacy))
  assert.deepEqual(restored.discoveries[0].paths, [lineage])
  assert.deepEqual(restored.discoveries[0].lineage, lineage)
  assert.equal(restored.discoveries[0].mask, legacy.discoveries[0].mask)
  assert.throws(() => decodeState(JSON.stringify({ ...restored, discoveries: [{ ...restored.discoveries[0], paths: [] }] })), /paths/)
})
