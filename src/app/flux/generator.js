import * as THREE from 'three';
import GcodeGenerator from '../widgets/GcodeGenerator';
import ToolPathRenderer from '../lib/renderer/ToolPathRenderer';

const generateGcodeStr = (toolPathObj, gcodeConfig) => {
    const gcodeGenerator = new GcodeGenerator();
    const gcodeStr = gcodeGenerator.parseToolPathObjToGcode(toolPathObj, gcodeConfig);
    return gcodeStr;
};

const generateImageObject3D = (imageSrc, width, height, anchor) => {
    if (!imageSrc || !width || !height || !anchor) {
        return null;
    }
    const geometry = new THREE.PlaneGeometry(width, height);
    const texture = new THREE.TextureLoader().load(imageSrc);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        opacity: 0.75,
        transparent: true
    });
    const object3D = new THREE.Mesh(geometry, material);
    let position = new THREE.Vector3(0, 0, 0);
    switch (anchor) {
        case 'Center':
            position = new THREE.Vector3(0, 0, 0);
            break;
        case 'Center Left':
            position = new THREE.Vector3(width / 2, 0, 0);
            break;
        case 'Center Right':
            position = new THREE.Vector3(-width / 2, 0, 0);
            break;
        case 'Bottom Left':
            position = new THREE.Vector3(width / 2, height / 2, 0);
            break;
        case 'Bottom Middle':
            position = new THREE.Vector3(0, height / 2, 0);
            break;
        case 'Bottom Right':
            position = new THREE.Vector3(-width / 2, height / 2, 0);
            break;
        case 'Top Left':
            position = new THREE.Vector3(width / 2, -height / 2, 0);
            break;
        case 'Top Middle':
            position = new THREE.Vector3(0, -height / 2, 0);
            break;
        case 'Top Right':
            position = new THREE.Vector3(-width / 2, -height / 2, 0);
            break;
        default:
            break;
    }
    object3D.position.copy(position);
    return object3D;
};

const generateToolPathObject3D = (toolPath) => {
    const toolPathRenderer = new ToolPathRenderer(toolPath);
    return toolPathRenderer.render();
};

export { generateGcodeStr, generateToolPathObject3D, generateImageObject3D };
