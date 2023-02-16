import * as fs from 'fs-extra';

import logger from '../../logger';

const log = logger('util-fs');

interface CopyDirOptions {
    overwrite?: boolean;
}
/**
 * Copy files from srcDir to dstDir.
 */
export async function copyDir(srcDir: string, dstDir: string, options: CopyDirOptions = {}): Promise<void> {
    log.info(`Copying folder ${srcDir} to ${dstDir}`);

    if (typeof options.overwrite === 'undefined') {
        options.overwrite = true;
    }

    try {
        await fs.copy(srcDir, dstDir, options);
    } catch (e) {
        log.error(e);
    }
}
