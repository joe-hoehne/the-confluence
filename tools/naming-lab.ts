import { ALL_MASK, NAMING_CONCEPTS, NAMING_OVERRIDES, NAMING_PROFILES, SHARDS, assertMask, constituents, maskOf, resolveBaselineName as resolveName } from '../src/engine.ts'
import type { ShardName } from '../src/engine.ts'
import { EXPANSION } from './naming-expansion.ts'

export const LAB_VERSION = 'naming-lab-3'
export const AXES = ['agency', 'attachment', 'creation', 'change', 'compassion', 'order', 'passion', 'freedom'] as const
export type Strategy = 'baseline' | 'contrast' | 'relationships' | 'relationships-v2' | 'relationships-v3' | 'intent-contrast' | 'relationships-v4' | 'intent-guard' | 'relationships-v5' | 'relationships-v6'
export const RECOMMENDED_STRATEGY: Strategy = 'relationships-v5'
export const CONCENTRATION_TARGET = 0.12815
export const V5_SCORING = { intentWeight: 0.35, minimumAnchorSupport: 0.75, relationshipBonus: 0.4 } as const
export const V6_SCORING = { ...V5_SCORING, setCoverageWeight: 0.35 } as const
export type Candidate = {
  name: string
  profile: readonly number[]
  anchors: readonly number[]
  provenance: 'existing-engine' | 'oewn-2025-headword'
  approval: 'existing-content-new-scoring-unreviewed' | 'pending-editorial'
  rationale: string
}
export function countBits(mask: number): number {
  let count = 0
  for (let value = mask; value; value &= value - 1) count++
  return count
}

// Design hypotheses only: neither these annotations nor experimental output is app content.
const relations: readonly (readonly [string, readonly ShardName[], string])[] = [
  ['Defiance', ['Autonomy', 'Dominion'], 'Independence in tension with external authority.'],
  ['Reconciliation', ['Mercy', 'Odium'], 'Compassion in tension with hatred.'],
  ['Sacrifice', ['Devotion', 'Ruin'], 'Giving oneself through an ending.'],
  ['Stewardship', ['Cultivation', 'Dominion'], 'Authority directed toward nurturing.'],
  ['Equilibrium', ['Preservation', 'Ruin'], 'Opposed continuity and ending; not automatically Harmony in a larger set.'],
  ['Judgment', ['Honor', 'Reason'], 'Obligation interpreted through understanding.'],
  ['Resolve', ['Honor', 'Valor'], 'Courage in service of obligation.'],
  ['Wonder', ['Invention', 'Whimsy'], 'Novel creation meeting possibility.'],
  ['Reverence', ['Devotion', 'Honor'], 'Attachment expressed through obligation.'],
  ['Abundance', ['Cultivation', 'Endowment'], 'Nurturing combined with giving.'],
  ['Liberation', ['Autonomy', 'Ruin'], 'An ending that releases independence.'],
  ['Empathy', ['Devotion', 'Mercy'], 'Attachment meeting compassion.'],
]

const lexicalSample: readonly (readonly [string, readonly ShardName[], string])[] = [
  ['Adaptation', ['Cultivation', 'Reason'], 'Nurtured change informed by understanding.'],
  ['Alliance', ['Autonomy', 'Honor'], 'Independence bound by chosen obligations.'],
  ['Dissent', ['Autonomy', 'Odium'], 'Independent opposition intensified by hatred.'],
  ['Excellence', ['Ambition', 'Virtuosity'], 'Aspiration directed toward mastery of artistry.'],
  ['Innovation', ['Invention', 'Cultivation'], 'Novel creation sustained through growth.'],
  ['Justice', ['Honor', 'Mercy', 'Reason'], 'Obligation weighed with compassion and understanding.'],
  ['Reciprocity', ['Devotion', 'Endowment'], 'Giving and attachment as a mutual relationship.'],
  ['Restoration', ['Preservation', 'Cultivation', 'Ruin'], 'An ending followed by growth seeking continuity.'],
  ['Tenacity', ['Ambition', 'Preservation'], 'Aspiration that refuses to relinquish continuity.'],
  ['Transformation', ['Cultivation', 'Ruin', 'Invention'], 'Endings and growth directed toward making the new.'],
  ['Trust', ['Devotion', 'Honor', 'Autonomy'], 'Chosen attachment and obligation without surrendering independence.'],
  ['Emancipation', ['Autonomy', 'Mercy', 'Ruin'], 'Compassionate release through the ending of constraint.'],
]

function averageProfile(mask: number): number[] {
  const size = countBits(mask)
  return AXES.map((_, axis) => NAMING_PROFILES.reduce((sum, profile, index) =>
    sum + ((mask & (1 << index)) ? profile[axis] : 0), 0) / size)
}

export const CANDIDATES: readonly Candidate[] = [
  ...NAMING_CONCEPTS.map(([name, profile]): Candidate => {
    const relation = relations.find(([word]) => word === name)
    return {
      name, profile, anchors: relation ? [maskOf(...relation[1])] : [],
      provenance: 'existing-engine', approval: 'existing-content-new-scoring-unreviewed',
      rationale: relation?.[2] ?? 'Existing eight-axis concept profile; no new relationship interpretation proposed.',
    }
  }),
  ...lexicalSample.map(([name, parts, rationale]): Candidate => {
    const anchor = maskOf(...parts)
    return { name, profile: averageProfile(anchor), anchors: [anchor], provenance: 'oewn-2025-headword', approval: 'pending-editorial', rationale }
  }),
]

export const EXPANDED_CANDIDATES: readonly Candidate[] = [
  ...CANDIDATES,
  ...EXPANSION.map(([name, parts, rationale]): Candidate => {
    const anchor = maskOf(...parts)
    return { name, profile: averageProfile(anchor), anchors: [anchor], provenance: 'oewn-2025-headword', approval: 'pending-editorial', rationale }
  }),
]
export function vocabularyFor(strategy: Strategy): readonly Candidate[] {
  if (['relationships-v3', 'intent-contrast', 'relationships-v4', 'intent-guard', 'relationships-v5', 'relationships-v6'].includes(strategy)) return EXPANDED_CANDIDATES
  if (strategy === 'contrast' || strategy === 'baseline') return CANDIDATES.filter(candidate => candidate.provenance === 'existing-engine')
  return CANDIDATES
}

const center = averageProfile(ALL_MASK)
const spread = AXES.map((_, axis) => Math.sqrt(NAMING_PROFILES.reduce((sum, profile) =>
  sum + (profile[axis] - center[axis]) ** 2, 0) / SHARDS.length))
function contrast(profile: readonly number[]): number[] {
  return profile.map((value, axis) => (value - center[axis]) / spread[axis])
}
function cosine(left: readonly number[], right: readonly number[]): number {
  const norm = Math.hypot(...left) * Math.hypot(...right)
  return norm === 0 ? 0 : left.reduce((sum, value, axis) => sum + value * right[axis], 0) / norm
}
const prepared = CANDIDATES.map(candidate => ({ ...candidate, contrast: contrast(candidate.profile) }))
const expandedPrepared = EXPANDED_CANDIDATES.map(candidate => ({ ...candidate, contrast: contrast(candidate.profile) }))

type PreparedCandidate = typeof prepared[number]
export type CandidateScore = {
  name: string
  eligible: boolean
  score: number
  axisSimilarity: number
  intentSimilarity: number | null
  intentWeight: number
  relationshipBonus: number
  anchorSupport: number | null
  setCoverage: number | null
  coverageBonus: number
}
function scoringPool(strategy: Strategy): readonly PreparedCandidate[] {
  return ['relationships-v3', 'intent-contrast', 'relationships-v4', 'intent-guard', 'relationships-v5', 'relationships-v6'].includes(strategy)
    ? expandedPrepared : prepared
}
function scoreCandidate(mask: number, strategy: Strategy, aggregate: readonly number[], candidate: PreparedCandidate): CandidateScore {
  const size = countBits(mask)
  const guarded = strategy === 'relationships-v4' || strategy === 'intent-guard' || strategy === 'relationships-v5' || strategy === 'relationships-v6'
  const anchorSupport = candidate.anchors.length
    ? Math.max(...candidate.anchors.map(anchor => countBits(mask & anchor) / countBits(anchor))) : null
  const eligible = !(strategy === 'contrast' && candidate.provenance !== 'existing-engine') &&
    !(guarded && candidate.anchors.length && !candidate.anchors.some(anchor =>
      countBits(mask & anchor) >= Math.ceil(V5_SCORING.minimumAnchorSupport * countBits(anchor)))) &&
    !(strategy === 'intent-contrast' && !candidate.anchors.length)
  const axisSimilarity = cosine(aggregate, candidate.contrast)
  const setCoverage = candidate.anchors.length ? Math.max(...candidate.anchors.map(anchor => countBits(mask & anchor) / size)) : null
  let score = axisSimilarity
  let intentSimilarity: number | null = null
  let intentWeight = 0
  if (strategy === 'intent-contrast' || strategy === 'intent-guard' || strategy === 'relationships-v5' || strategy === 'relationships-v6') {
    intentSimilarity = candidate.anchors.length ? Math.max(...candidate.anchors.map(anchor => {
      const anchorSize = countBits(anchor)
      return (countBits(mask & anchor) - size * anchorSize / SHARDS.length) /
        Math.sqrt(size * (1 - size / SHARDS.length) * anchorSize * (1 - anchorSize / SHARDS.length))
    })) : 0
    intentWeight = strategy === 'relationships-v5' || strategy === 'relationships-v6' ? V5_SCORING.intentWeight : 0.6
    score = intentWeight * intentSimilarity + (1 - intentWeight) * score
  }
  let relationshipBonus = 0
  if (strategy !== 'contrast' && candidate.anchors.length) {
    const evidence = Math.max(...candidate.anchors.map(anchor => {
      const coverage = countBits(mask & anchor) / countBits(anchor)
      return coverage === 1 ? 1 : coverage - 1
    }))
    relationshipBonus = V5_SCORING.relationshipBonus * evidence * (strategy === 'relationships' ? 1 : 2 / size)
    score += relationshipBonus
  }
  const coverageBonus = strategy === 'relationships-v6' ? V6_SCORING.setCoverageWeight * (setCoverage ?? 0) : 0
  score += coverageBonus
  return { name: candidate.name, eligible, score, axisSimilarity, intentSimilarity, intentWeight, relationshipBonus, anchorSupport, setCoverage, coverageBonus }
}

export function explainName(mask: number, strategy: Strategy) {
  assertMask(mask)
  const result = resolveExperimental(mask, strategy)
  const selection = countBits(mask) === 1 ? 'singleton' : NAMING_OVERRIDES.has(mask) ? 'curated'
    : strategy !== 'baseline' && strategy !== 'contrast' && strategy !== 'relationships' &&
      vocabularyFor(strategy).some(candidate => candidate.anchors.includes(mask)) ? 'provisional-exact-anchor' : 'scored'
  if (selection !== 'scored') return { mask, strategy, result, selection, aggregate: averageProfile(mask), ranked: [] as CandidateScore[] }
  if (strategy === 'baseline') {
    const aggregate = averageProfile(mask).map(value => value * countBits(mask))
    const ranked = NAMING_CONCEPTS.map(([name, profile]): CandidateScore => ({
      name, eligible: true, score: cosine(aggregate, profile), axisSimilarity: cosine(aggregate, profile),
      intentSimilarity: null, intentWeight: 0, relationshipBonus: 0, anchorSupport: null,
      setCoverage: null, coverageBonus: 0,
    })).sort((left, right) => right.score - left.score)
    return { mask, strategy, result, selection, aggregate, ranked }
  }
  const aggregate = contrast(averageProfile(mask))
  const ranked = scoringPool(strategy).map(candidate => scoreCandidate(mask, strategy, aggregate, candidate))
    .sort((left, right) => Number(right.eligible) - Number(left.eligible) || right.score - left.score ||
      (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
  return { mask, strategy, result, selection, aggregate, ranked }
}

export type LabResult = {
  mask: number
  name: string
  kind: 'canon' | 'gameplay' | 'speculative'
  approval: 'existing-exact' | Candidate['approval']
  evidence: string
  margin: number | null
}
export function resolveExperimental(mask: number, strategy: Strategy = 'relationships'): LabResult {
  assertMask(mask)
  const original = resolveName(mask)
  if (strategy === 'baseline' || countBits(mask) === 1 || NAMING_OVERRIDES.has(mask)) {
    return { mask, name: original.name, kind: original.kind, approval: 'existing-exact', evidence: original.note, margin: null }
  }
  if (strategy !== 'contrast' && strategy !== 'relationships') {
    const exactAnchor = vocabularyFor(strategy).find(candidate => candidate.anchors.includes(mask))
    if (exactAnchor) return {
      mask, name: exactAnchor.name, kind: 'gameplay', approval: exactAnchor.approval,
      evidence: `Exact unapproved design-hypothesis anchor. ${exactAnchor.rationale} ${original.note}`.trim(),
      margin: null,
    }
  }
  const aggregate = contrast(averageProfile(mask))
  let best: typeof prepared[number] | undefined
  let bestScore = -Infinity
  let second = -Infinity
  for (const candidate of scoringPool(strategy)) {
    const scored = scoreCandidate(mask, strategy, aggregate, candidate)
    if (!scored.eligible) continue
    const score = scored.score
    if (score > bestScore || (score === bestScore && best && candidate.name < best.name)) {
      second = bestScore
      bestScore = score
      best = candidate
    } else if (score > second) second = score
  }
  if (!best) throw new Error('No experimental vocabulary candidates are available.')
  return {
    mask, name: best.name, kind: 'gameplay', approval: best.approval,
    evidence: `${best.rationale} Present proposed anchor Intents: ${best.anchors.map(anchor => (anchor & mask) ? constituents(anchor & mask).map(part => part.name).join('+') : 'none').join(', ') || 'no explicit anchor; profile-only interpretation'}. Missing proposed anchor Intents: ${best.anchors.filter(anchor => anchor & ~mask).map(anchor => constituents(anchor & ~mask).map(part => part.name).join('+')).join(', ') || 'none'}. All original Intents remain in the identity mask; this label is not a claim to explain each of them. ${original.note}`.trim(),
    margin: bestScore - second,
  }
}

export type Frequency = { name: string; count: number }
function frequencies(names: readonly string[]): Frequency[] {
  const counts = new Map<string, number>()
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1)
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}
export function evaluate(strategy: Strategy) {
  const results: LabResult[] = []
  for (let mask = 1; mask <= ALL_MASK; mask++) if (countBits(mask) > 1) results.push(resolveExperimental(mask, strategy))
  const global = frequencies(results.map(result => result.name))
  const perSize = Array.from({ length: 15 }, (_, index) => {
    const size = index + 2
    const subset = results.filter(result => countBits(result.mask) === size)
    const counts = frequencies(subset.map(result => result.name))
    return { size, sets: subset.length, names: counts.length, frequencies: counts, dominant: counts[0], dominance: counts[0].count / subset.length }
  })
  const vocabulary = vocabularyFor(strategy)
  const used = new Set(global.map(item => item.name))
  const unused = vocabulary.filter(candidate => !used.has(candidate.name)).map(candidate => candidate.name)
  const selectedAnchors = results.flatMap(result => {
    if (NAMING_OVERRIDES.has(result.mask)) return []
    const candidate = vocabulary.find(entry => entry.name === result.name)
    if (!candidate?.anchors.length) return []
    return [Math.max(...candidate.anchors.map(anchor => countBits(anchor & result.mask) / countBits(anchor)))]
  })
  const collisionSamples: { name: string; left: number; right: number; jaccard: number; contrastCosine: number }[] = []
  let disjointCollisions = 0
  let opposingProfileCollisions = 0
  let complementCollisions = 0
  for (let mask = 1; mask < ALL_MASK; mask++) {
    const complement = ALL_MASK ^ mask
    if (mask >= complement || countBits(mask) < 2 || countBits(complement) < 2) continue
    if (resolveExperimental(mask, strategy).name === resolveExperimental(complement, strategy).name) complementCollisions++
  }
  const pairs = results.filter(result => countBits(result.mask) === 2)
  for (let i = 0; i < pairs.length; i++) for (let j = i + 1; j < pairs.length; j++) {
    if (pairs[i].name !== pairs[j].name || (pairs[i].mask & pairs[j].mask)) continue
    disjointCollisions++
    const contrastCosine = cosine(contrast(averageProfile(pairs[i].mask)), contrast(averageProfile(pairs[j].mask)))
    if (contrastCosine <= 0) opposingProfileCollisions++
    if (collisionSamples.length < 12) collisionSamples.push({ name: pairs[i].name, left: pairs[i].mask, right: pairs[j].mask, jaccard: 0, contrastCosine })
  }
  return {
    strategy, total: results.length, names: global.length, global, perSize, unused,
    topSixCount: global.slice(0, 6).reduce((sum, entry) => sum + entry.count, 0),
    topSixShare: global.slice(0, 6).reduce((sum, entry) => sum + entry.count, 0) / results.length,
    anchoredResultCount: selectedAnchors.length,
    unsupportedAnchorCount: selectedAnchors.filter(support => support < V5_SCORING.minimumAnchorSupport).length,
    entropyBits: -global.reduce((sum, entry) => sum + entry.count / results.length * Math.log2(entry.count / results.length), 0),
    disjointPairCollisions: disjointCollisions, opposingProfilePairCollisions: opposingProfileCollisions, complementCollisions, collisionSamples,
    lowMarginCount: results.filter(result => result.margin !== null && result.margin < 0.05).length,
  }
}

export function generateLookup(strategy: Strategy): string {
  return JSON.stringify({
    schema: 1, version: LAB_VERSION, strategy, approval: 'research-only-do-not-ship',
    scoring: strategy === 'relationships-v6' ? V6_SCORING : V5_SCORING,
    shardOrder: SHARDS.map(shard => shard.name),
    vocabulary: vocabularyFor(strategy),
    entries: Array.from({ length: ALL_MASK }, (_, index) => {
      const { mask, name, kind, approval } = resolveExperimental(index + 1, strategy)
      return { mask, name, kind, approval }
    }),
  }) + '\n'
}

export function pairProposals(strategy: Strategy = RECOMMENDED_STRATEGY) {
  const rows: { mask: number; parts: string[]; baseline: string; proposed: LabResult; status: string }[] = []
  for (let i = 0; i < SHARDS.length; i++) for (let j = i + 1; j < SHARDS.length; j++) {
    const mask = (1 << i) | (1 << j)
    const override = NAMING_OVERRIDES.get(mask)
    rows.push({
      mask, parts: constituents(mask).map(part => part.name), baseline: resolveName(mask).name,
      proposed: resolveExperimental(mask, strategy),
      status: override?.kind === 'canon' ? 'canon-exact' : override ? 'existing-authored-seed' : 'pending-editorial',
    })
  }
  return rows
}

export function evaluateHalves(strategy: Strategy) {
  const partitions: { left: number; right: number; leftName: string; rightName: string }[] = []
  for (let left = 1; left <= ALL_MASK; left++) {
    const right = ALL_MASK ^ left
    if (left >= right || countBits(left) !== 8) continue
    partitions.push({ left, right, leftName: resolveExperimental(left, strategy).name, rightName: resolveExperimental(right, strategy).name })
  }
  return {
    strategy, partitions: partitions.length,
    sameLabel: partitions.filter(pair => pair.leftName === pair.rightName).length,
    distinctLabelPairs: new Set(partitions.map(pair => [pair.leftName, pair.rightName].sort().join('+'))).size,
    rows: partitions,
  }
}
