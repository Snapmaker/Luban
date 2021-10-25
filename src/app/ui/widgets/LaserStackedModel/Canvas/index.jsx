import React, {
    useRef,
    useEffect,
    forwardRef,
    useImperativeHandle,
    useState
} from 'react';
import { /* render, unmountComponentAtNode, */ useThree, Canvas } from '@react-three/fiber';
import { Vector3, DoubleSide } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import PropType from 'prop-types';
import classNames from 'classnames';
import styles from './styles.styl';
import SvgIcon from '../../../components/SvgIcon';

const Controls = forwardRef((props, ref) => {
    const { camera, gl, size } = useThree();
    console.log(size);
    const [controls] = useState(() => {
        const orbitControls = new OrbitControls(camera, gl.domElement);
        orbitControls.enableDamping = false;
        return orbitControls;
    });
    useImperativeHandle(ref, () => ({
        toTopFrontRight: (longestEdge) => {
            if (camera && controls) {
                // adjust camera position based on a 200x200x200 BoxGeometry
                camera.position.x = 150 * longestEdge / 200;
                camera.position.y = 150 * longestEdge / 200;
                camera.position.z = 380 * longestEdge / 200;
                controls.target.copy(new Vector3(0, 0, 0));
                controls.update();
            }
        }
    }));
    useEffect(() => {
        console.log(size);
        gl.setSize(190, 190, true);
        // return () => {
        //     controls.dispose();
        // };
    }, [gl]);
    return null;
});
console.log(Controls);

const ModelViewer = React.memo(({ geometry, coordinateSize }) => {
    const controlsRef = useRef();
    // const { camera, gl } = useThree();
    // console.log(camera, gl);
    // const canvasRef = useRef();
    const lightRef = useRef();
    const actions = {
        toTopFrontRight: () => {
            if (controlsRef.current && geometry) {
                geometry.computeBoundingBox();
                const boxMax = geometry.boundingBox.max;
                const boxMin = geometry.boundingBox.min;
                const longestEdge = Math.max(boxMax.x - boxMin.x, boxMax.y - boxMin.y, boxMax.z - boxMin.z);
                controlsRef.current.toTopFrontRight(longestEdge);
                lightRef.current.position.copy(new Vector3(0, -coordinateSize.z / 2, Math.max(coordinateSize.x, coordinateSize.y, coordinateSize.z) * 2));
            }
        },
        onCreated: () => {
            actions.toTopFrontRight();
        }
    };
    // useEffect(() => {
    //     if (geometry && canvasRef.current) {
    //         const node = (
    //             <group>
    //                 <group rotation={[-Math.PI / 2, 0, 0]}>
    //                     {/* <Controls ref={controlsRef} /> */}
    //                     {/* <gridHelper args={[100, 100]} /> */}
    //                     {/* <axesHelper args={[200]} /> */}
    //                     <mesh position={[0, 0, 0]}>
    //                         {geometry ? <primitive object={geometry} attach="geometry" /> : null}
    //                         <meshPhongMaterial color={0xffffff} shininess={10} side={DoubleSide} />
    //                     </mesh>
    //                 </group>
    //                 <hemisphereLight color={0xdddddd} groundColor={0x666666} position={[0, -1000, 0]} />
    //                 <directionalLight ref={lightRef} color={0x666666} intensity={0.4} />
    //             </group>
    //         );
    //         // three/fiber <Canvas> along with <Modal> shown doesn't have correct width and height, so use the render method instead of <Canvas>
    //         // notice: onCreated only execute once, next render method call will not trigger it, so manually call actions.toTopFrontRight() is necessary
    //         render(node, canvasRef.current, { frameloop: 'demand', camera: { fov: 45, far: 10000, near: 0.1, aspect: 1 }, onCreated: actions.onCreated, current: { concurrent: false } });
    //         actions.toTopFrontRight();
    //     }
    // }, [geometry]);
    // useEffect(() => {
    //     return () => {
    //         unmountComponentAtNode(canvasRef.current);
    //     };
    // }, []);
    return (
        <div style={{ width: '196px', height: '196px' }}>
            {/* <canvas ref={canvasRef} width="196" height="196" /> */}
            <Canvas>
                <group>
                    <group rotation={[-Math.PI / 2, 0, 0]}>
                        <Controls ref={controlsRef} />
                        {/* <gridHelper args={[100, 100]} /> */}
                        {/* <axesHelper args={[200]} /> */}
                        <mesh position={[0, 0, 0]}>
                            {geometry ? <primitive object={geometry} attach="geometry" /> : null}
                            <meshPhongMaterial color={0xffffff} shininess={10} side={DoubleSide} />
                        </mesh>
                    </group>
                    <hemisphereLight color={0xdddddd} groundColor={0x666666} position={[0, -1000, 0]} />
                    <directionalLight ref={lightRef} color={0x666666} intensity={0.4} />
                </group>
            </Canvas>
            <div className={classNames(styles['view-controls'])}>
                <SvgIcon
                    name="ViewIsometric"
                    hoversize={14}
                    size={12}
                    onClick={actions.toTopFrontRight}
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
