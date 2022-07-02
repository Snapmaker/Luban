import { DATA_PREFIX } from '../constants';

class Size {
    public width: number;

    public height: number;

    public constructor(width = 0, height = 0) {
        this.width = width;
        this.height = height;
    }
}

class File {
    public name: string;

    public path: string;

    public size: Size;

    public constructor(name: string, width: number, height: number) {
        const filePath = this._generateRemotePath(name);
        this.name = name;
        this.path = filePath;
        this.size = new Size(width, height);
    }

    private _generateRemotePath(name: string): string {
        return name ? `${DATA_PREFIX}/${name}` : null;
    }

    public update(name: string, width?: number, height?: number) {
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
    public originalFile: File;

    /** record parsed file info, imported DXF and SVG files need to set this attribute */
    public parsedFile: File;

    /** record processed image file info, which will changed by resize and switch process mode */
    public processedFile: File;

    public setOriginalFile(name: string, width: number, height: number) {
        this.originalFile = new File(name, width, height);
    }

    public setParsedFile(name: string, width: number, height: number) {
        this.parsedFile = new File(name, width, height);
    }

    public setProcessedFile(name: string, width: number, height: number) {
        this.processedFile = new File(name, width, height);
    }
}
