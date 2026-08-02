import { STUDIO_LAYOUT_V2_SCHEMA, type StudioLayoutV2State } from './studio-layout-contract'

export const defaultStudioLayoutV2 = (): StudioLayoutV2State => Object.freeze({
  schemaVersion: STUDIO_LAYOUT_V2_SCHEMA,
  rootLayout: [25, 75] as const,
  mainVerticalLayout: [62, 38] as const,
  upperLayout: [20, 50, 30] as const,
  aiMode: 'collapsed',
  mediaCollapsed: false,
  toolCollapsed: false,
  activeWorkspace: 'edit',
  preset: 'edit',
})

export const STUDIO_LAYOUT_PRESETS: Readonly<Record<Exclude<StudioLayoutV2State['preset'], 'custom'>, StudioLayoutV2State>> = Object.freeze({
  edit: defaultStudioLayoutV2(),
  motion: Object.freeze({ ...defaultStudioLayoutV2(), upperLayout: [12, 56, 32] as const, mediaCollapsed: true, preset: 'motion' }),
  timeline: Object.freeze({ ...defaultStudioLayoutV2(), mainVerticalLayout: [42, 58] as const, upperLayout: [10, 62, 28] as const, mediaCollapsed: true, toolCollapsed: true, preset: 'timeline' }),
  review: Object.freeze({ ...defaultStudioLayoutV2(), mainVerticalLayout: [70, 30] as const, upperLayout: [10, 68, 22] as const, mediaCollapsed: true, preset: 'review' }),
  ai: Object.freeze({ ...defaultStudioLayoutV2(), rootLayout: [28, 72] as const, aiMode: 'expanded', upperLayout: [14, 56, 30] as const, mediaCollapsed: true, preset: 'ai' }),
  audio: Object.freeze({ ...defaultStudioLayoutV2(), mainVerticalLayout: [45, 55] as const, activeWorkspace: 'audio', preset: 'audio' }),
})
