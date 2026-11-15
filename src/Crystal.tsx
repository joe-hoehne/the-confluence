import { constituents } from './engine'

const silhouettes = [
  [[51, 3], [82, 39], [72, 103], [49, 146], [25, 102], [18, 58]],
  [[55, 2], [83, 57], [63, 124], [40, 145], [19, 95], [30, 35]],
  [[44, 3], [73, 29], [88, 84], [57, 145], [30, 112], [13, 62]],
  [[53, 2], [77, 42], [70, 108], [42, 146], [22, 83], [29, 29]],
  [[64, 3], [80, 61], [60, 102], [34, 144], [17, 77], [34, 38]],
  [[49, 2], [82, 45], [76, 91], [56, 144], [24, 110], [17, 49]],
  [[40, 3], [76, 32], [85, 81], [52, 145], [22, 106], [16, 49]],
  [[55, 3], [80, 46], [73, 115], [46, 145], [18, 89], [26, 30]],
]

export default function Crystal({ mask, className = '' }: { mask: number; className?: string }) {
  const parts = constituents(mask)
  const index = Math.log2(mask & -mask)
  const p = silhouettes[(index + (parts.length > 1 ? parts.length : 0)) % silhouettes.length]
  const middle = [49, 71]
  const colors = parts.map(part => part.color)
  const faces = [
    [p[0], p[1], middle], [p[0], middle, p[5]], [p[1], p[2], middle],
    [p[2], p[3], middle], [p[3], p[4], middle], [p[4], p[5], middle],
  ]
  const points = (vertices: number[][]) => vertices.map(point => point.join(',')).join(' ')
  return (
    <svg viewBox="0 0 100 150" className={className} aria-hidden="true" focusable="false">
      <polygon points={points(p)} fill="#111c25" stroke={colors[0]} strokeOpacity=".5" strokeWidth=".55" />
      {faces.map((face, i) => <polygon className={`facet facet-${i % 2 ? 'shadow' : 'light'}`} key={i} points={points(face)} fill={colors[i % colors.length]} fillOpacity={[.68, .36, .25, .48, .19, .52][i]} stroke={colors[0]} strokeOpacity=".2" strokeWidth=".4" />)}
      <path d={`M${p[0].join(' ')} 49 71 ${p[3].join(' ')} M${p[5].join(' ')} 49 71 ${p[1].join(' ')}`} stroke="#e1ffff" strokeOpacity=".53" fill="none" strokeWidth=".65" />
      <path d={`M${p[0].join(' ')} ${p[1].join(' ')}`} stroke="#effff6" strokeOpacity=".85" strokeWidth=".9" />
      <polygon points={`${p[0].join(',')} 44,62 49,82`} fill="#e6fff9" fillOpacity=".12" />
      <path d="m37 45 7 19-9 21m21-48 8 25-9 19m-18 24 10 10" fill="none" stroke="#e5fff8" strokeOpacity=".16" strokeWidth=".35" />
      {parts.length > 1 && <>
        <path d="m35 29 14 42-8 34m8-34 18 22" fill="none" stroke="#fff7de" strokeOpacity=".72" strokeWidth=".7" />
        <polygon points="41,52 52,42 58,68 49,91" fill="#f5efcf" fillOpacity=".23" />
      </>}
    </svg>
  )
}
