import { Mesh } from '../../../lib/MeshProcess/Mesh';
import sendMessage from '../utils/sendMessage';

const loadSize = ({ tempName, isRotate }, tmpDir) => {
    const { width, height } = Mesh.loadSize(`${tmpDir}/${tempName}`, isRotate === 'true' || isRotate === true);

    sendMessage({ status: 'complete', width, height });
};
export default loadSize;
