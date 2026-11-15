import { resolveV5Concept } from './naming-v5.ts'
export { NAMING_METADATA, NAMING_VERSION } from './naming-v5.ts'

export const SHARDS = [
  { name: 'Ambition', color: '#ed9974', intent: 'To reach beyond', symbol: 'ascend' },
  { name: 'Autonomy', color: '#f6c46f', intent: 'To be your own', symbol: 'sun' },
  { name: 'Cultivation', color: '#8ad9aa', intent: 'To nurture change', symbol: 'leaf' },
  { name: 'Devotion', color: '#ed96c0', intent: 'To give yourself', symbol: 'heart' },
  { name: 'Dominion', color: '#a3a0f4', intent: 'To hold authority', symbol: 'crown' },
  { name: 'Endowment', color: '#d2a2ed', intent: 'To bestow a gift', symbol: 'star' },
  { name: 'Honor', color: '#82c9ef', intent: 'To bind by oath', symbol: 'shield' },
  { name: 'Invention', color: '#91e2dc', intent: 'To make the new', symbol: 'spark' },
  { name: 'Mercy', color: '#c5d7ed', intent: 'To offer compassion', symbol: 'wing' },
  { name: 'Odium', color: '#f08576', intent: 'To burn with hatred', symbol: 'flame' },
  { name: 'Preservation', color: '#e5d8a9', intent: 'To keep what is', symbol: 'diamond' },
  { name: 'Reason', color: '#abc6d5', intent: 'To seek understanding', symbol: 'eye' },
  { name: 'Ruin', color: '#ba9cac', intent: 'To bring an end', symbol: 'fracture' },
  { name: 'Valor', color: '#e6b88c', intent: 'To act with courage', symbol: 'sword' },
  { name: 'Virtuosity', color: '#c2b4f5', intent: 'To pursue artistry', symbol: 'lyre' },
  { name: 'Whimsy', color: '#e8b7e0', intent: 'To follow possibility', symbol: 'spiral' },
] as const

export type ShardName = typeof SHARDS[number]['name']
export const ALL_MASK = (1 << SHARDS.length) - 1
export const STORAGE_KEY = 'shards-observatory-v1'
export const SPOILER_KEY = 'shards-spoilers-accepted-v1'

export function maskOf(...names: ShardName[]): number {
  return names.reduce((mask, name) => mask | (1 << SHARDS.findIndex(shard => shard.name === name)), 0)
}

export function constituents(mask: number) {
  assertMask(mask)
  return SHARDS.filter((_, index) => mask & (1 << index))
}

export function assertMask(mask: number): void {
  if (!Number.isInteger(mask) || mask < 1 || mask > ALL_MASK) {
    throw new Error('A shard identity must contain between one and sixteen original Intents.')
  }
}

type NameEntry = { name: string; kind: 'canon' | 'gameplay' | 'speculative'; note: string }
const curated = new Map<number, NameEntry>([
  [maskOf('Preservation', 'Ruin'), { name: 'Harmony', kind: 'canon', note: 'The canonical union of Preservation and Ruin. Discord is an alternate possible expression of these same Intents, not a separate base Shard.' }],
  [maskOf('Honor', 'Odium'), { name: 'Retribution', kind: 'canon', note: 'The canonical union of Honor and Odium. Contains major recent Cosmere spoilers.' }],
  [maskOf('Honor', 'Preservation'), { name: 'Constancy', kind: 'gameplay', note: 'Continuing fidelity and resistance to change.' }],
  [maskOf('Cultivation', 'Ruin'), { name: 'Renewal', kind: 'gameplay', note: 'Growth through endings.' }],
  [maskOf('Endowment', 'Mercy'), { name: 'Grace', kind: 'gameplay', note: 'A gift of compassion.' }],
  [maskOf('Autonomy', 'Dominion'), { name: 'Sovereignty', kind: 'gameplay', note: 'Independence and authority.' }],
  [maskOf('Cultivation', 'Preservation'), { name: 'Symbiosis', kind: 'gameplay', note: 'Growth held in balance.' }],
  [maskOf('Invention', 'Virtuosity'), { name: 'Inspiration', kind: 'gameplay', note: 'Creation meeting artistry.' }],
  [maskOf('Cultivation', 'Honor', 'Odium'), { name: 'Reformation', kind: 'gameplay', note: 'Deliberate change governed by obligations and punitive conviction.' }],
  [maskOf('Cultivation', 'Honor', 'Odium', 'Ruin'), { name: 'Revolution', kind: 'gameplay', note: 'Dismantling an order to impose a transformed one.' }],
  [maskOf('Devotion', 'Odium'), { name: 'Fervor', kind: 'gameplay', note: 'Devotion and hatred meeting in consuming intensity.' }],
  [maskOf('Honor', 'Mercy'), { name: 'Clemency', kind: 'gameplay', note: 'Obligation tempered by compassion.' }],
  [maskOf('Honor', 'Mercy', 'Valor'), { name: 'Chivalry', kind: 'gameplay', note: 'Courage, compassion, and obligation acting together.' }],
  [ALL_MASK, { name: 'Adonalsium', kind: 'speculative', note: 'Reuniting all sixteen Shards is not known to restore Adonalsium, the original being.' }],
])

// Profiles: agency, attachment, creation, change, compassion, order, passion, freedom.
const profiles = [
  [3, 0, 1, 2, 0, 0, 3, 2],
  [3, 0, 0, 1, 0, 1, 1, 3],
  [0, 1, 3, 3, 2, 1, 0, 1],
  [0, 3, 0, 0, 3, 1, 2, 0],
  [3, 2, 0, 0, 0, 3, 1, 0],
  [0, 1, 2, 1, 3, 0, 1, 2],
  [1, 3, 0, 0, 1, 3, 1, 0],
  [1, 0, 3, 3, 0, 1, 1, 2],
  [0, 1, 0, 1, 3, 0, 1, 1],
  [2, 1, 0, 2, 0, 0, 3, 1],
  [0, 2, 0, 0, 2, 3, 0, 0],
  [1, 0, 1, 1, 1, 3, 0, 1],
  [1, 0, 0, 3, 0, 0, 1, 2],
  [2, 2, 0, 1, 1, 1, 3, 1],
  [1, 1, 3, 1, 0, 1, 2, 2],
  [0, 0, 2, 3, 1, 0, 2, 3],
] as const
const concepts: readonly (readonly [string, readonly number[]])[] = [
  ['Aspiration', [3, 0, 1, 2, 0, 1, 2, 2]],
  ['Liberation', [2, 0, 0, 2, 1, 0, 2, 3]],
  ['Nurture', [0, 2, 2, 2, 3, 1, 0, 1]],
  ['Fidelity', [1, 3, 0, 0, 2, 3, 1, 0]],
  ['Authority', [3, 2, 0, 0, 0, 3, 1, 0]],
  ['Generosity', [0, 1, 2, 1, 3, 0, 1, 2]],
  ['Integrity', [1, 2, 0, 0, 1, 3, 0, 1]],
  ['Ingenuity', [1, 0, 3, 2, 0, 2, 1, 2]],
  ['Compassion', [0, 2, 0, 1, 3, 0, 1, 1]],
  ['Fervor', [2, 2, 0, 1, 1, 0, 3, 1]],
  ['Continuity', [0, 2, 1, 1, 2, 3, 0, 0]],
  ['Insight', [1, 0, 2, 1, 1, 3, 0, 1]],
  ['Entropy', [1, 0, 0, 3, 0, 1, 1, 2]],
  ['Fortitude', [2, 2, 0, 0, 1, 2, 3, 1]],
  ['Expression', [1, 1, 3, 1, 1, 0, 2, 3]],
  ['Serendipity', [0, 0, 2, 3, 1, 0, 2, 3]],
  ['Transcendence', [2, 0, 2, 2, 1, 1, 2, 2]],
  ['Unity', [1, 3, 1, 1, 2, 2, 1, 0]],
  ['Stewardship', [1, 2, 2, 1, 2, 3, 0, 0]],
  ['Defiance', [3, 0, 0, 2, 0, 1, 3, 2]],
  ['Sacrifice', [0, 3, 0, 2, 2, 1, 2, 0]],
  ['Judgment', [2, 1, 0, 1, 0, 3, 2, 0]],
  ['Abundance', [1, 1, 3, 2, 3, 0, 1, 1]],
  ['Resilience', [1, 1, 0, 2, 1, 2, 2, 1]],
  ['Evolution', [1, 0, 2, 3, 1, 1, 0, 2]],
  ['Wonder', [0, 1, 2, 2, 1, 1, 2, 2]],
  ['Equilibrium', [1, 1, 0, 1, 1, 2, 1, 1]],
  ['Purpose', [2, 2, 1, 1, 1, 2, 2, 1]],
  ['Reconciliation', [0, 2, 0, 2, 3, 2, 1, 0]],
  ['Concord', [1, 2, 1, 1, 2, 2, 1, 1]],
  ['Diligence', [2, 1, 2, 1, 1, 3, 1, 0]],
  ['Audacity', [3, 0, 2, 2, 0, 0, 3, 2]],
  ['Empathy', [0, 2, 1, 1, 3, 1, 2, 1]],
  ['Possibility', [1, 0, 3, 3, 1, 0, 1, 3]],
  ['Resolve', [2, 2, 0, 1, 0, 3, 2, 1]],
  ['Temperance', [0, 1, 0, 1, 2, 3, 1, 1]],
  ['Vigilance', [2, 2, 0, 0, 1, 3, 2, 0]],
  ['Destiny', [2, 1, 2, 2, 1, 2, 1, 1]],
  ['Reverence', [0, 3, 1, 0, 2, 2, 2, 0]],
  ['Interdependence', [1, 2, 1, 2, 1, 1, 1, 1]],
]

export const NAMING_PROFILES: readonly (readonly number[])[] = profiles
export const NAMING_CONCEPTS = concepts
export const NAMING_OVERRIDES: ReadonlyMap<number, Readonly<NameEntry>> = curated

function compositionalConcept(mask: number): string {
  const aggregate = Array<number>(8).fill(0)
  profiles.forEach((profile, index) => {
    if (mask & (1 << index)) profile.forEach((value, axis) => { aggregate[axis] += value })
  })
  const magnitude = Math.hypot(...aggregate)
  let best = concepts[0][0]
  let bestScore = -Infinity
  for (const [name, profile] of concepts) {
    const score = profile.reduce((sum, value, axis) => sum + value * aggregate[axis], 0) / (Math.hypot(...profile) * magnitude)
    if (score > bestScore) { bestScore = score; best = name }
  }
  return best
}

function resolveWith(mask: number, concept: (mask: number) => string): NameEntry {
  const parts = constituents(mask)
  if (parts.length === 1) return { name: parts[0].name, kind: 'canon', note: parts[0].intent }
  const entry = curated.get(mask)
  if (entry) return entry
  return {
    name: concept(mask),
    kind: 'gameplay',
    note: mask === maskOf('Devotion', 'Dominion')
      ? 'The Dor is intermingled Splintered Investiture of Devotion and Dominion, not an intact single-Vessel merger. This confluence is a gameplay combination, not a claim about the Dor.'
      : '',
  }
}

export function resolveName(mask: number): NameEntry {
  return resolveWith(mask, resolveV5Concept)
}

export function resolveBaselineName(mask: number): NameEntry {
  return resolveWith(mask, compositionalConcept)
}

export function classification(mask: number): string | null {
  if (constituents(mask).length === 1) return 'Original Shard'
  const kind = resolveName(mask).kind
  return kind === 'canon' ? 'Canon merger' : null
}

export type Ancestry = {
  readonly mask: number
  readonly parents: readonly [Ancestry, Ancestry] | null
}
export type Orb = { id: string; lineage: Ancestry; x: number; y: number }
export type Discovery = { mask: number; lineage: Ancestry; paths: readonly Ancestry[]; discoveredAt: string }
export type GameState = { version: 1; nextId: number; orbs: Orb[]; discoveries: Discovery[]; fusions: number }

export function emptyState(): GameState {
  return { version: 1, nextId: 1, orbs: [], discoveries: [], fusions: 0 }
}

export function lineageSignature(lineage: Ancestry): string {
  if (!lineage.parents) return String(lineage.mask)
  return `${lineage.mask}(${lineage.parents.map(lineageSignature).sort().join('|')})`
}

export function leaf(mask: number): Ancestry {
  if (constituents(mask).length !== 1) throw new Error('Only original Shards can be introduced from the source library.')
  return Object.freeze({ mask, parents: null })
}

export function combine(left: Ancestry, right: Ancestry): Ancestry {
  assertMask(left.mask)
  assertMask(right.mask)
  const overlap = left.mask & right.mask
  if (overlap) {
    throw new Error(`These Shards share ${constituents(overlap).map(part => part.name).join(', ')}. Each original Intent may appear only once in a fusion.`)
  }
  return Object.freeze({ mask: left.mask | right.mask, parents: Object.freeze([left, right] as const) })
}

export function position(x: number, y: number) {
  return { x: Math.max(0.09, Math.min(0.91, x)), y: Math.max(0.15, Math.min(0.85, y)) }
}

export function openPosition(orbs: readonly Orb[]) {
  const candidates = [
    { x: .5, y: .44 }, { x: .24, y: .44 }, { x: .76, y: .44 },
    { x: .5, y: .72 }, { x: .5, y: .2 }, { x: .24, y: .72 },
    { x: .76, y: .72 }, { x: .24, y: .2 }, { x: .76, y: .2 },
  ]
  const clearance = (candidate: { x: number; y: number }) => Math.min(...orbs.map(orb => Math.hypot(orb.x - candidate.x, orb.y - candidate.y)))
  return candidates.find(candidate => clearance(candidate) >= .22)
    ?? candidates.reduce((best, candidate) => clearance(candidate) > clearance(best) ? candidate : best)
}

export function addOrb(state: GameState, lineage: Ancestry, x: number, y: number): GameState {
  return {
    ...state,
    nextId: state.nextId + 1,
    orbs: [...state.orbs, { id: `s${state.nextId}`, lineage, ...position(x, y) }],
  }
}

export function fuseOrbs(state: GameState, source: string | Ancestry, targetId: string, now = new Date().toISOString()): { state: GameState; result: Orb; isNew: boolean } {
  const target = state.orbs.find(orb => orb.id === targetId)
  if (!target) throw new Error('The target Shard is no longer on the canvas.')
  const sourceOrb = typeof source === 'string' ? state.orbs.find(orb => orb.id === source) : null
  if (typeof source === 'string' && !sourceOrb) throw new Error('The source Shard is no longer on the canvas.')
  const sourceLineage = typeof source === 'string' ? sourceOrb!.lineage : source
  const lineage = combine(sourceLineage, target.lineage)
  const result: Orb = { id: `s${state.nextId}`, lineage, x: target.x, y: target.y }
  const isNew = !state.discoveries.some(discovery => discovery.mask === lineage.mask)
  const signature = lineageSignature(lineage)
  const discoveries = isNew
    ? [...state.discoveries, { mask: lineage.mask, lineage, paths: [lineage], discoveredAt: now }]
    : state.discoveries.map(discovery => {
      const paths = discovery.paths ?? [discovery.lineage]
      return discovery.mask === lineage.mask && !paths.some(path => lineageSignature(path) === signature)
        ? { ...discovery, paths: [...paths, lineage] } : { ...discovery, paths }
    })
  return {
    state: {
      ...state,
      nextId: state.nextId + 1,
      orbs: [...state.orbs.filter(orb => orb.id !== targetId && orb.id !== sourceOrb?.id), result],
      fusions: state.fusions + 1,
      discoveries,
    },
    result,
    isNew,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readLineage(value: unknown, depth = 0): Ancestry {
  if (!isRecord(value) || typeof value.mask !== 'number' || depth > 15) throw new Error('Invalid saved ancestry.')
  assertMask(value.mask)
  if (value.parents === null) return leaf(value.mask)
  if (!Array.isArray(value.parents) || value.parents.length !== 2) throw new Error('Invalid saved parents.')
  const left = readLineage(value.parents[0], depth + 1)
  const right = readLineage(value.parents[1], depth + 1)
  const joined = combine(left, right)
  if (joined.mask !== value.mask) throw new Error('Saved ancestry does not match its original Intents.')
  return joined
}

export function decodeState(serialized: string): GameState {
  const value: unknown = JSON.parse(serialized)
  if (!isRecord(value) || value.version !== 1 || !Number.isSafeInteger(value.nextId) || Number(value.nextId) < 1 ||
    !Number.isSafeInteger(value.fusions) || Number(value.fusions) < 0 || !Array.isArray(value.orbs) || !Array.isArray(value.discoveries)) {
    throw new Error('This save is not a supported Shards workspace.')
  }
  const ids = new Set<string>()
  const orbs = value.orbs.map((item: unknown): Orb => {
    if (!isRecord(item) || typeof item.id !== 'string' || !/^s[1-9]\d*$/.test(item.id) || ids.has(item.id) ||
      Number(item.id.slice(1)) >= Number(value.nextId) || typeof item.x !== 'number' || typeof item.y !== 'number' ||
      !Number.isFinite(item.x) || !Number.isFinite(item.y)) throw new Error('Invalid saved canvas Shard.')
    ids.add(item.id)
    return { id: item.id, lineage: readLineage(item.lineage), ...position(item.x, item.y) }
  })
  const masks = new Set<number>()
  const discoveries = value.discoveries.map((item: unknown): Discovery => {
    if (!isRecord(item) || typeof item.mask !== 'number' || typeof item.discoveredAt !== 'string' ||
      !Number.isFinite(Date.parse(item.discoveredAt)) || masks.has(item.mask)) throw new Error('Invalid saved discovery.')
    const lineage = readLineage(item.lineage)
    if (lineage.mask !== item.mask || constituents(item.mask).length < 2) throw new Error('Invalid discovery identity.')
    const paths = item.paths === undefined ? [lineage] : (() => {
      if (!Array.isArray(item.paths) || !item.paths.length) throw new Error('Invalid saved combination paths.')
      const read = item.paths.map(path => readLineage(path))
      const signatures = read.map(lineageSignature)
      if (read.some(path => path.mask !== item.mask) || new Set(signatures).size !== read.length ||
        signatures[0] !== lineageSignature(lineage)) throw new Error('Saved combination paths do not match their discovery.')
      return read
    })()
    masks.add(item.mask)
    return { mask: item.mask, lineage, paths, discoveredAt: item.discoveredAt }
  })
  return { version: 1, nextId: Number(value.nextId), fusions: Number(value.fusions), orbs, discoveries }
}
