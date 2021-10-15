class Size {
    width: number;

    height: number;

    constructor(width: number = 0, height: number = 0) {
        this.width = width;
        this.height = height;
    }
}

class File {
    path: string;

    size: Size;

    constructor(filePath: string, width: number, height: number) {
        this.path = filePath;
        this.size = new Size(width, height);
    }
}

export default class Resource {
    originalFile: File;

    parsedFile: File;

    setOriginalFile(filePath: string, width: number, height: number) {
        this.originalFile = new File(filePath, width, height);
    }

    setParsedFile(filePath: string, width: number, height: number) {
        this.parsedFile = new File(filePath, width, height);
    }
}
