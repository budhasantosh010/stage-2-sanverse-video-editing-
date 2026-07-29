import type { AssistChangeItem } from './assist-change-model'
import './AssistChangeStrip.css'

export type AssistChangeStripProps = {
  items: readonly AssistChangeItem[]
  selectedId: string | null
  onSelect(id: string): void
  onSeek(ticks: number): void
  onOpenStudio(): void
}

const MAX_VISIBLE = 5

export function AssistChangeStrip({
  items,
  selectedId,
  onSelect,
  onSeek,
  onOpenStudio,
}: AssistChangeStripProps) {
  const hiddenCount = Math.max(0, items.length - MAX_VISIBLE)
  const visibleItems = hiddenCount > 0 ? items.slice(-MAX_VISIBLE) : items

  return (
    <section className="assist-change-strip" aria-labelledby="assist-changes-title">
      <div className="assist-change-strip__heading">
        <div>
          <span>Changes</span>
          <h2 id="assist-changes-title">What has changed</h2>
        </div>
        <button type="button" onClick={onOpenStudio} aria-label="Open full history in Studio">
          Open in Studio
        </button>
      </div>

      {items.length === 0 ? (
        <p className="assist-change-strip__empty">
          No accepted edits or pending proposals. No changes yet — ask Sanverse for an edit or
          point at the video.
        </p>
      ) : (
        <ul className="assist-change-strip__list">
          {hiddenCount > 0 ? (
            <li className="assist-change-strip__earlier">+{hiddenCount} earlier</li>
          ) : null}
          {visibleItems.map((item) => {
            const status =
              item.status === 'pending'
                ? 'Pending'
                : item.status === 'blocked'
                  ? 'Needs attention'
                  : 'Accepted'
            return (
              <li key={item.id}>
                {item.seekTicks === null ? (
                  <span className={`assist-change-strip__item assist-change-strip__item--${item.status}`}>
                    <strong>{item.label}</strong>
                    <small>{status}</small>
                  </span>
                ) : (
                  <button
                    type="button"
                    className={`assist-change-strip__item assist-change-strip__item--${item.status}`}
                    aria-label={`${item.label}, ${status.toLowerCase()}`}
                    aria-current={selectedId === item.id ? 'true' : undefined}
                    onClick={() => {
                      onSelect(item.id)
                      onSeek(item.seekTicks as number)
                    }}
                  >
                    <strong>{item.label}</strong>
                    <small>{status}</small>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
