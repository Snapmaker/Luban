import { DATA_PREFIX } from '../constants';

class Size {
    width: number;

    height: number;

    constructor(width: number = 0, height: number = 0) {
        this.width = width;
        this.height = height;
    }
}

class File {
    name: string;

    path: string;

    size: Size;

    constructor(name: string, width: number, height: number) {
        const filePath = this._generateRemotePath(name);
        this.name = name;
        this.path = filePath;
        this.size = new Size(width, height);
    }

    _generateRemotePath(name: string): string {
        return name ? `${DATA_PREFIX}/${name}` : null;
    }

    update(name: string, width?: number, height?: number) {
        const filePath = this._generateRemotePath(name);
        this.name = name;
        this.path = filePath;
        if (name) {
            this.size = new Size(
                width ?? this.size.width,
                height ?? this.size.height
            );
        } else {
            this.size = new Size();
        }
    }
}

export default class Resource {
    /** record uploaded file info, it should set only once, when SVGModel created */
    originalFile: File;

    /** record parsed file info, imported DXF and SVG files need to set this attribute */
    parsedFile: File;

    /** record processed image file info, which will changed by resize and switch process mode */
    processedFile: File;

    setOriginalFile(name: string, width: number, height: number) {
        this.originalFile = new File(name, width, height);
    }

    setParsedFile(name: string, width: number, height: number) {
        this.parsedFile = new File(name, width, height);
    }

    setProcessedFile(name: string, width: number, height: number) {
        this.processedFile = new File(name, width, height);
    }
}
