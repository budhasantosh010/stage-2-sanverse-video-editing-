/**
 * A cache that cannot grow without limit, whatever the user does.
 *
 * ## Why a ceiling is not optional here
 *
 * A sixty-minute project scrolled end to end asks for thousands of thumbnails.
 * Held in a plain object, every one of them stays in memory for as long as the
 * tab is open, and the tab eventually dies — on the longest videos, which are
 * exactly the ones the user has spent the most time on.
 *
 * So this holds a fixed number of things and, when full, throws away the one
 * that has gone longest without being asked for. That is the right one to lose:
 * a thumbnail nobody has looked at for a while is off-screen, and producing it
 * again costs one decode at the moment it is scrolled back to.
 *
 * ## Why the count is the limit rather than the bytes
 *
 * Bytes cannot be measured honestly in a browser. An `ImageBitmap`'s real
 * footprint is not observable from script, and a number that is a guess would
 * make the ceiling a guess. A count multiplied by a KNOWN maximum frame size is
 * an honest bound, and it is the bound the tests assert.
 *
 * ## Why disposal is explicit
 *
 * `ImageBitmap` and object URLs are not reclaimed by garbage collection alone:
 * they hold memory the browser only frees when told. Anything evicted is passed
 * to `dispose` on the way out, so nothing can be dropped from the map while its
 * memory quietly stays.
 */
export type BoundedCacheOptions<V> = Readonly<{
  /** Most entries held at once. Reached, the least-recently-used one goes. */
  maxEntries: number
  /** Called for everything evicted, replaced, or cleared. Never skipped. */
  dispose?: (value: V) => void
}>

export type BoundedCache<V> = Readonly<{
  get(key: string): V | undefined
  set(key: string, value: V): void
  has(key: string): boolean
  delete(key: string): boolean
  clear(): void
  readonly size: number
  /** Keys from least- to most-recently used. For tests and diagnostics. */
  keys(): readonly string[]
}>

export const createBoundedCache = <V>(options: BoundedCacheOptions<V>): BoundedCache<V> => {
  const maxEntries = Math.max(1, Math.floor(options.maxEntries))
  const dispose = options.dispose
  // A Map iterates in insertion order, so "delete then set" moves an entry to
  // the most-recently-used end. That is the whole LRU mechanism, with no second
  // list to fall out of step with the map.
  const entries = new Map<string, V>()

  const release = (value: V): void => {
    if (dispose) dispose(value)
  }

  return Object.freeze({
    get(key: string): V | undefined {
      if (!entries.has(key)) return undefined
      const value = entries.get(key) as V
      entries.delete(key)
      entries.set(key, value)
      return value
    },
    set(key: string, value: V): void {
      const existing = entries.get(key)
      // Replacing a key must release what was there. Otherwise a re-decode at
      // the same size would leak the old bitmap every time.
      if (existing !== undefined && existing !== value) release(existing)
      entries.delete(key)
      entries.set(key, value)
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next()
        if (oldest.done) break
        const evicted = entries.get(oldest.value) as V
        entries.delete(oldest.value)
        release(evicted)
      }
    },
    has: (key: string): boolean => entries.has(key),
    delete(key: string): boolean {
      const existing = entries.get(key)
      if (existing === undefined && !entries.has(key)) return false
      entries.delete(key)
      if (existing !== undefined) release(existing)
      return true
    },
    clear(): void {
      for (const value of entries.values()) release(value)
      entries.clear()
    },
    get size(): number {
      return entries.size
    },
    keys: (): readonly string[] => Object.freeze([...entries.keys()]),
  })
}
