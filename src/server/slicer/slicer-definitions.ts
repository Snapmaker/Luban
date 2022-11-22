export type Metadata = {
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
    filamentLength?: number;
    filamentWeight?: number;
    printTime?: number;

    gcodeFilename: string;
    gcodeFileLength: number;
    gcodeFilePath: string;
    renderGcodeFileName: string;
}
