import * as THREE from 'three'
import { compositeFragment, layerFragment, quadVertex } from './shaders'

const camera = new THREE.Camera() // unused: the shaders write clip space directly

const renderTarget = () =>
  new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter })

// The offscreen images (field + two blur layers) and the full-screen passes that combine them.
export function createScreenPasses(darkTone: { value: number }) {
  const field = renderTarget()
  const farLayer = renderTarget()
  const nearLayer = renderTarget()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
  const layerMaterial = new THREE.ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: layerFragment,
    uniforms: { uLayer: { value: null as THREE.Texture | null } },
    transparent: true,
    blending: THREE.NormalBlending,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  })
  const compositeMaterial = new THREE.ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: compositeFragment,
    uniforms: { uField: { value: field.texture }, uDarkTone: darkTone },
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(geometry, layerMaterial)
  quad.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(quad)

  const drawQuad = (renderer: THREE.WebGLRenderer, material: THREE.ShaderMaterial) => {
    quad.material = material
    renderer.render(scene, camera)
  }

  return {
    field,
    farLayer,
    nearLayer,
    resize(buffer: THREE.Vector2) {
      // Ramp caps the field at 2048 px on the long edge and 2.4 MP.
      const scale = Math.min(1, 2048 / Math.max(buffer.x, buffer.y), Math.sqrt(2.4e6 / (buffer.x * buffer.y)))
      const w = Math.max(1, Math.round(buffer.x * scale))
      const h = Math.max(1, Math.round(buffer.y * scale))
      field.setSize(w, h)
      farLayer.setSize(Math.ceil(w * 0.35), Math.ceil(h * 0.35))
      nearLayer.setSize(Math.ceil(w * 0.35), Math.ceil(h * 0.35))
    },
    // Stretches a low-res blur layer over the field.
    drawLayer(renderer: THREE.WebGLRenderer, layer: THREE.WebGLRenderTarget) {
      renderer.setRenderTarget(field)
      layerMaterial.uniforms.uLayer.value = layer.texture
      drawQuad(renderer, layerMaterial)
    },
    composite(renderer: THREE.WebGLRenderer) {
      renderer.setRenderTarget(null)
      drawQuad(renderer, compositeMaterial)
    },
    dispose() {
      for (const t of [field, farLayer, nearLayer]) t.dispose()
      layerMaterial.dispose()
      compositeMaterial.dispose()
      geometry.dispose()
    },
  }
}
