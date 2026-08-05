/// <reference types="vite/client" />

// Gives `import.meta.env.MODE` a type. It is what tells the app whether it is
// running in development, which is the only condition under which the preview
// diagnostics panel is built at all — see
// `features/diagnostics/timeline-monitor-diagnostics.ts`.
