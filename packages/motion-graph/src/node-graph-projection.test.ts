import { describe, expect, it } from 'vitest'
import { constant } from './properties.ts'
import { createDefaultEffect } from './effects.ts'
import { createDefaultMask } from './masks.ts'
import { nodeBase } from './nodes.ts'
import { createMotionScene } from './scene.ts'
import { deriveNodeGraphProjection } from './node-graph-projection.ts'

const scene = createMotionScene({
  componentId: 'sanverse.c6-proof', componentVersion: 1, rootNodeId: 'proof.root', supportedAspectRatios: ['16:9'],
  semanticParts: Object.freeze([{ id: 'hero', label: 'Hero', role: 'primary-text' as const, nodeIds: Object.freeze(['hero.title']) }]), exposures: Object.freeze([]),
  layout: Object.freeze({ mode: 'responsive' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }),
  nodes: Object.freeze({
    'proof.root': Object.freeze({ ...nodeBase('proof.root','Root',null), type: 'group' as const, childIds: Object.freeze(['hero.title']) }),
    'hero.title': Object.freeze({ ...nodeBase('hero.title','Hero title','proof.root'), type: 'text' as const, text: constant('Hello'), fillColor: constant('#fff'), fontFamily: 'Arial', fontSize: constant(64), fontWeight: constant(700), textAlign: 'center' as const, effects: Object.freeze([createDefaultEffect('hero.glow','glow')]), masks: Object.freeze([createDefaultMask('hero.mask','rounded-rectangle')]) }),
  }),
})

describe('C6 node graph projection', () => {
  it('projects the canonical Motion Scene without minting new node identities', () => {
    const projection = deriveNodeGraphProjection(scene)
    expect(projection.schemaVersion).toBe('sanverse.motion-node-projection/v1')
    expect(projection.nodes.map((node) => node.nodeId).sort()).toEqual(Object.keys(scene.nodes).sort())
    expect(projection.nodes.find((node) => node.nodeId === 'hero.title')).toMatchObject({ parentNodeId: 'proof.root', effectIds: ['hero.glow'], maskIds: ['hero.mask'] })
    expect(projection.relationships).toContainEqual({ kind: 'parent', fromNodeId: 'proof.root', toNodeId: 'hero.title' })
  })
})
