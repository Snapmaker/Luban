import React, {
    useRef,
    useEffect,
    forwardRef,
    useImperativeHandle
} from 'react';
import { useThree, Canvas, extend, useFrame } from '@react-three/fiber';
import { Vector3, DoubleSide } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import PropType from 'prop-types';
import classNames from 'classnames';
import styles from './styles.styl';
import SvgIcon from '../../../components/SvgIcon';

extend({ OrbitControls });

const Controls = forwardRef((props, ref) => {
    const { camera, gl, setSize, invalidate } = useThree();
    const controls = useRef();
    useImperativeHandle(ref, () => ({
        toTopFrontRight: (longestEdge) => {
            if (camera && controls.current) {
                // adjust camera position based on a 200x200x200 BoxGeometry
                camera.position.x = 150 * longestEdge / 200;
                camera.position.y = 150 * longestEdge / 200;
                camera.position.z = 380 * longestEdge / 200;
                controls.current.target.copy(new Vector3(0, 0, 0));
                controls.current.update();
            }
        }
    }));
    useFrame(() => controls.current.update());
    useEffect(() => controls.current.addEventListener('change', invalidate), []);

    useEffect(() => {
        const containerWidth = 696;
        const containerHeight = 509;
        camera.aspect = containerWidth / containerHeight;
        camera.fov = 45;
        camera.near = 0.1;
        camera.far = 10000;
        setSize(containerWidth, containerHeight);
    }, [setSize]);
    return <orbitControls args={[camera, gl.domElement]} ref={controls} />;
});

const ModelViewer = React.memo(({ geometry, coordinateSize }) => {
    const controlsRef = useRef();
    const lightRef = useRef();
    function toTopFrontRight() {
        if (controlsRef.current && geometry) {
            geometry.computeBoundingBox();
            const boxMax = geometry.boundingBox.max;
            const boxMin = geometry.boundingBox.min;
            const longestEdge = Math.max(boxMax.x - boxMin.x, boxMax.y - boxMin.y, boxMax.z - boxMin.z);
            controlsRef.current.toTopFrontRight(longestEdge);
            lightRef.current.position.copy(new Vector3(0, -coordinateSize.z / 2, Math.max(coordinateSize.x, coordinateSize.y, coordinateSize.z) * 2));
        }
    }
    useEffect(() => {
        toTopFrontRight();
    }, [geometry]);
    return (
        <div>
            {geometry && (
                <Canvas frameloop="demand" onCreated={() => toTopFrontRight()}>
                    <Controls ref={controlsRef} />
                    <group rotation={[-Math.PI / 2, 0, 0]}>
                        {/* <gridHelper args={[100, 100]} /> */}
                        {/* <axesHelper args={[200]} /> */}
                        <mesh position={[0, 0, 0]}>
                            {geometry ? <primitive object={geometry} attach="geometry" /> : null}
                            <meshPhongMaterial color={0xffffff} shininess={10} side={DoubleSide} />
                        </mesh>
                    </group>
                    <hemisphereLight color={0xdddddd} groundColor={0x666666} position={[0, -1000, 0]} />
                    <directionalLight ref={lightRef} color={0x666666} intensity={0.4} />
                </Canvas>
            )}
            <div className={classNames(styles['view-controls'])}>
                <SvgIcon
                    name="ViewIsometric"
                    hoversize={14}
                    size={18}
                    onClick={toTopFrontRight}
                />
            </div>
        </div>
    );
});
ModelViewer.propTypes = {
    geometry: PropType.object,
    coordinateSize: PropType.object
};

export default ModelViewer;
