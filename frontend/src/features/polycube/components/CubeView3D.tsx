import { useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Instances, Instance } from '@react-three/drei'
import * as THREE from 'three'
import { cellOwners, type BoardState, type Piece } from '../lib/polycubeEngine'

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

function BoardFrame({ board, activeY }: { board: BoardState; activeY: number }) {
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
      {/* active layer highlight plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[sx / 2 - 0.5, activeY - 0.5 + 0.002, sz / 2 - 0.5]}>
        <planeGeometry args={[sx, sz]} />
        <meshBasicMaterial color="#8b7bff" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

function PlacedCubes({ cells }: { cells: { pos: [number, number, number]; color: string }[] }) {
  if (cells.length === 0) return null
  return (
    <Instances limit={cells.length} range={cells.length}>
      <boxGeometry args={[CELL, CELL, CELL]} />
      <meshStandardMaterial roughness={0.4} metalness={0.05} />
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

export function CubeView3D({
  board,
  library,
  activeY,
  ghost,
  resetKey,
}: {
  board: BoardState
  library: Piece[]
  activeY: number
  ghost: Ghost
  resetKey: number
}) {
  const cells = useMemo(() => {
    const owners = cellOwners(board, library)
    return [...owners.entries()].map(([k, v]) => {
      const [x, y, z] = k.split(',').map(Number)
      return { pos: [x, y, z] as [number, number, number], color: v.color }
    })
  }, [board, library])

  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 45, near: 0.1, far: 200, position: [10, 10, 14] }}>
      <color attach="background" args={['#0e0f18']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[8, 16, 10]} intensity={1.1} />
      <hemisphereLight args={['#aab2d6', '#26304a', 0.4]} />
      <CameraRig board={board} resetKey={resetKey} />
      <BoardFrame board={board} activeY={activeY} />
      <PlacedCubes cells={cells} />
      <GhostCubes ghost={ghost} />
    </Canvas>
  )
}
