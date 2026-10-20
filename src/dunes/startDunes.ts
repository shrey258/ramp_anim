import * as THREE from 'three'
import { createGrains } from './grains'
import { createScreenPasses } from './screenPasses'

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Ramp's page clock runs 12% fast; the dark look fades to light between 2.7 and 3.55 s on it.
// ponytail: stops at the light dunes; Ramp erupts into a separate simulation at 5.68 s.
const darkToneAt = (wall: number) => 1 - smoothstep(2.7, 3.55, wall * 1.12)

// Mounts the dunes canvas in `el` and runs it. Returns a cleanup that stops and removes it.
export function startDunes(el: HTMLElement) {
  const phone = innerWidth < 700
  const renderer = new THREE.WebGLRenderer({ antialias: false, depth: false })
  renderer.setPixelRatio(phone ? 1 : Math.min(devicePixelRatio, 1.25))
  renderer.setSize(innerWidth, innerHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.autoClear = false
  renderer.setClearColor(0x000000, 0)
  el.appendChild(renderer.domElement)

  // ~1M grains on desktop (352 x 352 x 8). Ramp frames the dunes for a 2:1 desktop, 0.6 on phones.
  const grains = phone
    ? createGrains(192, 4, { aspect: 0.6, height: 690 })
    : createGrains(352, 8, { aspect: 2, height: 850 })
  const passes = createScreenPasses(grains.uniforms.uDarkTone)

  const onResize = () => {
    renderer.setSize(innerWidth, innerHeight)
    passes.resize(renderer.getDrawingBufferSize(new THREE.Vector2()))
    grains.uniforms.uAspect.value = Math.max(innerWidth / innerHeight, 0.35)
  }
  onResize()
  addEventListener('resize', onResize)

  const clear = (target: THREE.WebGLRenderTarget) => {
    renderer.setRenderTarget(target)
    renderer.clear()
  }

  let start = -1
  let last = 0
  renderer.setAnimationLoop((now) => {
    if (start < 0) start = last = now
    grains.uniforms.uDuneTime.value += Math.min((now - last) / 1000, 0.05)
    grains.uniforms.uDarkTone.value = darkToneAt((now - start) / 1000)
    last = now

    // Blur layers. The far one only needs the farthest 34% of grains, the near one the nearest 43%.
    clear(passes.farLayer)
    grains.draw(renderer, passes.farLayer, 1, 0, Math.ceil(0.34 * grains.count) + 1)
    clear(passes.nearLayer)
    grains.draw(renderer, passes.nearLayer, 2, Math.floor(0.57 * grains.count) - 1)

    // Field, back to front: far blur, sharp grains, near blur.
    clear(passes.field)
    passes.drawLayer(renderer, passes.farLayer)
    grains.draw(renderer, passes.field, 0)
    passes.drawLayer(renderer, passes.nearLayer)

    passes.composite(renderer)
  })

  return () => {
    renderer.setAnimationLoop(null)
    removeEventListener('resize', onResize)
    grains.dispose()
    passes.dispose()
    renderer.dispose()
    el.removeChild(renderer.domElement)
  }
}
