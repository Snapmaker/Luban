import AlignGroupOperation from './AlignGroupOperation';
import GroupOperation from './GroupOperation';
import ReplaceSplittedOperation from './ReplaceSplittedOperation';
import VisibilityOperation from './VisibilityOperation';

import AddOperation3D from './AddOperation3D';
import AddSupportOperation3D from './AddSupportOperation3D';
import ArrangeOperation3D from './ArrangeOperation3D';
import DeleteOperation3D from './DeleteOperation3D';
import DeleteSupportsOperation3D from './DeleteSupportOperation3D';
import MoveOperation3D from './MoveOperation3D';
import RotateOperation3D from './RotateOperation3D';
import ScaleOperation3D from './ScaleOperation3D';
import ScaleToFitWithRotateOperation3D from './ScaleToFitWithRotateOperation3D';
import SimplifyModelOperation from './SimplifyModelOperation';
import UngroupOperation3D from './UngroupOperation3D';


export {
    VisibilityOperation,

    GroupOperation,

    AlignGroupOperation,

    ReplaceSplittedOperation,

    // TODO: Refactor operations to symmetric operation
    // basic add/delete
    AddOperation3D,
    DeleteOperation3D,

    // transformation
    MoveOperation3D,
    RotateOperation3D,
    ScaleOperation3D,
    ScaleToFitWithRotateOperation3D,
    ArrangeOperation3D,

    // group
    UngroupOperation3D,

    // support
    AddSupportOperation3D,
    DeleteSupportsOperation3D,

    // simplify
    SimplifyModelOperation,
};

