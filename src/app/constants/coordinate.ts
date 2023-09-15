import i18n from '../lib/i18n';
import {
    COORDINATE_MODE_BOTTOM_CENTER,
    COORDINATE_MODE_BOTTOM_LEFT,
    COORDINATE_MODE_BOTTOM_RIGHT,
    COORDINATE_MODE_CENTER,
    COORDINATE_MODE_TOP_LEFT,
    COORDINATE_MODE_TOP_RIGHT,
} from './index';


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


export type OriginTypeOption = {
    value: OriginType;
    label: string;
};

export function getOriginTypeOptions(workpieceShape: WorkpieceShape): OriginTypeOption[] {
    if (workpieceShape === WorkpieceShape.Rectangle) {
        return [
            {
                value: OriginType.Workpiece,
                label: i18n._('key-Term/Workpiece'),
            },
            {
                value: OriginType.Object,
                label: i18n._('key-Term/Object'),
            },
        ];
    } else {
        return [
            {
                value: OriginType.Workpiece,
                label: i18n._('key-Term/Workpiece'),
            },
        ];
    }
}

export function getOriginReferenceOptions(workpieceShape: WorkpieceShape, originType: OriginType = OriginType.Workpiece) {
    if (workpieceShape === WorkpieceShape.Rectangle) {
        if (originType === OriginType.Workpiece) {
            return [
                {
                    label: i18n._(COORDINATE_MODE_CENTER.label),
                    value: COORDINATE_MODE_CENTER.value,
                    mode: COORDINATE_MODE_CENTER
                },
                {
                    label: i18n._(COORDINATE_MODE_BOTTOM_LEFT.label),
                    value: COORDINATE_MODE_BOTTOM_LEFT.value,
                    mode: COORDINATE_MODE_BOTTOM_LEFT
                },
                {
                    label: i18n._(COORDINATE_MODE_BOTTOM_RIGHT.label),
                    value: COORDINATE_MODE_BOTTOM_RIGHT.value,
                    mode: COORDINATE_MODE_BOTTOM_RIGHT
                },
                {
                    label: i18n._(COORDINATE_MODE_TOP_LEFT.label),
                    value: COORDINATE_MODE_TOP_LEFT.value,
                    mode: COORDINATE_MODE_TOP_LEFT
                },
                {
                    label: i18n._(COORDINATE_MODE_TOP_RIGHT.label),
                    value: COORDINATE_MODE_TOP_RIGHT.value,
                    mode: COORDINATE_MODE_TOP_RIGHT
                }
            ];
        } else if (originType === OriginType.Object) {
            return [
                {
                    label: i18n._(COORDINATE_MODE_CENTER.label),
                    value: COORDINATE_MODE_CENTER.value,
                    mode: COORDINATE_MODE_CENTER
                },
                {
                    label: i18n._(COORDINATE_MODE_BOTTOM_LEFT.label),
                    value: COORDINATE_MODE_BOTTOM_LEFT.value,
                    mode: COORDINATE_MODE_BOTTOM_LEFT
                },
                {
                    label: i18n._(COORDINATE_MODE_BOTTOM_RIGHT.label),
                    value: COORDINATE_MODE_BOTTOM_RIGHT.value,
                    mode: COORDINATE_MODE_BOTTOM_RIGHT
                },
                {
                    label: i18n._(COORDINATE_MODE_TOP_LEFT.label),
                    value: COORDINATE_MODE_TOP_LEFT.value,
                    mode: COORDINATE_MODE_TOP_LEFT
                },
                {
                    label: i18n._(COORDINATE_MODE_TOP_RIGHT.label),
                    value: COORDINATE_MODE_TOP_RIGHT.value,
                    mode: COORDINATE_MODE_TOP_RIGHT
                }
            ];
        }
    } else if (workpieceShape === WorkpieceShape.Cylinder) {
        return [
            {
                label: i18n._(COORDINATE_MODE_BOTTOM_CENTER),
                value: COORDINATE_MODE_BOTTOM_CENTER.value,
                mode: COORDINATE_MODE_BOTTOM_CENTER,
            }
        ];
    }

    return [];
}
