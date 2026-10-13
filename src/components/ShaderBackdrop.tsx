import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../lib/gsap'

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

// Domain-warped fbm smoke, tinted toward the accent colour, drifting toward the pointer.
const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec3 u_accent;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec2 m = (u_mouse - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  float t = u_time * 0.045;

  vec2 q = vec2(fbm(p * 1.6 + vec2(0.0, t)), fbm(p * 1.6 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p * 1.8 + 3.0 * q + vec2(1.7, 9.2) + t * 1.5), fbm(p * 1.8 + 3.0 * q + vec2(8.3, 2.8) - t));
  float f = fbm(p * 1.4 + 2.5 * r + (p - m) * 0.25);

  vec3 ink = vec3(0.043, 0.035, 0.027);
  vec3 col = mix(ink, vec3(0.17, 0.13, 0.095), smoothstep(0.2, 0.95, f));
  col = mix(col, u_accent, pow(smoothstep(0.42, 1.05, f * length(r)), 2.0) * 0.6);

  float glow = smoothstep(0.85, 0.0, length(p - m * 0.7));
  col += u_accent * glow * 0.07;

  float vig = smoothstep(1.3, 0.2, length(p * vec2(0.85, 1.15)));
  col *= mix(0.3, 1.0, vig);
  col = mix(ink, col, smoothstep(0.0, 0.4, uv.y));

  gl_FragColor = vec4(col, 1.0);
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error')
  return s
}

const GOLD: [number, number, number] = [217, 179, 108]

export function ShaderBackdrop({ accent = GOLD }: { accent?: [number, number, number] }) {
  const accentKey = accent.join(',')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) {
      canvas.classList.add('is-fallback')
      return
    }

    let program: WebGLProgram
    try {
      program = gl.createProgram()!
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT))
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG))
      gl.linkProgram(program)
      gl.useProgram(program)
    } catch (err) {
      console.warn('[shader]', err)
      canvas.classList.add('is-fallback')
      return
    }

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(program, 'u_res')
    const uTime = gl.getUniformLocation(program, 'u_time')
    const uMouse = gl.getUniformLocation(program, 'u_mouse')
    const uAccent = gl.getUniformLocation(program, 'u_accent')
    gl.uniform3f(uAccent, accent[0] / 255, accent[1] / 255, accent[2] / 255)

    // Render below native resolution: smoke is soft anyway and this keeps laptops cool.
    const scale = Math.min(window.devicePixelRatio, 1.5) * 0.55
    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * scale))
      const h = Math.max(1, Math.round(canvas.clientHeight * scale))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
        gl.uniform2f(uRes, w, h)
      }
    }

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }
    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / window.innerWidth
      mouse.ty = 1 - e.clientY / window.innerHeight
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    const still = prefersReducedMotion()
    let visible = true
    let raf = 0
    const start = performance.now()

    const frame = () => {
      resize()
      mouse.x += (mouse.tx - mouse.x) * 0.04
      mouse.y += (mouse.ty - mouse.y) * 0.04
      gl.uniform2f(uMouse, mouse.x, mouse.y)
      gl.uniform1f(uTime, still ? 12 : (performance.now() - start) / 1000)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!still && visible) raf = requestAnimationFrame(frame)
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      cancelAnimationFrame(raf)
      if (visible) raf = requestAnimationFrame(frame)
    })
    io.observe(canvas)
    frame()

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('pointermove', onMove)
    }
  }, [accentKey])

  return <canvas ref={canvasRef} className="shader-backdrop" aria-hidden="true" />
}
