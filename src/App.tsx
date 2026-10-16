import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// Step 1 of the Ramp sand: a grid of points moved entirely on the GPU.
const vertexShader = /* glsl */ `
  uniform float uTime;
  void main() {
    vec3 p = position;                          // start position, uploaded once
    p.z += sin(p.x * 4.0 + uTime) * 0.15;       // the only "animation": a ripple
    p.z += sin(p.y * 3.0 + uTime * 0.7) * 0.15;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = 2.0;
  }
`

const fragmentShader = /* glsl */ `
  void main() {
    gl_FragColor = vec4(0.95, 0.77, 0.43, 0.25); // faint, so overlaps read as density
  }
`

function App() {
  const mount = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = mount.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(devicePixelRatio)
    renderer.setSize(innerWidth, innerHeight)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100)
    camera.position.set(0, -2.2, 1.4)
    camera.lookAt(0, 0, 0)

    // 256 x 256 grid = 65,536 points. JS builds it once, never touches it again.
    const N = 256
    const pos = new Float32Array(N * N * 3)
    for (let i = 0; i < N * N; i++) {
      pos[i * 3] = (i % N) / N * 4 - 2
      pos[i * 3 + 1] = Math.floor(i / N) / N * 4 - 2
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    scene.add(new THREE.Points(geometry, material))

    const onResize = () => {
      camera.aspect = innerWidth / innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(innerWidth, innerHeight)
    }
    addEventListener('resize', onResize)

    // Per frame: send one number to the GPU. That's it.
    renderer.setAnimationLoop((t) => {
      material.uniforms.uTime.value = t / 1000
      renderer.render(scene, camera)
    })

    return () => {
      renderer.setAnimationLoop(null)
      removeEventListener('resize', onResize)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mount} style={{ position: 'fixed', inset: 0, background: '#050505' }} />
}

export default App
