import * as tar from 'tar';

export async function zipFolder(path, outputFileName) {
    if (path[0] === '.') {
        path = `${process.cwd()}/${path}`;
    }

    return tar.c(
        {
            cwd: path,
            gzip: true,
            file: `${path}/${outputFileName}`
        },
        ['.']
    );
}

export async function unzipFile(source, path) {
    if (path[0] === '.') {
        path = `${process.cwd()}/${path}`;
    }

    source = `${path}/${source}`;

    return tar.x({
        strip: 1,
        C: path,
        file: source
    });
}
