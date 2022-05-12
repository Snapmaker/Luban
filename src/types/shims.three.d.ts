import { Box3, BufferGeometry, Mesh, Object3D } from 'three';

declare module 'three' {
    declare class MyObject3D extends Object3D {
        public uniformScalingState?: boolean;
        public shouldUpdateBoundingbox?: boolean;
        public geometry?: BufferGeometry;
        constructor();
    }
    declare class Group extends Object3D {
        public uniformScalingState?: boolean;
        public boundingBox?: Box3[];
        public shouldUpdateBoundingbox?: boolean

        public children: MyObject3D[]
        // THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial | THREE.MeshLambertMaterial> & { uniformScalingState?: boolean }
        // public children: (Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial | THREE.MeshLambertMaterial> & {
        //     uniformScalingState?: boolean;
        // })[];
        constructor();
    }
}
