import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BLOCK_PALETTE } from '../game/rules';

interface GameOverThreeStageProps {
  isVictory: boolean;
  score: number;
  linesCleared: number;
  maxCombo: number;
}

interface PhysicsBlock {
  group: THREE.Group;
  homePos: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  phase: number;
}

// Pre-allocated module-scope scratch objects (Zero-GC in animation loop)
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _targetCamPos = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createRoundedBlockGeometry(size = 0.72, depth = 0.52, radius = 0.12): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const half = size * 0.5;
  const r = Math.min(radius, half * 0.8);

  shape.moveTo(-half + r, -half);
  shape.lineTo(half - r, -half);
  shape.quadraticCurveTo(half, -half, half, -half + r);
  shape.lineTo(half, half - r);
  shape.quadraticCurveTo(half, half, half - r, half);
  shape.lineTo(-half + r, half);
  shape.quadraticCurveTo(-half, half, -half, half - r);
  shape.lineTo(-half, -half + r);
  shape.quadraticCurveTo(-half, -half, -half + r, -half);

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: depth,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.07,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

export const GameOverThreeStage: React.FC<GameOverThreeStageProps> = ({
  isVictory,
  score,
  linesCleared,
  maxCombo,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const impulseTriggerRef = useRef<(() => void) | null>(null);
  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();

    const width = Math.max(260, container.clientWidth || 380);
    const height = Math.max(160, container.clientHeight || 190);

    // 1. Scene, Fog & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141619);
    scene.fog = new THREE.FogExp2(0x141619, 0.055);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 60);
    camera.position.set(0, 2.7, 7.4);
    camera.lookAt(0, 0.25, 0);

    // 2. WebGLRenderer with ACESFilmicToneMapping & SRGBColorSpace
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Studio Environment Map (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // 4. Balanced 3-Point Warm/Cool Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0x8ecae6, 0x1b1f26, 1.1);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffe6c8, 2.3);
    keyLight.position.set(4.5, 7.5, 5.0);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 20;
      const d = 4.5;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(isVictory ? 0xe9a825 : 0xe06d53, 1.8);
    rimLight.position.set(-5.0, 3.0, -4.0);
    scene.add(rimLight);

    // 5. Composite Pedestal Base (4-Part Grounded THREE.Group)
    const stageRoot = new THREE.Group();
    scene.add(stageRoot);

    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(0, -1.15, 0);
    stageRoot.add(pedestalGroup);

    const plinthGeo = new THREE.CylinderGeometry(2.55, 2.85, 0.36, 8);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x1e232b,
      roughness: 0.78,
      metalness: 0.18,
    });
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.position.y = -0.18;
    plinthMesh.receiveShadow = !isSoftwareGl;
    pedestalGroup.add(plinthMesh);

    const rimRingGeo = new THREE.TorusGeometry(2.48, 0.055, 12, 32);
    rimRingGeo.rotateX(Math.PI * 0.5);
    const rimRingMat = new THREE.MeshStandardMaterial({
      color: isVictory ? 0xe9a825 : 0xe06d53,
      roughness: 0.25,
      metalness: 0.85,
    });
    const rimRingMesh = new THREE.Mesh(rimRingGeo, rimRingMat);
    rimRingMesh.position.y = 0.02;
    pedestalGroup.add(rimRingMesh);

    // Contact Shadow Disc (offset by +0.015 on Y to prevent Z-fighting)
    const shadowDiscGeo = new THREE.CircleGeometry(2.2, 32);
    shadowDiscGeo.rotateX(-Math.PI * 0.5);
    const shadowDiscMat = new THREE.MeshBasicMaterial({
      color: 0x090b0d,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const shadowDisc = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
    shadowDisc.position.y = 0.015;
    pedestalGroup.add(shadowDisc);

    // 6. Central Hero Monument + Physics-Driven Ceramic Polyomino Blocks (10-Part Composite Group)
    const blockGeo = createRoundedBlockGeometry(0.64, 0.48, 0.12);
    const capGeo = new THREE.BoxGeometry(0.42, 0.42, 0.08);
    const gemGeo = new THREE.OctahedronGeometry(0.22, 0);

    const paletteValues = Object.values(BLOCK_PALETTE);
    const blockMaterials = paletteValues.map(
      (p) =>
        new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(p.main),
          roughness: 0.22,
          metalness: 0.12,
          clearcoat: 0.65,
          clearcoatRoughness: 0.18,
        })
    );
    const capMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4f1ea,
      roughness: 0.55,
      metalness: 0.05,
    });
    const goldGemMaterial = new THREE.MeshStandardMaterial({
      color: 0xfad06c,
      emissive: isVictory ? 0x6b4800 : 0x2b1800,
      roughness: 0.15,
      metalness: 0.9,
    });

    const physicsBlocks: PhysicsBlock[] = [];
    const blockCount = 10;

    for (let i = 0; i < blockCount; i++) {
      const pieceGroup = new THREE.Group();

      // Primary silhouette: Bevelled Ceramic Block Body
      const mat = blockMaterials[i % blockMaterials.length];
      const bodyMesh = new THREE.Mesh(blockGeo, mat);
      bodyMesh.castShadow = !isSoftwareGl;
      bodyMesh.receiveShadow = !isSoftwareGl;
      pieceGroup.add(bodyMesh);

      // Secondary read: Tactile Top Inlay Bevel Cap
      const topCap = new THREE.Mesh(capGeo, capMaterial);
      topCap.position.z = 0.29;
      pieceGroup.add(topCap);

      // Accent detail: Embedded Golden Gem or Core Stud on alternating blocks
      if (i % 2 === 0 || isVictory) {
        const gemMesh = new THREE.Mesh(gemGeo, goldGemMaterial);
        gemMesh.position.z = 0.36;
        pieceGroup.add(gemMesh);
      }

      // Arrange home positions in an expressive 3D polyomino cluster well inside camera frustum
      const angle = (i / blockCount) * Math.PI * 2;
      const radius = 0.95 + (i % 2) * 0.42;
      const homeX = Math.cos(angle) * radius * 1.15;
      const homeY = -0.15 + (i % 3) * 0.52;
      const homeZ = Math.sin(angle) * radius * 0.75;

      const homePos = new THREE.Vector3(homeX, homeY, homeZ);
      const startPos = new THREE.Vector3(homeX * 0.35, homeY * 0.5, homeZ * 0.35);

      pieceGroup.position.copy(startPos);
      stageRoot.add(pieceGroup);

      physicsBlocks.push({
        group: pieceGroup,
        homePos,
        pos: startPos,
        vel: new THREE.Vector3(
          homeX * 1.65,
          1.35 + (i % 3) * 0.45,
          homeZ * 1.65
        ),
        rotVel: new THREE.Vector3(
          ((i % 3) - 1) * 2.8,
          ((i % 2) * 2 - 1) * 3.2,
          (((i + 1) % 3) - 1) * 2.4
        ),
        phase: i * 0.65,
      });
    }

    // 7. Central Emblem Core (Fractured Ruby Core on Defeat / Golden Crown Star on Victory)
    const coreGroup = new THREE.Group();
    coreGroup.position.set(0, 0.38, 0);
    stageRoot.add(coreGroup);

    const coreOuterGeo = new THREE.OctahedronGeometry(0.56, 0);
    const coreOuterMat = new THREE.MeshStandardMaterial({
      color: isVictory ? 0xe9a825 : 0xe06d53,
      emissive: isVictory ? 0x5c3d00 : 0x54180c,
      roughness: 0.18,
      metalness: 0.82,
    });
    const coreOuterMesh = new THREE.Mesh(coreOuterGeo, coreOuterMat);
    coreGroup.add(coreOuterMesh);

    const coreRingGeo = new THREE.TorusGeometry(0.92, 0.045, 10, 32);
    const coreRingMat = new THREE.MeshStandardMaterial({
      color: isVictory ? 0xfff0c2 : 0x2ab7ca,
      roughness: 0.25,
      metalness: 0.88,
    });
    const coreRingMesh = new THREE.Mesh(coreRingGeo, coreRingMat);
    coreRingMesh.rotation.x = Math.PI * 0.35;
    coreGroup.add(coreRingMesh);

    // 8. Orbiting Ceramic Shards (THREE.InstancedMesh > 20 instances)
    const shardCount = 32;
    const shardGeo = new THREE.OctahedronGeometry(0.1, 0);
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.65,
    });
    const shardInstanced = new THREE.InstancedMesh(shardGeo, shardMat, shardCount);
    shardInstanced.frustumCulled = false;

    const shardData: { radius: number; angle: number; speed: number; yOffset: number; scale: number }[] = [];
    for (let i = 0; i < shardCount; i++) {
      const p = paletteValues[i % paletteValues.length];
      _color.set(p.light);
      shardInstanced.setColorAt(i, _color);

      const radius = 1.55 + (i % 5) * 0.28;
      const angle = (i / shardCount) * Math.PI * 2;
      const speed = 0.55 + (i % 4) * 0.22;
      const yOffset = -0.55 + ((i * 7) % 16) * 0.12;
      const scale = 0.85 + ((i % 3) - 1) * 0.15;

      shardData.push({ radius, angle, speed, yOffset, scale });

      _dummy.position.set(Math.cos(angle) * radius, yOffset, Math.sin(angle) * radius);
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      shardInstanced.setMatrixAt(i, _dummy.matrix);
    }
    if (shardInstanced.instanceColor) shardInstanced.instanceColor.needsUpdate = true;
    shardInstanced.instanceMatrix.needsUpdate = true;
    shardInstanced.computeBoundingSphere();
    stageRoot.add(shardInstanced);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 9. Interactive Pointer Tilt & Shockwave Re-Blast Trigger
    let pointerNormX = 0;
    let pointerNormY = 0;
    let elapsed = 0;
    let blastAge = 0;

    const triggerShockwave = () => {
      blastAge = 0;
      physicsBlocks.forEach((b, idx) => {
        b.pos.set(b.homePos.x * 0.4, b.homePos.y * 0.5, b.homePos.z * 0.4);
        b.vel.set(
          b.homePos.x * 1.75,
          1.45 + (idx % 3) * 0.45,
          b.homePos.z * 1.75
        );
        b.rotVel.set(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6
        );
      });
      setPulseCount((c) => c + 1);
    };
    impulseTriggerRef.current = triggerShockwave;

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerNormX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNormY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };
    container.addEventListener('pointermove', onPointerMove);

    // 10. Animation Loop with Software-WebGL afterDraw(tick) Fence Pacing
    let frameId = 0;
    let destroyed = false;
    let prevTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (destroyed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function stepSimulation(dt: number) {
      elapsed += dt;
      blastAge += dt;

      // Smooth camera parallax via exponential damping
      _targetCamPos.set(pointerNormX * 1.1, 2.6 + pointerNormY * 0.45, 7.4);
      camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 4.5, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 4.5, dt);
      camera.lookAt(0, 0.2, 0);

      // Rotate central core & ring
      coreOuterMesh.rotation.y += dt * (isVictory ? 1.8 : 1.1);
      coreOuterMesh.rotation.x += dt * 0.7;
      coreRingMesh.rotation.z -= dt * 1.2;
      const coreScale = 1 + Math.sin(elapsed * 3.8) * 0.08;
      coreOuterMesh.scale.setScalar(coreScale);

      // Update physics-driven 3D ceramic blocks:
      // Phase 1 (0..0.95s): Explosive shatter & floor bounce
      // Phase 2 (0.95s+): Magnetic spring re-assembly into floating orbital constellation
      const floorY = -0.74;
      for (let i = 0; i < physicsBlocks.length; i++) {
        const b = physicsBlocks[i];
        if (blastAge < 0.95) {
          b.vel.y -= 8.5 * dt;
          b.pos.addScaledVector(b.vel, dt);

          if (b.pos.y < floorY) {
            b.pos.y = floorY;
            b.vel.y = Math.abs(b.vel.y) * 0.55;
            b.vel.x *= 0.82;
            b.vel.z *= 0.82;
          }

          b.group.position.copy(b.pos);
          b.group.rotation.x += b.rotVel.x * dt;
          b.group.rotation.y += b.rotVel.y * dt;
          b.group.rotation.z += b.rotVel.z * dt;
        } else {
          // Orbital float around home position with spring damping
          const hoverY = b.homePos.y + Math.sin(elapsed * 2.4 + b.phase) * 0.16;
          const hoverX = b.homePos.x + Math.cos(elapsed * 1.5 + b.phase) * 0.1;
          const hoverZ = b.homePos.z + Math.sin(elapsed * 1.7 + b.phase) * 0.1;

          b.pos.x = THREE.MathUtils.damp(b.pos.x, hoverX, 4.5, dt);
          b.pos.y = THREE.MathUtils.damp(b.pos.y, hoverY, 4.5, dt);
          b.pos.z = THREE.MathUtils.damp(b.pos.z, hoverZ, 4.5, dt);

          b.group.position.copy(b.pos);
          b.group.rotation.x = THREE.MathUtils.damp(
            b.group.rotation.x,
            Math.sin(elapsed * 1.2 + b.phase) * 0.35,
            3.5,
            dt
          );
          b.group.rotation.y += dt * 0.65;
          b.group.rotation.z = THREE.MathUtils.damp(
            b.group.rotation.z,
            Math.cos(elapsed * 1.1 + b.phase) * 0.25,
            3.5,
            dt
          );
        }
      }

      // Slowly rotate entire stage and update instanced shards
      stageRoot.rotation.y = Math.sin(elapsed * 0.45) * 0.28 + pointerNormX * 0.22;

      for (let i = 0; i < shardCount; i++) {
        const s = shardData[i];
        const a = s.angle + elapsed * s.speed;
        const y = s.yOffset + Math.sin(elapsed * 2.2 + i) * 0.14;
        _dummy.position.set(Math.cos(a) * s.radius, y, Math.sin(a) * s.radius);
        _dummy.rotation.set(elapsed * 1.5 + i, elapsed * 1.1, i);
        _dummy.scale.setScalar(s.scale);
        _dummy.updateMatrix();
        shardInstanced.setMatrixAt(i, _dummy.matrix);
      }
      shardInstanced.instanceMatrix.needsUpdate = true;
    }

    // Advance initial 0.45s so the first rendered frame shows rich mid-air 3D shatter & blocks
    stepSimulation(0.45);
    renderer.render(scene, camera);

    const resizeObserver = new ResizeObserver(() => {
      if (destroyed) return;
      const w = Math.max(240, container.clientWidth);
      const h = Math.max(150, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    });
    resizeObserver.observe(container);

    function tick() {
      if (destroyed) return;
      const now = performance.now();
      const rawDt = (now - prevTime) / 1000;
      prevTime = now;
      const dt = Math.min(Math.max(rawDt, 0.008), 0.05);

      stepSimulation(dt);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      destroyed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointermove', onPointerMove);

      blockGeo.dispose();
      capGeo.dispose();
      gemGeo.dispose();
      plinthGeo.dispose();
      rimRingGeo.dispose();
      shadowDiscGeo.dispose();
      coreOuterGeo.dispose();
      coreRingGeo.dispose();
      shardGeo.dispose();

      blockMaterials.forEach((m) => m.dispose());
      capMaterial.dispose();
      goldGemMaterial.dispose();
      plinthMat.dispose();
      rimRingMat.dispose();
      shadowDiscMat.dispose();
      coreOuterMat.dispose();
      coreRingMat.dispose();
      shardMat.dispose();
      envTex.dispose();

      renderer.dispose();
    };
  }, [isVictory]);

  return (
    <div className="relative w-full h-44 sm:h-48 rounded-xl overflow-hidden bg-[#141619] border border-[#F4F1EA]/12 select-none">
      {/* Isolated Three.js WebGL Mount Container */}
      <div
        ref={mountRef}
        data-testid="gameover-three-stage"
        onClick={() => impulseTriggerRef.current?.()}
        className="w-full h-full cursor-pointer"
        role="button"
        tabIndex={-1}
        aria-label="Animasi 3D Blok Hancur — Ketuk untuk Efek Ledakan 3D"
      />

      {/* Unboxed Overlay Caption & Interactive 3D Trigger Affordance */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-[#141619] via-[#141619]/65 to-transparent flex items-center justify-between gap-2 text-[11px] font-mono text-[#A39E93] whitespace-nowrap">
        <span className="text-[#F4F1EA]/90 font-bold truncate">
          {isVictory ? 'MONUMEN MAHKOTA 3D' : `ARENA 3D · ${linesCleared} GARIS · ${maxCombo}×`}
        </span>
        <span className="text-[#E9A825] shrink-0">
          {pulseCount > 0 ? `Ledakan #${pulseCount + 1}` : `Skor ${Math.round(score)} · Ketuk 3D`}
        </span>
      </div>
    </div>
  );
};
