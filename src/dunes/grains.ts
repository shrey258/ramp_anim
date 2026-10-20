import * as THREE from 'three'
import { grainFragment, grainVertex } from './shaders'

const camera = new THREE.Camera() // unused: the shaders write clip space directly

type Frame = { aspect: number; height: number }

// side x side grid cells, `copies` grains per cell, stored far -> near so they draw back to front.
export function createGrains(side: number, copies: number, frame: Frame) {
  const count = side * side * copies
  const position = new Float32Array(count * 3)
  const depth = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const cell = i % (side * side)
    position[i * 3] = ((cell % side) + 0.5) / side
    position[i * 3 + 1] = (Math.floor(cell / side) + 0.5) / side
    position[i * 3 + 2] = Math.floor(i / (side * side))
    depth[i] = 1 - (i + 0.5) / count
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geometry.setAttribute('aIntroDepth', new THREE.BufferAttribute(depth, 1))

  const uniforms = {
    uDuneTime: { value: 1.8 },
    uAspect: { value: 1 },
    uFrameAspect: { value: frame.aspect },
    uPixelRatio: { value: 1 },
    uLayer: { value: 0 },
    uDarkTone: { value: 1 },
  }
  const material = new THREE.ShaderMaterial({
    vertexShader: grainVertex,
    fragmentShader: grainFragment,
    uniforms,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false // three can't know where our shader moves points
  const scene = new THREE.Scene()
  scene.add(points)

  return {
    count,
    uniforms,
    // Draws grains [from, to) that belong to `layer` (0 sharp, 1 far blur, 2 near blur) into `target`.
    draw(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, layer: number, from = 0, to = count) {
      renderer.setRenderTarget(target)
      uniforms.uLayer.value = layer
      uniforms.uPixelRatio.value = target.height / frame.height
      geometry.setDrawRange(from, to - from)
      renderer.render(scene, camera)
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
