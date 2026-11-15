import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import Crystal from './Crystal'
import Arcanum, { ConstellationPreview } from './Arcanum'
import HistoryTree from './HistoryTree'
import { SHARDS, SPOILER_KEY, STORAGE_KEY, addOrb, classification, constituents, decodeState, emptyState, fuseOrbs, leaf, maskOf, openPosition, position, resolveName } from './engine'
import type { Ancestry, GameState, Orb } from './engine'
import './App.css'

type Choice = { kind: 'source'; mask: number; key: string } | { kind: 'orb'; id: string; key: string }
type Drag = { choice: Choice; startX: number; startY: number; x: number; y: number; active: boolean; pointerId: number; targetKey: string | null }
type ModalState = { kind: 'inspect'; lineage: Ancestry } | { kind: 'arcanum'; mask?: number } | { kind: 'about' } | { kind: 'clear' } | null

function shardStyle(mask: number): CSSProperties {
  return { '--shard-color': constituents(mask)[0].color } as CSSProperties
}

function starterState() {
  return addOrb(addOrb(emptyState(), leaf(maskOf('Honor')), .32, .43), leaf(maskOf('Odium')), .68, .47)
}

function loadWorkspace() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return { state: saved ? decodeState(saved) : starterState(), accepted: localStorage.getItem(SPOILER_KEY) === 'yes', error: '', canSave: true }
  } catch (error) {
    return { state: starterState(), accepted: false, error: `Your saved workspace could not be loaded: ${error instanceof Error ? error.message : String(error)} Your existing save has not been overwritten.`, canSave: false }
  }
}

function Dialog({ children, title, wide = false, onClose }: { children: ReactNode; title: string; wide?: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  return <dialog ref={ref} className={`inspector ${wide ? 'constellation-dialog' : ''}`} aria-label={title} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <button className="close-dialog" onClick={onClose} aria-label="Close dialog" autoFocus>×</button>
    {children}
  </dialog>
}

function App() {
  const [boot] = useState(loadWorkspace)
  const [game, setGame] = useState(boot.state)
  const [accepted, setAccepted] = useState(boot.accepted)
  const [saveError, setSaveError] = useState(boot.error)
  const [canSave, setCanSave] = useState(boot.canSave)
  const [selected, setSelected] = useState<Choice | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [status, setStatus] = useState('Click a source to place it. Drag crystals together, or select two crystals in the well to fuse.')
  const [invalid, setInvalid] = useState(false)
  const [modal, setModal] = useState<ModalState>(null)
  const [reveal, setReveal] = useState<{ orb: Orb; isNew: boolean } | null>(null)
  const [history, setHistory] = useState<Orb[][]>([])
  const [query, setQuery] = useState('')
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'canon' | 'gameplay'>('all')
  const wellRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    if (!accepted || !canSave) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game))
    } catch (error) {
      queueMicrotask(() => {
        setSaveError(`This browser could not save your progress: ${error instanceof Error ? error.message : String(error)}. You can keep playing in this session.`)
        setCanSave(false)
      })
    }
  }, [game, accepted, canSave])

  useEffect(() => {
    if (!reveal) return
    const timer = window.setTimeout(() => setReveal(null), 6500)
    return () => window.clearTimeout(timer)
  }, [reveal])

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dragRef.current = null
        setDrag(null)
        setSelected(null)
        setInvalid(false)
        setStatus('Selection cleared. Choose a Shard to begin.')
      }
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [])

  function announce(message: string, isError = false) {
    setStatus(message)
    setInvalid(isError)
  }

  function lineageOf(choice: Choice, state = game): Ancestry {
    if (choice.kind === 'source') return leaf(choice.mask)
    const orb = state.orbs.find(item => item.id === choice.id)
    if (!orb) throw new Error('This Shard is no longer in the well. Choose another.')
    return orb.lineage
  }

  function checkpoint(state: GameState) {
    setHistory(previous => [...previous.slice(-29), state.orbs])
  }

  function applyFusion(source: Choice, target: Choice) {
    try {
      const current = game
      const sourceTree = lineageOf(source, current)
      let next = current
      let targetId: string
      if (target.kind === 'source') {
        const spot = openPosition(current.orbs.filter(orb => source.kind !== 'orb' || orb.id !== source.id))
        next = addOrb(current, leaf(target.mask), spot.x, spot.y)
        targetId = next.orbs.at(-1)!.id
      } else targetId = target.id
      const fusion = fuseOrbs(next, source.kind === 'orb' ? source.id : sourceTree, targetId)
      checkpoint(current)
      setGame(fusion.state)
      setSelected(null)
      setReveal({ orb: fusion.result, isNew: fusion.isNew })
      const name = resolveName(fusion.result.lineage.mask)
      const canon = classification(fusion.result.lineage.mask)
      announce(`${resolveName(sourceTree.mask).name} + ${resolveName(lineageOf(target, current).mask).name} becomes ${name.name}. ${constituents(fusion.result.lineage.mask).length} constituent Shards.${canon ? ` ${canon}.` : ''}${name.kind === 'speculative' ? ` ${name.note}` : ''} ${fusion.isNew ? 'New discovery inscribed.' : 'Already in your Arcanum.'}`)
      window.requestAnimationFrame(() => document.getElementById(`orb-${fusion.result.id}`)?.focus({ preventScroll: true }))
    } catch (error) {
      announce(error instanceof Error ? error.message : String(error), true)
    }
  }

  function choose(choice: Choice) {
    if (suppressClick.current) { suppressClick.current = false; return }
    if (choice.kind === 'source') {
      place(choice)
      window.requestAnimationFrame(() => {
        const crystal = document.getElementById(`orb-s${game.nextId}`)
        crystal?.focus({ preventScroll: true })
        crystal?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
      return
    }
    if (selected?.key === choice.key) {
      setSelected(null)
      announce('Selection cleared.')
    } else if (selected) applyFusion(selected, choice)
    else {
      setSelected(choice)
      announce(`${resolveName(lineageOf(choice).mask).name} selected. Choose another crystal in the well to fuse, or inspect its combination history. Escape cancels.`)
    }
  }

  function place(choice: Choice, x?: number, y?: number) {
    const current = game
    const spot = x === undefined || y === undefined ? openPosition(current.orbs) : position(x, y)
    checkpoint(current)
    if (choice.kind === 'source') {
      setGame(addOrb(current, leaf(choice.mask), spot.x, spot.y))
      announce(`${resolveName(choice.mask).name} placed in the well. Select two crystals in the well to fuse, or drag one onto another.`)
    } else {
      setGame({ ...current, orbs: current.orbs.map(orb => orb.id === choice.id ? { ...orb, ...spot } : orb) })
    }
    setSelected(null)
  }

  function recall(lineage: Ancestry) {
    const spot = openPosition(game.orbs)
    checkpoint(game)
    setGame(addOrb(game, lineage, spot.x, spot.y))
    setModal(null)
    setSelected(null)
    announce(`${resolveName(lineage.mask).name} placed in the well with its recorded combination history.`)
    window.requestAnimationFrame(() => {
      const crystal = document.getElementById(`orb-s${game.nextId}`)
      crystal?.focus({ preventScroll: true })
      crystal?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  function beginDrag(event: ReactPointerEvent<HTMLButtonElement>, choice: Choice) {
    if (event.button !== 0) return
    suppressClick.current = false
    const next: Drag = { choice, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false, pointerId: event.pointerId, targetKey: null }
    dragRef.current = next
    setDrag(next)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: ReactPointerEvent) {
    const current = dragRef.current
    if (!current || event.pointerId !== current.pointerId) return
    const active = current.active || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 7
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-choice-key]')
    const next = { ...current, active, x: event.clientX, y: event.clientY, targetKey: element?.dataset.choiceKey ?? null }
    dragRef.current = next
    setDrag(next)
  }

  function endDrag(event: ReactPointerEvent) {
    const current = dragRef.current
    if (!current || event.pointerId !== current.pointerId) return
    dragRef.current = null
    setDrag(null)
    if (!current.active) return
    suppressClick.current = true
    window.setTimeout(() => { suppressClick.current = false }, 0)
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-choice-key]')
    const key = element?.dataset.choiceKey
    if (key && key !== current.choice.key) {
      const target: Choice = key.startsWith('source-')
        ? { kind: 'source', mask: Number(key.slice(7)), key }
        : { kind: 'orb', id: key.slice(4), key }
      applyFusion(current.choice, target)
      return
    }
    const bounds = wellRef.current?.getBoundingClientRect()
    if (bounds && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
      place(current.choice, (event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height)
    } else announce('Drop a Shard inside the orbital well or onto another Shard.', true)
  }

  function cancelDrag() {
    dragRef.current = null
    setDrag(null)
    suppressClick.current = true
    window.setTimeout(() => { suppressClick.current = false }, 0)
  }

  function undo() {
    const last = history.at(-1)
    if (!last) return
    setGame({ ...game, orbs: last })
    setHistory(previous => previous.slice(0, -1))
    setSelected(null)
    setReveal(null)
    announce('Last canvas action undone. Your discoveries remain in the Arcanum.')
  }

  function removeFromWell(orb: Orb) {
    const index = game.orbs.findIndex(item => item.id === orb.id)
    const remaining = game.orbs.filter(item => item.id !== orb.id)
    checkpoint(game)
    setGame({ ...game, orbs: remaining })
    if (selected?.kind === 'orb' && selected.id === orb.id) setSelected(null)
    if (reveal?.orb.id === orb.id) setReveal(null)
    announce(`${resolveName(orb.lineage.mask).name} removed from the well. Your Arcanum is unchanged. Undo action restores the crystal.`)
    const next = remaining[index] ?? remaining[index - 1]
    window.requestAnimationFrame(() => {
      if (next) document.getElementById(`orb-${next.id}`)?.focus({ preventScroll: true })
      else wellRef.current?.focus({ preventScroll: true })
    })
  }

  function acceptSpoilers() {
    try { localStorage.setItem(SPOILER_KEY, 'yes') }
    catch (error) {
      setSaveError(`Spoiler consent could not be remembered: ${error instanceof Error ? error.message : String(error)}. This session is still playable.`)
      setCanSave(false)
    }
    setAccepted(true)
  }

  function startFresh() {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setGame(starterState())
      setHistory([])
      setSelected(null)
      setReveal(null)
      setSaveError('')
      setCanSave(true)
      announce('A fresh well awaits.')
    } catch (error) {
      setSaveError(`The old save could not be cleared: ${error instanceof Error ? error.message : String(error)}. Browser storage access is required to start a persistent workspace.`)
    }
  }

  const dragMask = drag?.active ? lineageOf(drag.choice).mask : null
  const selectedTree = selected ? lineageOf(selected) : null
  const visibleDiscoveries = [...game.discoveries].reverse().filter(item => {
    const name = resolveName(item.mask)
    const text = `${name.name} ${constituents(item.mask).map(part => part.name).join(' ')}`
    return text.toLowerCase().includes(query.toLowerCase()) && (archiveFilter === 'all' || (archiveFilter === 'canon' ? name.kind === 'canon' : name.kind !== 'canon'))
  })

  if (!accepted) return <div className="spoiler-screen">
    <div className="universe" aria-hidden="true" />
    <div className="gate-orbit" aria-hidden="true"><Crystal mask={maskOf('Honor', 'Odium', 'Cultivation')} className="gate-crystal" /></div>
    <main className="spoiler-gate" aria-labelledby="gate-title">
      <span className="micro gold">A speculative Realmatic study</span>
      <h1 id="gate-title">Before the<br /><em>shattering.</em></h1>
      <p className="gate-lead">Some discoveries cannot be undiscovered.</p>
      <p><strong>Full Cosmere spoilers.</strong> This study reveals all sixteen original Shards and major developments from Mistborn and Stormlight, including <em>Wind and Truth</em>. Continue only if you accept spoilers for all published Cosmere works.</p>
      <p className="gate-policy">Established canon unions are marked. Other combinations are our game's interpretations. An offline experiment, with no AI services, generated media, accounts, or tracking.</p>
      <button className="primary gate-enter" onClick={acceptSpoilers}>I accept the spoilers. Enter the confluence <span aria-hidden="true">↗</span></button>
      <span className="gate-footnote">An unofficial fan project · No book artwork or text</span>
      {saveError && <p className="save-error" role="alert">{saveError}</p>}
    </main>
  </div>

  return <div className="app" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag}>
    <div className="universe" aria-hidden="true" />
    <a href="#well" className="skip-link">Skip to fusion workspace</a>
    <header>
      <div className="brand"><svg className="brand-symbol" viewBox="0 0 40 48" fill="none" aria-hidden="true"><path d="M20 2 35 20 20 46 5 20Z" stroke="currentColor" strokeWidth=".8" /><path d="m20 2 3 20-3 24-4-26ZM5 20h30" stroke="currentColor" strokeWidth=".6" /></svg><div><div className="wordmark">SHARDS</div><div className="micro">A speculative Realmatic study</div></div></div>
      <nav className="navigation" aria-label="Main">
        <span className="nav-active micro">The confluence</span>
        <button className="micro" onClick={() => setModal({ kind: 'arcanum' })}>Arcanum <span className="gold">{String(game.discoveries.length).padStart(2, '0')}</span></button>
        <span className="local-status micro"><span className={canSave ? 'status-dot' : 'status-dot warning'} />{canSave ? 'Saved locally' : 'Session only'}</span>
      </nav>
    </header>
    {saveError && <div className="save-banner" role="alert"><span>{saveError}</span><button onClick={startFresh}>Discard old save & start fresh</button></div>}
    <main>
      <div className="layout">
        <section className="intro" aria-labelledby="main-title">
          <div className="eyebrow micro">After the Shattering</div>
          <h1 id="main-title">The<br /><em>confluence.</em></h1>
          <p className="intro-copy">Sixteen Shards. Uncounted possibilities.<br />Bring their Intents together.<br />Explore what might emerge.</p>
          <div className="rule" />
          <ol className="instructions">
            <li><b>01</b><span><strong>Draw them together.</strong><br />Click a source to place it. Drag crystals together to fuse.</span></li>
            <li><b>02</b><span><strong>Go beyond a pair.</strong><br />Fuse compounds with any unshared Intents.</span></li>
            <li><b>03</b><span><strong>Nothing is forgotten.</strong><br />Every constituent Shard remains recorded.</span></li>
          </ol>
          <div className="controls"><button className="text-button" onClick={undo} disabled={!history.length}>Undo action</button><button className="text-button" onClick={() => setModal({ kind: 'clear' })} disabled={!game.orbs.length}>Clear well</button></div>
          <p className="key-note">Click or tap a source to place it instantly. To fuse without dragging, select two crystals in the well using tap or Enter / Space. Escape clears selection.</p>
        </section>
        <section className="chamber" aria-label="Fusion workspace">
          <div className="chamber-title micro">Realmatic study <span className="gold">/</span> active</div>
          <div id="well" ref={wellRef} className={`well ${reveal ? 'fusing' : ''}`} tabIndex={-1} aria-label="Orbital fusion well. Drag a source here to place it." data-workspace="true">
            <div className="orbit" aria-hidden="true" /><div className="orbit orbit-inner" aria-hidden="true" /><div className="orbit orbit-far" aria-hidden="true" />
            <div className="axis" aria-hidden="true" /><div className="axis horizontal" aria-hidden="true" />
            <span className="coordinates coord-n" aria-hidden="true">I</span><span className="coordinates coord-w" aria-hidden="true">IV</span><span className="coordinates coord-e" aria-hidden="true">II</span><span className="coordinates coord-s" aria-hidden="true">III</span>
            <div className="horizon" aria-hidden="true" />
            {game.orbs.length === 0 && <div className="empty-well"><span className="empty-glyph" aria-hidden="true">◇</span><p>A power waits to be drawn.</p><span className="micro">Choose from the Original Shards below</span></div>}
            {game.orbs.length > 1 && <span className="center-glyph" aria-hidden="true">+</span>}
            {game.orbs.map(orb => {
              const info = resolveName(orb.lineage.mask)
              const count = constituents(orb.lineage.mask).length
              const choice: Choice = { kind: 'orb', id: orb.id, key: `orb-${orb.id}` }
              const hover = drag?.active && drag.targetKey === choice.key && drag.choice.key !== choice.key
              const overlap = hover && Boolean(dragMask! & orb.lineage.mask)
              return <div key={orb.id} className="staged-shard"
                style={{ ...shardStyle(orb.lineage.mask), left: `${orb.x * 100}%`, top: `${orb.y * 100}%`, zIndex: selected?.key === choice.key || hover ? 4 : 2 }}>
              <button id={`orb-${orb.id}`} className={`shard-node ${count > 1 ? 'compound' : ''} ${game.orbs.length > 4 ? 'compact' : ''} ${hover ? overlap ? 'drop-invalid' : 'drag-over' : ''} ${reveal?.orb.id === orb.id ? 'newborn' : ''}`}
                data-choice-key={choice.key} data-mask={orb.lineage.mask} aria-pressed={selected?.key === choice.key} aria-label={`${info.name}, ${count} constituent ${count === 1 ? 'Shard' : 'Shards'}${classification(orb.lineage.mask) ? `, ${classification(orb.lineage.mask)}` : ''}. Select or drag to fuse.`}
                onPointerDown={event => beginDrag(event, choice)} onClick={() => choose(choice)}>
                <Crystal mask={orb.lineage.mask} className="crystal" /><span className="node-name">{info.name}</span><span className="node-meta">{count === 1 ? 'Original Shard' : `${count} Shards${classification(orb.lineage.mask) ? ` / ${classification(orb.lineage.mask)}` : ''}`}</span><span className="node-line" /><span className="node-action">{overlap ? 'Shared Intent' : hover ? 'Release to fuse' : 'Select to fuse'}</span>
              </button>
              {selected?.key === choice.key && <button className="remove-shard" style={orb.y < .44 ? { top: '100%' } : undefined} aria-label={`Remove ${info.name} from well`} title={`Remove ${info.name} from well`} onClick={() => removeFromWell(orb)}>Remove <span aria-hidden="true">×</span></button>}
              </div>
            })}
            {reveal && <div className="fusion-ripple" key={reveal.orb.id} style={{ left: `${reveal.orb.x * 100}%`, top: `${reveal.orb.y * 100}%` }} aria-hidden="true" />}
          </div>
          <div className="chamber-bottom">
            {reveal && <div className="reveal-inscription" key={reveal.orb.id}><span className="micro gold">{reveal.isNew ? 'A new Intent emerges' : 'An Intent rediscovered'}{classification(reveal.orb.lineage.mask) ? ` / ${classification(reveal.orb.lineage.mask)}` : ''}</span><button className="reveal-name" onClick={() => setModal({ kind: 'inspect', lineage: reveal.orb.lineage })}>{resolveName(reveal.orb.lineage.mask).name} <span aria-hidden="true">↗</span></button></div>}
            <p className={`status ${invalid ? 'invalid' : ''}`} role="status" aria-live="polite" aria-atomic="true">{invalid && <span aria-hidden="true">◇ </span>}{status}</p>
            <div className="selection-actions">
              {selectedTree && <button className="text-button" onClick={() => setModal({ kind: 'inspect', lineage: selectedTree })}>Inspect name & history ↗</button>}
              {selected && <button className="text-button" onClick={() => { setSelected(null); announce('Selection cleared.') }}>Cancel selection</button>}
              {!selected && game.orbs.length === 1 && <button className="text-button" onClick={() => setModal({ kind: 'inspect', lineage: game.orbs[0].lineage })}>Inspect name & history ↗</button>}
            </div>
            <div className="gesture-hint"><span>Drag to fuse</span><span>/</span><span>Tap, then tap</span><span>/</span><span>Enter or Space</span></div>
          </div>
        </section>
        <aside className="archive" aria-labelledby="archive-title">
          <div className="archive-header"><h2 id="archive-title">Arcanum</h2><span className="count">{String(game.discoveries.length).padStart(2, '0')}</span></div>
          <p className="archive-intro">Names proposed. Powers recorded.<br />Your discoveries, inscribed here.</p>
          <ConstellationPreview discoveries={game.discoveries} orbs={game.orbs} onOpen={() => setModal({ kind: 'arcanum' })} />
          {game.discoveries.length > 0 && <div className="archive-tools"><label className="sr-only" htmlFor="archive-search">Search discoveries or constituent Shards</label><input id="archive-search" placeholder="Search names or Shards…" value={query} onChange={event => setQuery(event.target.value)} /><label className="sr-only" htmlFor="archive-filter">Filter discoveries</label><select id="archive-filter" value={archiveFilter} onChange={event => setArchiveFilter(event.target.value as typeof archiveFilter)}><option value="all">All discoveries</option><option value="canon">Canon mergers</option><option value="gameplay">Our interpretations</option></select></div>}
          <div className="archive-list">
            {visibleDiscoveries.map(discovery => <button key={discovery.mask} className="archive-entry" onClick={() => setModal({ kind: 'arcanum', mask: discovery.mask })} aria-label={`Inspect ${resolveName(discovery.mask).name}, ${constituents(discovery.mask).length} constituent Shards${classification(discovery.mask) ? `, ${classification(discovery.mask)}` : ''}`}>
              <Crystal mask={discovery.mask} /><span><span className="archive-name">{resolveName(discovery.mask).name}</span><span className="archive-ingredients">{constituents(discovery.mask).map(part => part.name).join(' + ')}</span>{classification(discovery.mask) && <span className="archive-kind gold">{classification(discovery.mask)}</span>}</span><span className="archive-arrow" aria-hidden="true">↗</span>
            </button>)}
            {!visibleDiscoveries.length && <><div className="archive-empty">{game.discoveries.length ? 'No discoveries match this search.' : <>A name waits<br />on the other side.</>}</div>{!game.discoveries.length && <div className="ghost-discovery" aria-hidden="true"><span className="ghost-mark" /><span className="micro">Unwritten Intent</span></div>}</>}
          </div>
          <div className="archive-footnote"><span className="gold">{game.discoveries.length.toLocaleString()}</span> of 65,519 possible combinations.<br />Every constituent Shard and combination history remains recorded. <button onClick={() => setModal({ kind: 'about' })}>Lore & naming ↗</button></div>
        </aside>
      </div>
      <section className="reservoir" aria-labelledby="sources-title">
        <div className="reservoir-header"><h2 id="sources-title">Original Shards</h2><span className="micro">Click to place · Drag to fuse <span className="gold">/</span> 16 original Intents</span></div>
        <div className="shard-shelf">{SHARDS.map((shard, index) => {
          const mask = 1 << index
          const choice: Choice = { kind: 'source', mask, key: `source-${mask}` }
          return <button key={shard.name} className={`source-shard ${drag?.active && drag.targetKey === choice.key && drag.choice.key !== choice.key ? 'source-hover' : ''}`} style={shardStyle(mask)} data-choice-key={choice.key} aria-label={`${shard.name}. ${shard.intent}. Click to place in the well, or drag to fuse.`} onPointerDown={event => beginDrag(event, choice)} onClick={() => choose(choice)}><span className="source-index">{String(index + 1).padStart(2, '0')}</span><Crystal mask={mask} /><span className="source-name">{shard.name}</span><span className="source-intent">{shard.intent}</span></button>
        })}</div>
        <p className="intent-gloss-note">Brief interpretations of the original Intents, not exhaustive canonical definitions. Crystals are symbolic representations of Shardic powers.</p>
      </section>
    </main>
    <footer><span>Original procedural crystal artwork <span className="gold">/</span> No book art</span><span>Unofficial Cosmere fan experiment <span className="gold">/</span> Offline naming</span><button onClick={() => setModal({ kind: 'about' })}>Lore & naming policy ↗</button><button onClick={() => { setAccepted(false); try { localStorage.removeItem(SPOILER_KEY) } catch (error) { setSaveError(`Spoiler consent could not be cleared: ${error instanceof Error ? error.message : String(error)}`) } }}>Show spoiler gate</button></footer>
    {drag?.active && dragMask && <div className="drag-ghost" aria-hidden="true" style={{ ...shardStyle(dragMask), left: drag.x, top: drag.y }}><Crystal mask={dragMask} /><span>{resolveName(dragMask).name}</span></div>}
    {modal && <Dialog title={modal.kind === 'inspect' ? `${resolveName(modal.lineage.mask).name}: name and combination history` : modal.kind === 'arcanum' ? 'Arcanum constellation' : modal.kind === 'clear' ? 'Clear the fusion well' : 'Lore and naming policy'} wide={modal.kind === 'arcanum'} onClose={() => setModal(null)}>
      {modal.kind === 'arcanum' && <Arcanum discoveries={game.discoveries} orbs={game.orbs} initialMask={modal.mask} onRecall={recall} />}
      {modal.kind === 'inspect' && <>
        <Crystal mask={modal.lineage.mask} className="dialog-crystal" /><span className="micro gold">An Intent, examined</span><h2>{resolveName(modal.lineage.mask).name}</h2>{classification(modal.lineage.mask) && <span className="lore-badge">{classification(modal.lineage.mask)}</span>}
        {resolveName(modal.lineage.mask).note && <p>{resolveName(modal.lineage.mask).note}</p>}<h3>Constituent Shards · {constituents(modal.lineage.mask).length} / 16</h3>
        <div className="ingredients">{constituents(modal.lineage.mask).map(part => <span key={part.name} className="ingredient" style={{ borderColor: `${part.color}55` }}>{part.name}</span>)}</div>
        <h3>Combination history</h3><p className="ancestry-note">This is the path that formed this crystal. The Arcanum remembers every distinct route you record.</p><ul className="ancestry"><HistoryTree lineage={modal.lineage} /></ul>
        {constituents(modal.lineage.mask).length > 1 && <button className="primary" onClick={() => recall(modal.lineage)}>Recall to the well ↗</button>}
      </>}
      {modal.kind === 'clear' && <><span className="micro gold">A moment of stillness</span><h2>Clear the well?</h2><p>This removes the active crystals, not your Arcanum. You can undo this action, or recall discoveries from the Arcanum.</p><button className="primary" onClick={() => { checkpoint(game); setGame({ ...game, orbs: [] }); setSelected(null); setReveal(null); setModal(null); announce('The well is clear. Your Arcanum is untouched.') }}>Clear active crystals</button><button className="text-button dialog-secondary" onClick={() => setModal(null)}>Keep exploring</button></>}
      {modal.kind === 'about' && <><span className="micro gold">The boundary of canon</span><h2>Names are not<br /><em>prophecies.</em></h2><p>Established canon unions are marked: <strong>Harmony</strong> (Preservation + Ruin) and <strong>Retribution</strong> (Honor + Odium). Other combinations are our game's interpretations. This study abstracts the circumstances of a union.</p><h3>The study</h3><p>Crystals symbolize Shardic powers, not literal Shards or Shardblades. Reusable sources, disjoint constituents, order-independent naming, and Undo are game rules. The Confluence is an invented interface, not a canonical institution.</p><h3>Offline names</h3><p>Names come from curated combinations and a fixed single-word concept lexicon, with every original Intent contributing. No model or AI service creates names. Different sets may share a name; constituents define identity and preserve your combination history.</p><h3>Important distinctions</h3><p>The Dor is intermingled <em>Splintered</em> Investiture of Devotion and Dominion in the Cognitive Realm, not an intact single-Vessel merger. Their intact gameplay combination is not labeled “Dor.” Discord is an alternate possible expression of Ruin and Preservation, not another original Shard. Reuniting all sixteen is not known to restore Adonalsium, the original being.</p><h3>Sources & fan-project note</h3><p>This unofficial, noncommercial Cosmere fan experiment is not affiliated with Brandon Sanderson or Dragonsteel. Artwork is original SVG/CSS; no book art, quotations, or generated media are used.</p><div className="source-links">{['Shard', 'Reason', 'Harmony', 'Retribution', 'Dor', 'Ars_Arcanum'].map(page => <a key={page} href={`https://coppermind.net/wiki/${page}`} target="_blank" rel="noreferrer">{page.replace('_', ' ')} ↗</a>)}</div><p className="privacy-note">Progress and spoiler consent stay in this browser's local storage. No accounts, telemetry, or backend. Works without internet after serving the installed local project.</p></>}
    </Dialog>}
  </div>
}

export default App
