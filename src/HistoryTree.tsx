import { constituents, resolveName } from './engine'
import type { Ancestry } from './engine'

export default function HistoryTree({ lineage }: { lineage: Ancestry }) {
  return <li>
    <span className="ancestry-name">{resolveName(lineage.mask).name}</span>
    <span className="ancestry-count">{constituents(lineage.mask).length === 1 ? 'Original Shard' : `${constituents(lineage.mask).length} constituent Shards`}</span>
    {lineage.parents && <ul>{lineage.parents.map((parent, index) => <HistoryTree key={index} lineage={parent} />)}</ul>}
  </li>
}
