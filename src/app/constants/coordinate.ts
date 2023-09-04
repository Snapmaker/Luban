// From JobSetup.tsx


// legacy
export type Materials = {
    isRotate: boolean;
    diameter: number;
    length: number;
    x: number;
    y: number;
    z: number;
}

export type CoordinateMode = {
    label: string;
    value: string;
    setting: {
        sizeMultiplyFactor: {
            x: number;
            y: number;
        };
    };
};

/**
 * Workpiece Definitions.
 */
export enum WorkpieceShape {
    Rectangle,
    Cylinder,
}

export type RectangleWorkpieceSize = {
    x: number;
    y: number;

    // z is the thickness of workpiece, not strictly needed
    z?: number;
};

export type CylinderWorkpieceSize = {
    diameter: number;
    length: number;
};

export type Workpiece = {
    // shape of workpiece
    shape: WorkpieceShape;

    // dimensions of workpiece
    size: RectangleWorkpieceSize | CylinderWorkpieceSize;
};

/**
 * Help function that convert Materials to Workpiece.
 *
 * Remove this function when we migrated data from materials to workpiece.
 */
export function convertMaterialsToWorkpiece(materials: Materials): Workpiece {
    if (!materials.isRotate) {
        return {
            shape: WorkpieceShape.Rectangle,
            size: {
                x: materials.x,
                y: materials.y,
                z: materials.z,
            },
        };
    } else {
        return {
            shape: WorkpieceShape.Cylinder,
            size: {
                diameter: materials.diameter,
                length: materials.length,
            },
        };
    }
}

/**
 * Origin Definitions.
 */
export enum OriginType {
    Workpiece,
    Object,

    CNCLockingBlock,
}

export enum RectangleWorkpieceReference {
    Center = 'center',
    TopLeft = 'top-left',
    TopRight = 'top-right',
    BottomLeft = 'bottom-left',
    BottomRight = 'bottom-right',
}

export enum CylinderWorkpieceReference {
    FrontCenter = 'front-center', // <-- Center of front circle
    FrontTop = 'front-top', // <-- Top of front circle
}

export enum ObjectReference {
    Center = 'center',
    TopLeft = 'top-left',
    TopRight = 'top-right',
    BottomLeft = 'bottom-left',
    BottomRight = 'bottom-right',
}

export type OriginReference = RectangleWorkpieceReference | CylinderWorkpieceReference | ObjectReference;

export type OriginReferenceMetadata = {

};


export type Origin = {
    type: OriginType;
    reference: OriginReference;
    referenceMetadata: OriginReferenceMetadata;
};


export enum JobOffsetMode {
    Crosshair = 'Crosshair',
    LaserSpot = 'LaserSpot'
}
