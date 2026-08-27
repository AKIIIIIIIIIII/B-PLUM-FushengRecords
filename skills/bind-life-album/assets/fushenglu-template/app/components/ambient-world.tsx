"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Chapter } from "../album-types";

type AmbientWorldProps = { open: boolean; chapter: Chapter; progress: number };

export function createSeededRandom(seed = 0x46534c): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function AmbientWorld({ open, chapter, progress }: AmbientWorldProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const random = createSeededRandom();
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080806, 0.028);
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 240);
    camera.position.set(0, 3.8, 13);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const dark = new THREE.MeshStandardMaterial({ color: 0x040708, roughness: 0.9, metalness: 0.04 });
    const blueInk = new THREE.MeshStandardMaterial({ color: 0x071a29, roughness: 0.94, metalness: 0.02 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xb07a27, emissive: 0x4e2507, emissiveIntensity: 0.35, roughness: 0.48, metalness: 0.5 });
    scene.add(new THREE.HemisphereLight(0x9f7440, 0x020506, 1.35));
    const moon = new THREE.DirectionalLight(0xffc45e, 2.6);
    moon.position.set(-6, 10, 5);
    scene.add(moon);

    const pavilion = new THREE.Group();
    pavilion.add(new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.35, 4.6), dark));
    [-3.7, 3.7].forEach((x) => [-1.6, 1.6].forEach((z) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 3.8, 10), dark);
      pillar.position.set(x, 2, z);
      pavilion.add(pillar);
    }));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 1.35, 4), dark);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.58;
    roof.position.y = 4.55;
    pavilion.add(roof);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), gold);
    finial.position.y = 5.35;
    pavilion.add(finial);
    pavilion.position.set(0, -1.9, -9);
    scene.add(pavilion);

    const cliffs = new THREE.Group();
    [[-7.8, 0.5, -6, 2.8, 8.8, 2.5], [-10.2, -0.2, -18, 4.2, 11.5, 3.7], [8.6, 0.8, -10, 3.6, 9.6, 2.8], [11.4, -0.4, -24, 5.2, 13, 4.2]].forEach(([x, y, z, sx, sy, sz], index) => {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7, 1), index % 2 ? dark : blueInk);
      rock.position.set(x, y, z);
      rock.scale.set(sx, sy, sz);
      rock.rotation.set(index * 0.11, index * 0.31, index * -0.07);
      cliffs.add(rock);
    });
    scene.add(cliffs);

    const distantPeaks = new THREE.Group();
    for (let index = 0; index < 7; index += 1) {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(3.2 + (index % 3), 7 + (index % 2) * 2, 5), dark);
      peak.position.set(-18 + index * 6, -2.2, -39 - (index % 3) * 7);
      peak.rotation.y = index * 0.42;
      distantPeaks.add(peak);
    }
    scene.add(distantPeaks);

    const cloudGeometry = new THREE.BufferGeometry();
    const cloudPositions = new Float32Array(680 * 3);
    for (let index = 0; index < 680; index += 1) {
      cloudPositions[index * 3] = (random() - 0.5) * 42;
      cloudPositions[index * 3 + 1] = -2.4 + random() * 2.1;
      cloudPositions[index * 3 + 2] = -random() * 130 + 16;
    }
    cloudGeometry.setAttribute("position", new THREE.BufferAttribute(cloudPositions, 3));
    const cloudMaterial = new THREE.PointsMaterial({ color: 0xb3a287, size: 0.44, transparent: true, opacity: 0.19, depthWrite: false });
    const clouds = new THREE.Points(cloudGeometry, cloudMaterial);
    scene.add(clouds);

    const lights = new THREE.Group();
    for (let index = 0; index < 48; index += 1) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.035 + (index % 4) * 0.012, 8, 8), gold);
      orb.position.set((random() - 0.5) * 8, -0.2 + random() * 5, -8 - index * 4.2);
      lights.add(orb);
    }
    scene.add(lights);

    let animation = 0;
    const startedAt = performance.now();
    const render = () => {
      const time = (performance.now() - startedAt) / 1000;
      clouds.rotation.y = Math.sin(time * 0.055) * 0.035;
      clouds.position.x = Math.sin(time * 0.09) * 0.45;
      pavilion.position.y = -1.9 + Math.sin(time * 0.35) * 0.045;
      lights.children.forEach((light, index) => {
        const mesh = light as THREE.Mesh;
        mesh.scale.setScalar(0.75 + Math.sin(time * 1.1 + index) * 0.25);
      });
      renderer.render(scene, camera);
      animation = requestAnimationFrame(render);
    };
    render();

    const resize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener("resize", resize);
      cloudGeometry.dispose();
      cloudMaterial.dispose();
      dark.dispose();
      blueInk.dispose();
      gold.dispose();
      scene.traverse((object) => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const canvas = mountRef.current?.querySelector("canvas");
    if (!canvas) return;
    canvas.style.transform = chapter === "future" && open ? `scale(${1.02 + progress * 0.18}) translateY(${progress * 2}%)` : `scale(${open ? 1.05 : 1}) translateY(0)`;
  }, [open, chapter, progress]);

  return <div className="ambient-world absolute inset-0 -z-10" ref={mountRef} aria-hidden="true" />;
}
