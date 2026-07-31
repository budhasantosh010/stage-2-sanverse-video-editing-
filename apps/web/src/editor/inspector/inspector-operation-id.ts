export function createInspectorOperationId(): string {
  const bytes = new Uint8Array(12)
  globalThis.crypto.getRandomValues(bytes)
  return `operation_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}
