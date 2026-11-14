import { Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import { SRGBColorSpace, Vector2, type Mesh } from "three";

type MoonSceneProps = {
  /** Called once the textures have loaded and the first frame is drawn. */
  onReady: () => void;
};

const MOON_RADIUS = 1.75;
/** Radians per second: one turn takes about four minutes, slow enough to feel heavy. */
const SPIN_SPEED = 0.026;
/** Tip the south pole toward the viewer, since that is where Lunar Skyline looks. */
const SOUTH_POLE_TILT = -0.42;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Large screens get 4K textures; phones and small windows get 2K. */
function textureSize(): "4k" | "2k" {
  if (typeof window === "undefined") return "2k";
  return window.innerWidth * Math.min(window.devicePixelRatio, 2) >= 1800 ? "4k" : "2k";
}

/**
 * The Moon: NASA LRO colour mosaic with a normal map built from LOLA elevation,
 * lit by a single hard Sun so the terminator shows the relief.
 */
function Moon({ onReady }: MoonSceneProps) {
  const size = useMemo(textureSize, []);
  const [color, normal] = useTexture([`/moon/moon-color-${size}.jpg`, `/moon/moon-normal-${size}.jpg`]);
  const spinRef = useRef<Mesh>(null);
  const gl = useThree((state) => state.gl);
  const still = useMemo(prefersReducedMotion, []);

  useEffect(() => {
    color.colorSpace = SRGBColorSpace;
    const anisotropy = gl.capabilities.getMaxAnisotropy();
    color.anisotropy = anisotropy;
    normal.anisotropy = anisotropy;
    color.needsUpdate = true;
    onReady();
  }, [color, normal, gl, onReady]);

  useFrame((_, delta) => {
    if (!still && spinRef.current) spinRef.current.rotation.y += delta * SPIN_SPEED;
  });

  return (
    <mesh ref={spinRef} rotation={[0, -1.2, 0]}>
      <sphereGeometry args={[MOON_RADIUS, 192, 192]} />
      <meshStandardMaterial
        map={color}
        normalMap={normal}
        normalScale={new Vector2(1.4, 1.4)}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

/** Keeps the Moon on the right of wide screens and low in the frame on tall ones. */
function Placement({ children }: { children: ReactNode }) {
  const { viewport } = useThree();
  const wide = viewport.aspect > 1.1;
  const x = wide ? Math.min(viewport.width * 0.24, 2.2) : 0;
  const y = wide ? -0.1 : -viewport.height * 0.2;
  return (
    <group position={[x, y, 0]} rotation={[SOUTH_POLE_TILT, 0, 0.12]}>
      {children}
    </group>
  );
}

/** Full-bleed WebGL background for the hero. Drag to turn the Moon; zoom and pan are off. */
export default function MoonScene({ onReady }: MoonSceneProps) {
  return (
    <Canvas
      className="moon-canvas"
      dpr={[1, 2]}
      camera={{ position: [0, 0, 7], fov: 32 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#000"]} />
      {/* The Sun: one hard light from the right, grazing the limb. */}
      <directionalLight position={[6, 1.2, 1.6]} intensity={3.2} />
      {/* Earthshine: a faint cool fill so the night side is not pure black. */}
      <ambientLight color="#9fb4ff" intensity={0.035} />
      <Stars radius={90} depth={40} count={3000} factor={3} saturation={0} fade speed={0.3} />
      <Suspense fallback={null}>
        <Placement>
          <Moon onReady={onReady} />
        </Placement>
      </Suspense>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.45}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.8}
      />
    </Canvas>
  );
}
