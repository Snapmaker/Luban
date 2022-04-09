import { Mesh } from '../../../lib/MeshProcess/Mesh';
import sendMessage from '../utils/sendMessage';

const loadSize = ({ tempName, isRotate }) => {
    try {
        const { width, height } = Mesh.loadSize(`${process.env.Tmpdir}/${tempName}`, isRotate === 'true' || isRotate === true);

        sendMessage({ status: 'complete', width, height });
    } catch (error) {
        sendMessage({ status: 'fail', error });
    }
};
export default loadSize;
