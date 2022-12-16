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
    public filamentLength?: number;
    public filamentWeight?: number;
    public printTime: number = 3600;

    public gcodeFilename: string;
    public gcodeFileLength: number;
    public gcodeFilePath: string;
    public renderGcodeFileName: string;
}
