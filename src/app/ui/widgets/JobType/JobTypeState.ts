

type CoordinateMode = {
    label: string;
    value: string;
    setting: {
        sizeMultiplyFactor: {
            x: number;
            y: number;
        };
    };
};

type CoordinateSize = {
    x: number;
    y: number;
}

type Materials = {
    isRotate: boolean;
    diameter: number;
    length: number;
    x: number;
    y: number;
    z: number;
}