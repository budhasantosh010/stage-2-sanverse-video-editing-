import { describe, expect, it } from 'vitest'
import { MOTION_LIBRARY_CATALOG, type MotionLibraryCatalogEntryV1 } from './library-catalog.ts'
import { createMotionLibraryScaleIndexV15 } from './scale-index.ts'

const synthetic = (count:number): readonly MotionLibraryCatalogEntryV1[] => {
  const base=MOTION_LIBRARY_CATALOG[0]!
  return Object.freeze(Array.from({length:count},(_,index)=>Object.freeze({
    ...base,
    componentId:`sanverse.synthetic-${index}` as const,
    displayName:`Synthetic metric ${index}`,
    shortDescription:`Synthetic scale fixture ${index} for production Library indexing.`,
    aliases:Object.freeze([`fixture ${index}`,index%10===0?'quarterly metric':'standard metric']),
    referenceLineage:Object.freeze([`lineage:${index%40}`]),
    libraryScope:index%5===0?'project' as const:'sanverse' as const,
  })))
}

describe('V1.5 Motion Library scale index',()=>{
  it('indexes and searches 5,000 canonical catalog-shaped entries without creating a second registry',()=>{
    const entries=synthetic(5_000),index=createMotionLibraryScaleIndexV15(entries)
    expect(index.stats()).toMatchObject({entries:5_000})
    expect(index.query({query:'Synthetic metric 4321'}).map(entry=>entry.componentId)).toContain('sanverse.synthetic-4321')
    expect(index.query({query:'quarterly metric'}).length).toBeGreaterThan(100)
    expect(index.query({libraryScope:'project'}).length).toBe(1_000)
  })

  it('updates one promoted/imported capability incrementally and removes stale postings',()=>{
    const [entry]=synthetic(1),index=createMotionLibraryScaleIndexV15([entry!])
    expect(index.query({query:'quarterly'})).toHaveLength(1)
    const updated=Object.freeze({...entry!,displayName:'Updated reusable card',aliases:Object.freeze(['new alias']),libraryScope:'external' as const})
    index.upsert(updated)
    expect(index.stats().entries).toBe(1)
    expect(index.query({query:'quarterly'})).toHaveLength(0)
    expect(index.query({query:'new alias',libraryScope:'external'}).map(item=>item.componentId)).toEqual([entry!.componentId])
    expect(index.remove(entry!.componentId)).toBe(true)
    expect(index.stats().entries).toBe(0)
  })
})
