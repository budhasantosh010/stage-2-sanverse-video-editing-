import test from 'node:test'
import assert from 'node:assert/strict'

import {
  findForbiddenMotionImportsInText,
  isForbiddenMotionSpecifier,
  isProductionWebSource,
  isProtectedMotionPath,
  normalizeRepoPath,
  parseNameStatusZ,
} from './check-editor-boundary.mjs'

test('normalizes Windows paths before ownership matching', () => {
  assert.equal(normalizeRepoPath('packages\\motion-library\\foo.ts'), 'packages/motion-library/foo.ts')
})

test('editor-owned files are allowed', () => {
  assert.equal(isProtectedMotionPath('apps/web/src/editor/timeline/Timeline.tsx'), false)
  assert.equal(isProtectedMotionPath('apps/web/src/editor/timeline/Timeline.test.tsx'), false)
})

test('all protected Motion path families are refused', () => {
  for (const path of [
    'packages/motion-library/foo.ts',
    'packages/motion-graph/foo.ts',
    'packages/motion-future-compositor/foo.ts',
    'apps/motion-lab/foo.tsx',
    'motion/styles/default.json',
    'DOCS/motion/file.md',
  ]) {
    assert.equal(isProtectedMotionPath(path), true, path)
  }
})

test('production apps/web ordinary imports remain allowed', () => {
  assert.deepEqual(
    findForbiddenMotionImportsInText("import { Timeline } from './editor/timeline/Timeline'\nimport type { EditProject } from '@sanverse/edit-domain'"),
    [],
  )
})

test('production apps/web cannot import Motion packages', () => {
  assert.deepEqual(
    findForbiddenMotionImportsInText("import { library } from '@sanverse/motion-library'\nexport { graph } from '@sanverse/motion-graph'"),
    ['@sanverse/motion-library', '@sanverse/motion-graph'],
  )
})

test('dynamic imports and require cannot reach Motion packages or Motion Lab', () => {
  assert.deepEqual(
    findForbiddenMotionImportsInText("const a = import('@sanverse/motion-native-runtime')\nconst b = require('../../apps/motion-lab/runtime')"),
    ['@sanverse/motion-native-runtime', '../../apps/motion-lab/runtime'],
  )
})

test('forbidden specifier rule is closed around Motion ownership', () => {
  assert.equal(isForbiddenMotionSpecifier('@sanverse/motion-library'), true)
  assert.equal(isForbiddenMotionSpecifier('@sanverse/motion-graph/runtime'), true)
  assert.equal(isForbiddenMotionSpecifier('../../apps/motion-lab/runtime'), true)
  assert.equal(isForbiddenMotionSpecifier('@sanverse/edit-domain'), false)
})

test('only production web source is scanned for forbidden dependencies', () => {
  assert.equal(isProductionWebSource('apps/web/src/editor/Timeline.tsx'), true)
  assert.equal(isProductionWebSource('apps/web/src/editor/Timeline.test.tsx'), false)
  assert.equal(isProductionWebSource('apps/web/src/test/setup.ts'), false)
  assert.equal(isProductionWebSource('packages/edit-domain/src/project.ts'), false)
})

test('name-status parser retains both sides of renames so protected old paths cannot disappear', () => {
  const parsed = parseNameStatusZ('M\0apps/web/src/editor/Timeline.tsx\0R100\0packages/motion-library/old.ts\0apps/web/src/new.ts\0')
  assert.deepEqual(parsed, [
    'apps/web/src/editor/Timeline.tsx',
    'packages/motion-library/old.ts',
    'apps/web/src/new.ts',
  ])
})
