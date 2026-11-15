import { constituents, lineageSignature } from './engine.ts'
import type { Ancestry, Discovery, Orb } from './engine'

export type ConstellationNode = { mask: number; x: number; y: number; paths: Ancestry[]; discovered: boolean }
export type ConstellationEdge = { parent: number; child: number }
export type Constellation = { nodes: ConstellationNode[]; byMask: Map<number, ConstellationNode>; edges: ConstellationEdge[] }

export function historyEdges(lineage: Ancestry): ConstellationEdge[] {
  const edges = new Map<string, ConstellationEdge>()
  function visit(tree: Ancestry) {
    tree.parents?.forEach(parent => {
      edges.set(`${parent.mask}:${tree.mask}`, { parent: parent.mask, child: tree.mask })
      visit(parent)
    })
  }
  visit(lineage)
  return [...edges.values()]
}

export function historyMasks(lineage: Ancestry): Set<number> {
  return new Set([lineage.mask, ...historyEdges(lineage).map(edge => edge.parent)])
}

export function buildConstellation(discoveries: readonly Discovery[], orbs: readonly Orb[] = []): Constellation {
  const byMask = new Map<number, ConstellationNode>()
  const edges = new Map<string, ConstellationEdge>()
  const recorded = new Set(discoveries.map(discovery => discovery.mask))
  function visit(lineage: Ancestry) {
    let node = byMask.get(lineage.mask)
    if (!node) {
      node = { mask: lineage.mask, x: 0, y: 0, paths: [], discovered: recorded.has(lineage.mask) }
      byMask.set(lineage.mask, node)
    }
    const signature = lineageSignature(lineage)
    if (node.paths.some(path => lineageSignature(path) === signature)) return
    node.paths.push(lineage)
    lineage.parents?.forEach(parent => {
      edges.set(`${parent.mask}:${lineage.mask}`, { parent: parent.mask, child: lineage.mask })
      visit(parent)
    })
  }
  discoveries.forEach(discovery => (discovery.paths ?? [discovery.lineage]).forEach(visit))
  orbs.filter(orb => constituents(orb.lineage.mask).length > 1).forEach(orb => visit(orb.lineage))
  const nodes = [...byMask.values()].sort((a, b) => a.mask - b.mask)
  const bands = [1, 3, 7, 16].map((limit, band) => nodes.filter(node => {
    const count = constituents(node.mask).length
    return count <= limit && (band === 0 || count > [1, 3, 7, 16][band - 1])
  }))
  bands.forEach((band, index) => band.forEach((node, i) => {
    const angle = -Math.PI / 2 + i * 2 * Math.PI / band.length + index * .39
    const radius = [.42, .31, .2, .09][index]
    node.x = .5 + Math.cos(angle) * radius
    node.y = .5 + Math.sin(angle) * radius
  }))
  return { nodes, byMask, edges: [...edges.values()] }
}
