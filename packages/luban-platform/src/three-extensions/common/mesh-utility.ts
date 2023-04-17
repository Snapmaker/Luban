import * as THREE from 'three';

import log from '../../lib/log';

/**
 * Check if the mesh's geometry has any faces
 */
export function isFaceless(mesh: THREE.Mesh): boolean {
    const geometry = mesh.geometry;

    if (geometry instanceof THREE.BufferGeometry) {
        // If the geometry is BufferGeometry, check the index attribute
        if (geometry.index !== null) {
            return geometry.index.count === 0;
        } else {
            // If index is null, check the position attribute for at least 3 vertices (9 components)
            const positionAttribute = geometry.getAttribute('position');
            return positionAttribute === null || positionAttribute.count < 3;
        }
    }

    // If the geometry is Geometry, check the faces array
    if (geometry instanceof THREE.Geometry) {
        return geometry.faces.length === 0;
    }

    return false;
}

export function checkSceneFaceless(scene: THREE.Scene): void {
    const facelessObjects = [];
    scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            if (isFaceless(child)) {
                facelessObjects.push(child);
            }
        }
    });

    if (facelessObjects.length > 0) {
        log.warn('Faceless objects:', facelessObjects);
    }
}
