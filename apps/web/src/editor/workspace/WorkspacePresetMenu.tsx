import { WORKSPACE_PRESETS, type WorkspacePresetId } from './workspace-contract'

const label = (preset: Exclude<WorkspacePresetId, 'custom'>): string => ({
  edit: 'Edit',
  motion: 'Motion',
  timeline: 'Timeline',
  review: 'Review',
  ai: 'AI',
  audio: 'Audio',
})[preset]

export function WorkspacePresetMenu({
  value,
  onApply,
  onReset,
}: Readonly<{
  value: WorkspacePresetId
  onApply(preset: Exclude<WorkspacePresetId, 'custom'>): void
  onReset(): void
}>) {
  return (
    <div className="workspace-preset-menu">
      <label>
        <span>Workspace preset</span>
        <select
          aria-label="Workspace preset"
          value={value === 'custom' ? 'custom' : value}
          onChange={(event) => {
            const preset = event.currentTarget.value
            if (preset !== 'custom') onApply(preset as Exclude<WorkspacePresetId, 'custom'>)
          }}
        >
          {value === 'custom' ? <option value="custom">Custom</option> : null}
          {WORKSPACE_PRESETS.map((preset) => <option key={preset} value={preset}>{label(preset)}</option>)}
        </select>
      </label>
      <button type="button" onClick={onReset}>Reset workspace</button>
    </div>
  )
}
