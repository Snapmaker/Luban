import path from 'path';
import { controller } from '../../lib/controller';


declare interface MeshInfo {
    uploadName: string;

    isGroup: boolean;
}

/**
 * Check integrity of meshes.
 *
 * Note that this function is not an action actually.
 */
export const checkMeshes = async (meshInfos: MeshInfo[]) => {
    const checkResultMap = new Map();

    for (const meshInfo of meshInfos) {
        // Ignore group
        if (meshInfo.isGroup) {
            continue;
        }

        // Ignore other extensions
        const ext = path.extname(meshInfo.uploadName);
        if (!['.obj', '.stl'].includes(ext)) {
            continue;
        }

        // Ignore prime tower (it's virtual mesh)
        if (meshInfo.uploadName.indexOf('prime_tower_') === 0) {
            continue;
        }

        await new Promise((resolve) => {
            return controller.checkModel({
                uploadName: meshInfo.uploadName
            }, (data) => {
                if (data.type === 'error') {
                    checkResultMap.set(meshInfo.uploadName, {
                        isDamage: true,
                    });
                    resolve(true);
                } else if (data.type === 'success') {
                    checkResultMap.set(meshInfo.uploadName, {
                        isDamage: false,
                    });
                    resolve(true);
                }
            });
        });
    }

    return checkResultMap;
};

export default {
};
