import { V5_METADATA, V5_NAMES, V5_NAME_INDEX_BASE64 } from './naming-v5.generated.ts'

export { V5_METADATA as NAMING_METADATA, V5_NAMING_VERSION as NAMING_VERSION } from './naming-v5.generated.ts'

const indices = atob(V5_NAME_INDEX_BASE64)
if (indices.length !== V5_METADATA.masks + 1 || indices.charCodeAt(0) !== 0) {
  throw new Error('The approved naming lookup is incomplete or invalid.')
}

export function resolveV5Concept(mask: number): string {
  if (!Number.isInteger(mask) || mask < 1 || mask > V5_METADATA.masks) {
    throw new Error('An approved naming identity must contain between one and sixteen original Intents.')
  }
  const name = V5_NAMES[indices.charCodeAt(mask)]
  if (!name) throw new Error(`The approved naming lookup has no concept for mask ${mask}.`)
  return name
}
