import { Separator } from 'react-resizable-panels'

export function StudioSeparator({ id, label, orientation, disabled = false }: Readonly<{ id: string; label: string; orientation: 'horizontal' | 'vertical'; disabled?: boolean }>) {
  const hitTarget = orientation === 'vertical'
    ? { width: 8, height: '100%' }
    : { width: '100%', height: 8 }
  return <Separator id={id} className="studio-layout-v2__separator" aria-label={label} disabled={disabled} style={hitTarget}><span aria-hidden="true" /></Separator>
}
