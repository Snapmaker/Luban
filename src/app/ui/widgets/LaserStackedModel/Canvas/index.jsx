import React, {
    useRef,
    useEffect,
    forwardRef,
    useImperativeHandle,
    useState
} from 'react';
import { useThree, Canvas, extend } from '@react-three/fiber';
import { Vector3, DoubleSide, NoToneMapping, LinearEncoding } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import PropType from 'prop-types';
import classNames from 'classnames';
import styles from './styles.styl';
import SvgIcon from '../../../components/SvgIcon';

extend({ OrbitControls });

const Controls = forwardRef((props, ref) => {
    const { camera, gl, setSize, invalidate } = useThree();
    const controls = useRef();
    const [directionalLightPosition, setDirectionalLightPosition] = useState([0, 0, 0]);
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
    // useFrame(() => controls.current.update());
    useEffect(() => {
        const handler = () => {
            const position = camera.position.clone().multiplyScalar(-1);
            setDirectionalLightPosition([position.x, position.y, position.z]);
            invalidate();
        };
        controls.current && controls.current.addEventListener('change', handler);
        return () => {
            controls.current && controls.current.removeEventListener('change', handler);
        };
    }, []);

    useEffect(() => {
        const containerWidth = 696;
        const containerHeight = 509;
        camera.aspect = containerWidth / containerHeight;
        camera.fov = 45;
        camera.near = 0.1;
        camera.far = 10000;
        gl.toneMapping = NoToneMapping;
        gl.outputEncoding = LinearEncoding;
        setSize(containerWidth, containerHeight);
    }, [setSize]);
    return (
        <>
            <orbitControls args={[camera, gl.domElement]} ref={controls} />
            <hemisphereLight args={[0xdddddd, 0x666666, 1]} position={[0, -1000, 0]} />
            <directionalLight args={[0x666666, 0.4]} position={directionalLightPosition} />
        </>
    );
});

const ModelViewer = React.memo(({ geometry }) => {
    const controlsRef = useRef();
    function toTopFrontRight() {
        if (controlsRef.current && geometry) {
            geometry.computeBoundingBox();
            const boxMax = geometry.boundingBox.max;
            const boxMin = geometry.boundingBox.min;
            const longestEdge = Math.max(boxMax.x - boxMin.x, boxMax.y - boxMin.y, boxMax.z - boxMin.z);
            controlsRef.current.toTopFrontRight(longestEdge);
        }
    }
    useEffect(() => {
        toTopFrontRight();
    }, [geometry]);
    return (
        <div>
            {geometry && (
                <Canvas frameloop="demand" onCreated={() => toTopFrontRight()} flat linear>
                    <Controls ref={controlsRef} />
                    <group rotation={[-Math.PI / 2, 0, 0]}>
                        <mesh position={[0, 0, 0]}>
                            {geometry ? <primitive object={geometry} attach="geometry" /> : null}
                            <meshPhongMaterial color={0xffffff} shininess={10} side={DoubleSide} />
                        </mesh>
                    </group>
                </Canvas>
            )}
            <div className={classNames(styles['view-controls'])}>
                <SvgIcon
                    name="ViewIsometric"
                    hoversize={14}
                    size={20}
                    onClick={toTopFrontRight}
                />
            </div>
        </div>
    );
});
ModelViewer.propTypes = {
    geometry: PropType.object
};

export default ModelViewer;
