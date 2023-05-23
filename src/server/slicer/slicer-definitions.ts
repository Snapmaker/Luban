export type Metadata = {
    printMode: string,
    originalName?: string;
    thumbnail?: string;
    series: string;
    printingToolhead: string;
    material0: string;
    material1: string;
    boundingBox?: { min, max };
    layerCount: number;
    renderGcodeFileName: string;
}

export class SliceResult {
    public filamentLength?: Array<number>;
    public filamentWeight?: Array<number>;
    public printTime: number = 0;

    public gcodeFilename: string;
    public gcodeFileLength: number;
    public gcodeFilePath: string;
    public renderGcodeFileName: string;
}

export class SliceProgress {
    public progressStatus: number = 0;
    public progress: number = 0;
    public layers: number = 0;
    public layer: number = 0;
}
