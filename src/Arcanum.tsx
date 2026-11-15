import { useMemo, useState } from 'react'
import Crystal from './Crystal'
import HistoryTree from './HistoryTree'
import { classification, constituents, resolveName } from './engine'
import { buildConstellation, historyEdges, historyMasks } from './constellation'
import type { Ancestry, Discovery, Orb } from './engine'
import type { Constellation, ConstellationEdge } from './constellation'
import './Arcanum.css'

function curve(graph: Constellation, edge: ConstellationEdge) {
  const a = graph.byMask.get(edge.parent)!, b = graph.byMask.get(edge.child)!
  const x1 = a.x * 1000, y1 = a.y * 700, x2 = b.x * 1000, y2 = b.y * 700
  return `M${x1},${y1} Q${(x1 + x2) / 2 + (y2 - y1) * .08},${(y1 + y2) / 2 - (x2 - x1) * .08} ${x2},${y2}`
}

function searchText(mask: number) {
  return `${resolveName(mask).name} ${constituents(mask).map(part => part.name).join(' ')}`.toLowerCase()
}

export function ConstellationPreview({ discoveries, orbs, onOpen }: { discoveries: Discovery[]; orbs: Orb[]; onOpen: () => void }) {
  const graph = useMemo(() => buildConstellation(discoveries, orbs), [discoveries, orbs])
  const latest = discoveries.at(-1)?.lineage
  return <button className="constellation-launch" onClick={onOpen} aria-label={`Open Arcanum constellation. ${discoveries.length} discoveries.`}>
    <svg className="constellation-preview" viewBox="0 0 1000 700" aria-hidden="true">
      <ellipse cx="500" cy="350" rx="420" ry="294" /><ellipse cx="500" cy="350" rx="310" ry="217" />
      {latest && historyEdges(latest).map(edge => <path key={`${edge.parent}:${edge.child}`} d={curve(graph, edge)} className="preview-thread" />)}
      {graph.nodes.map(node => <circle key={node.mask} cx={node.x * 1000} cy={node.y * 700} r={node.discovered ? 9 : 5} fill={constituents(node.mask)[0].color} />)}
      {!graph.nodes.length && <path d="M500 305 525 350 500 395 475 350Z" className="unwritten-star" />}
    </svg>
    <span>Open the constellation <span aria-hidden="true">↗</span></span>
  </button>
}

export default function Arcanum({ discoveries, orbs, initialMask, onRecall }: {
  discoveries: Discovery[]
  orbs: Orb[]
  initialMask?: number
  onRecall: (lineage: Ancestry) => void
}) {
  const graph = useMemo(() => buildConstellation(discoveries, orbs), [discoveries, orbs])
  const [selectedMask, setSelectedMask] = useState(initialMask ?? orbs.findLast(orb => orb.lineage.parents)?.lineage.mask ?? discoveries.at(-1)?.mask ?? null)
  const [pathIndex, setPathIndex] = useState(0)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'map' | 'list'>('map')
  const selected = selectedMask === null ? undefined : graph.byMask.get(selectedMask)
  const lineage = selected?.paths[pathIndex] ?? selected?.paths[0]
  const activeMasks = lineage ? historyMasks(lineage) : new Set<number>()
  const labelledMasks = activeMasks.size <= 9 ? activeMasks : new Set(lineage ? [lineage.mask, ...(lineage.parents?.map(parent => parent.mask) ?? [])] : [])
  const edges = lineage ? historyEdges(lineage) : []
  const matching = new Set(graph.nodes.filter(node => searchText(node.mask).includes(query.toLowerCase().trim())).map(node => node.mask))
  const list = graph.nodes.filter(node => matching.has(node.mask)).sort((a, b) =>
    resolveName(a.mask).name.localeCompare(resolveName(b.mask).name) || a.mask - b.mask)
  function select(mask: number) {
    setSelectedMask(mask)
    setPathIndex(0)
  }

  return <section className="arcanum-experience" aria-labelledby="constellation-title">
    <div className="constellation-heading"><span className="micro gold">Powers, connected</span><h2 id="constellation-title">The Arcanum.</h2><p>Every star is a recorded power. Follow the path that brought it into being.</p></div>
    <div className="constellation-toolbar">
      <label className="constellation-search"><span className="sr-only">Search constellation by name or constituent Shard</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a name or constituent Shard…" /></label>
      <div className="constellation-views" role="group" aria-label="Arcanum view"><button aria-pressed={view === 'map'} onClick={() => setView('map')}>Constellation</button><button aria-pressed={view === 'list'} onClick={() => setView('list')}>Compact list</button></div>
    </div>
    {!graph.nodes.length ? <div className="constellation-empty"><span aria-hidden="true">◇</span><h3>Your sky is unwritten.</h3><p>Combine Shards in the well. Your discoveries and their original constituents will become stars here.</p></div> :
      <div className="constellation-layout">
        <div className="constellation-overview">
          <div className="constellation-count micro">{discoveries.length} discoveries <span>/</span> {graph.nodes.length} recorded powers{query && <span> / {matching.size} matches</span>}</div>
          {view === 'map' ? <div className="constellation-map" role="group" aria-label="Recorded powers. Select a star to illuminate its combination history.">
            <svg viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true" className="constellation-geometry">
              {[.42, .31, .2, .09].map(radius => <ellipse key={radius} cx="500" cy="350" rx={radius * 1000} ry={radius * 700} className="constellation-ring" />)}
              <path d="M500 25V675M40 350H960" className="constellation-axis" />
              {edges.map(edge => <path key={`${edge.parent}:${edge.child}`} data-parent-mask={edge.parent} data-child-mask={edge.child} d={curve(graph, edge)} className="lineage-thread" />)}
            </svg>
            <span className="map-coordinates north" aria-hidden="true">I</span><span className="map-coordinates east" aria-hidden="true">II</span><span className="map-coordinates south" aria-hidden="true">III</span><span className="map-coordinates west" aria-hidden="true">IV</span>
            {graph.nodes.map(node => {
              const related = activeMasks.has(node.mask)
              const dimmed = query ? !matching.has(node.mask) : Boolean(lineage && !related)
              const count = constituents(node.mask).length
              return <button key={node.mask} className={`constellation-star ${node.mask === selectedMask ? 'selected' : ''} ${related ? 'related' : ''} ${labelledMasks.has(node.mask) ? 'labelled' : ''} ${dimmed ? 'dimmed' : ''} ${count === 1 ? 'original' : ''}`}
                style={{ left: `${node.x * 100}%`, top: `${node.y * 100}%`, color: constituents(node.mask)[0].color }}
                data-constellation-mask={node.mask} data-side={node.x > .75 ? 'right' : node.x < .25 ? 'left' : 'center'}
                aria-pressed={node.mask === selectedMask}
                aria-label={`${resolveName(node.mask).name}. ${count} constituent ${count === 1 ? 'Shard' : 'Shards'}: ${constituents(node.mask).map(part => part.name).join(', ')}${classification(node.mask) === 'Canon merger' ? '. Canon merger' : ''}. Show combination history.`}
                onClick={() => select(node.mask)}>
                <span className="star-aura" aria-hidden="true" /><Crystal mask={node.mask} className="star-crystal" /><span className="star-name">{resolveName(node.mask).name}</span>
              </button>
            })}
          </div> : <div className="constellation-list" aria-label="Recorded powers list">{list.map(node => <button key={node.mask} className={`constellation-list-entry ${node.mask === selectedMask ? 'selected' : ''}`} onClick={() => select(node.mask)} aria-pressed={node.mask === selectedMask} data-list-mask={node.mask}>
            <Crystal mask={node.mask} /><span><span className="list-name">{resolveName(node.mask).name}</span><span className="list-constituents">{constituents(node.mask).map(part => part.name).join(' + ')}</span></span>{classification(node.mask) === 'Canon merger' && <span className="micro gold">Canon merger</span>}
          </button>)}{!list.length && <p className="constellation-no-matches">No recorded powers match that search.</p>}</div>}
          <p className="constellation-map-note">Only the selected history is connected. Other stars remain available, without a tangle of unrelated routes.</p>
          <div className="constellation-legend"><span><i className="legend-original" />Original Shard</span><span><i className="legend-discovery" />Recorded combination</span><span><i className="legend-lineage" />Selected history</span></div>
        </div>
        {selected && lineage && <aside className="constellation-detail" aria-label="Focused combination history">
          <span className="micro gold">Focused lineage</span><Crystal mask={selected.mask} className="focused-crystal" /><h3>{resolveName(selected.mask).name}</h3>
          {classification(selected.mask) === 'Canon merger' && <span className="lore-badge">Canon merger</span>}
          <p className="focused-constituents">{constituents(selected.mask).map(part => part.name).join(' + ')}</p>
          {resolveName(selected.mask).note && <p className="focused-note">{resolveName(selected.mask).note}</p>}
          <button className="primary recall-star" onClick={() => onRecall(lineage)}>{constituents(selected.mask).length === 1 ? 'Place' : 'Recall'} {resolveName(selected.mask).name} in the well <span aria-hidden="true">↗</span></button>
          <div className="focused-history-heading"><h4>Combination history</h4><span>{selected.paths.length} recorded {selected.paths.length === 1 ? 'route' : 'routes'}</span></div>
          {selected.paths.length > 1 && <label className="route-picker">View recorded route<select aria-label="Recorded combination route" value={pathIndex} onChange={event => setPathIndex(Number(event.target.value))}>{selected.paths.map((path, index) => <option key={index} value={index}>{index + 1}: {path.parents?.map(parent => `${resolveName(parent.mask).name} (${constituents(parent.mask).length})`).join(' + ')}</option>)}</select></label>}
          <div className="focused-history"><ul className="ancestry"><HistoryTree lineage={lineage} /></ul></div>
          <p className="focused-history-note">These are the routes you actually recorded. Alternate routes are remembered when you combine the same constituents another way.</p>
        </aside>}
      </div>}
    <p className="sr-only" role="status" aria-live="polite">{selected && `${resolveName(selected.mask).name} selected. ${constituents(selected.mask).length} constituent Shards. Showing recorded route ${pathIndex + 1} of ${selected.paths.length}.`}</p>
  </section>
}
