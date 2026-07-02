import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Instances, Instance } from '@react-three/drei'
import * as THREE from 'three'
import { cellOwners, type BoardState, type Cell, type Piece } from '../lib/polycubeEngine'

const CELL = 0.92

export interface Ghost {
  cells: [number, number, number][]
  valid: boolean
}

/* Re-frame the camera whenever board size or a reset signal changes. */
function CameraRig({ board, resetKey }: { board: BoardState; resetKey: number }) {
  const { camera } = useThree()
  const controls = useRef<any>(null)
  const last = useRef('')
  const key = `${board.sx},${board.sy},${board.sz},${resetKey}`
  if (last.current !== key) {
    last.current = key
    const { sx, sy, sz } = board
    const cx = sx / 2 - 0.5
    const cy = sy / 2 - 0.5
    const cz = sz / 2 - 0.5
    const dist = Math.max(sx, sy, sz) * 2.1 + 3
    camera.position.set(cx + dist * 0.55, cy + dist * 0.5, cz + dist * 0.75)
    if (controls.current) {
      controls.current.target.set(cx, cy, cz)
      controls.current.update()
    }
  }
  return (
    <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} minDistance={2} maxDistance={90} />
  )
}

function BoardFrame({
  board,
  activeY,
  showLayerPlane,
}: {
  board: BoardState
  activeY: number
  showLayerPlane: boolean
}) {
  const { sx, sy, sz } = board
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(sx, sy, sz)), [sx, sy, sz])
  const floor = useMemo(() => {
    const pts: number[] = []
    for (let x = 0; x <= sx; x++) pts.push(x - 0.5, -0.5, -0.5, x - 0.5, -0.5, sz - 0.5)
    for (let z = 0; z <= sz; z++) pts.push(-0.5, -0.5, z - 0.5, sx - 0.5, -0.5, z - 0.5)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [sx, sz])

  return (
    <group>
      <lineSegments geometry={edges} position={[sx / 2 - 0.5, sy / 2 - 0.5, sz / 2 - 0.5]}>
        <lineBasicMaterial color="#46506a" />
      </lineSegments>
      <lineSegments geometry={floor}>
        <lineBasicMaterial color="#2e3650" transparent opacity={0.7} />
      </lineSegments>
      {/* active layer highlight plane (desktop layered mode only) */}
      {showLayerPlane && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[sx / 2 - 0.5, activeY - 0.5 + 0.002, sz / 2 - 0.5]}>
          <planeGeometry args={[sx, sz]} />
          <meshBasicMaterial color="#8b7bff" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

function PlacedCubes({
  cells,
  instRef,
  opacity,
}: {
  cells: { pos: [number, number, number]; color: string }[]
  instRef: React.MutableRefObject<any>
  opacity: number
}) {
  if (cells.length === 0) return null
  return (
    <Instances ref={instRef} limit={cells.length} range={cells.length}>
      <boxGeometry args={[CELL, CELL, CELL]} />
      {/* depthWrite off below full opacity so inner cubes show through outer ones */}
      <meshStandardMaterial
        roughness={0.4}
        metalness={0.05}
        transparent
        opacity={opacity}
        depthWrite={opacity >= 1}
      />
      {cells.map((c, i) => (
        <Instance key={i} position={c.pos} color={c.color} />
      ))}
    </Instances>
  )
}

function GhostCubes({ ghost }: { ghost: Ghost }) {
  if (ghost.cells.length === 0) return null
  const color = ghost.valid ? '#46d18a' : '#f0616d'
  return (
    <group>
      {ghost.cells.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[CELL, CELL, CELL]} />
          <meshStandardMaterial color={color} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Tap-to-place for touch / mobile. Listens to raw pointer events on the canvas
 * and only fires a tap when the pointer barely moved (so dragging to orbit the
 * camera never places a block). On a tap it raycasts against the floor plane and
 * the placed cubes:
 *   - hit a cube face → place across that face's normal (or remove the cube when
 *     nothing is selected);
 *   - hit the floor   → place on the floor (y = 0).
 */
function TapToPlace({
  board,
  cells,
  floorRef,
  instRef,
  hasActive,
  onPlace,
  onRemove,
}: {
  board: BoardState
  cells: { pos: [number, number, number]; color: string }[]
  floorRef: React.MutableRefObject<THREE.Mesh | null>
  instRef: React.MutableRefObject<any>
  hasActive: boolean
  onPlace: (target: Cell) => void
  onRemove: (cell: Cell) => void
}) {
  const { gl, camera, raycaster } = useThree()
  // Keep latest values without re-binding listeners every render.
  const state = useRef({ board, cells, hasActive, onPlace, onRemove })
  state.current = { board, cells, hasActive, onPlace, onRemove }

  useEffect(() => {
    const el = gl.domElement
    let down: { x: number; y: number; t: number } | null = null
    const pointers = new Set<number>()

    const onDown = (e: PointerEvent) => {
      pointers.add(e.pointerId)
      // A second finger (pinch / two-finger orbit) cancels any pending tap.
      down = pointers.size > 1 ? null : { x: e.clientX, y: e.clientY, t: e.timeStamp }
    }
    const onUp = (e: PointerEvent) => {
      const multi = pointers.size > 1
      pointers.delete(e.pointerId)
      const d = down
      down = null
      if (!d || multi) return
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y)
      if (moved > 8 || e.timeStamp - d.t > 700) return // drag / long-press → not a tap

      const { board: b, cells: cs, hasActive: act, onPlace: place, onRemove: remove } = state.current
      const rect = el.getBoundingClientRect()
      const ndc = {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      }
      raycaster.setFromCamera(ndc as THREE.Vector2, camera)

      const targets: THREE.Object3D[] = []
      if (instRef.current && cs.length) targets.push(instRef.current)
      if (floorRef.current) targets.push(floorRef.current)
      const hits = raycaster.intersectObjects(targets, true)
      if (!hits.length) return
      const hit = hits[0]

      if (hit.instanceId != null) {
        const cell = cs[hit.instanceId]?.pos
        if (!cell) return
        if (act) {
          const n = hit.face?.normal ?? new THREE.Vector3()
          const target: Cell = [
            cell[0] + Math.round(n.x),
            cell[1] + Math.round(n.y),
            cell[2] + Math.round(n.z),
          ]
          place(target)
        } else {
          remove([cell[0], cell[1], cell[2]])
        }
        return
      }
      // floor hit
      if (!act) return
      const x = Math.round(hit.point.x)
      const z = Math.round(hit.point.z)
      if (x < 0 || x >= b.sx || z < 0 || z >= b.sz) return
      place([x, 0, z])
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
    }
  }, [gl, camera, raycaster, floorRef, instRef])

  return null
}

export function CubeView3D({
  board,
  library,
  activeY,
  ghost,
  resetKey,
  opacity = 1,
  interactive = false,
  hasActive = false,
  onPlace,
  onRemove,
}: {
  board: BoardState
  library: Piece[]
  activeY: number
  ghost: Ghost
  resetKey: number
  /** Placed-cube opacity, 0.1–1. Below 1 the cubes turn see-through. */
  opacity?: number
  /** Enable touch tap-to-place (mobile). Desktop keeps the layered 2D workflow. */
  interactive?: boolean
  hasActive?: boolean
  onPlace?: (target: Cell) => void
  onRemove?: (cell: Cell) => void
}) {
  const instRef = useRef<any>(null)
  const floorRef = useRef<THREE.Mesh | null>(null)

  const cells = useMemo(() => {
    const owners = cellOwners(board, library)
    return [...owners.entries()].map(([k, v]) => {
      const [x, y, z] = k.split(',').map(Number)
      return { pos: [x, y, z] as [number, number, number], color: v.color }
    })
  }, [board, library])

  const { sx, sz } = board

  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 45, near: 0.1, far: 200, position: [10, 10, 14] }}>
      <color attach="background" args={['#0e0f18']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[8, 16, 10]} intensity={1.1} />
      <hemisphereLight args={['#aab2d6', '#26304a', 0.4]} />
      <CameraRig board={board} resetKey={resetKey} />
      <BoardFrame board={board} activeY={activeY} showLayerPlane={!interactive} />
      <PlacedCubes cells={cells} instRef={instRef} opacity={opacity} />
      <GhostCubes ghost={ghost} />
      {interactive && (
        <>
          {/* invisible floor pick-plane covering the board footprint */}
          <mesh
            ref={floorRef}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[sx / 2 - 0.5, -0.5, sz / 2 - 0.5]}
          >
            <planeGeometry args={[sx, sz]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <TapToPlace
            board={board}
            cells={cells}
            floorRef={floorRef}
            instRef={instRef}
            hasActive={hasActive}
            onPlace={onPlace ?? (() => {})}
            onRemove={onRemove ?? (() => {})}
          />
        </>
      )}
    </Canvas>
  )
}
