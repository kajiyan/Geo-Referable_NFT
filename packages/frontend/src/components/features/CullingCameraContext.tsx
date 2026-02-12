import { createContext } from 'react';
import * as THREE from 'three';

export const CullingCameraContext = createContext<THREE.Camera | null>(null);