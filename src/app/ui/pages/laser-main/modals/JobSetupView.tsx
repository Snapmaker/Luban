import { Machine } from '@snapmaker/luban-platform';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import {
    COORDINATE_MODE_BOTTOM_CENTER,
    COORDINATE_MODE_BOTTOM_LEFT,
    COORDINATE_MODE_BOTTOM_RIGHT,
    COORDINATE_MODE_CENTER,
    COORDINATE_MODE_TOP_LEFT,
    COORDINATE_MODE_TOP_RIGHT,
    HEAD_LASER,
} from '../../../../constants';
import {
    CylinderWorkpieceSize,
    Materials,
    Origin,
    OriginReference,
    OriginType,
    RectangleWorkpieceSize,
    Workpiece,
    WorkpieceShape,
} from '../../../../constants/coordinate';
import { actions as editorActions } from '../../../../flux/editor';
import { RootState } from '../../../../flux/index.def';
import useSetState from '../../../../lib/hooks/set-state';
import i18n from '../../../../lib/i18n';
import { toFixed } from '../../../../lib/numeric-utils';
import { NumberInput as Input } from '../../../components/Input';
import Select from '../../../components/Select';


type OriginTypeOption = {
    value: OriginType;
    label: string;
};

function getOriginTypeOptions(workpieceShape: WorkpieceShape): OriginTypeOption[] {
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

function getOriginReferenceOptions(workpieceShape: WorkpieceShape, originType: OriginType = OriginType.Workpiece) {
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

export type JobSetupViewHandle = {
    onChange: () => void;
}

const JobSetupView = forwardRef<JobSetupViewHandle, {}>((_, ref) => {
    const activeMachine = useSelector((state: RootState) => state.machine.activeMachine) as Machine;

    const materials = useSelector((state: RootState) => state[HEAD_LASER]?.materials, shallowEqual) as Materials;
    const origin = useSelector((state: RootState) => state[HEAD_LASER].origin, shallowEqual) as Origin;

    const { inProgress, useBackground } = useSelector((state: RootState) => state[HEAD_LASER]);

    // workpiece
    const [workpiece, updateWorkpiece] = useSetState<Workpiece>({
        shape: !materials.isRotate ? WorkpieceShape.Rectangle : WorkpieceShape.Cylinder,
        size: materials.isRotate ? {
            diameter: materials.diameter,
            length: materials.length,
        } : {
            x: materials.x,
            y: materials.y,
            z: materials.z,
        }
    });

    const setWorkpieceShape = useCallback((shape: WorkpieceShape) => {
        updateWorkpiece({
            shape,
        });
    }, [updateWorkpiece]);

    const setWorkpieceSize = useCallback((size: RectangleWorkpieceSize | CylinderWorkpieceSize) => {
        if (workpiece.shape === WorkpieceShape.Rectangle) {
            updateWorkpiece({
                size: {
                    x: (size as RectangleWorkpieceSize).x,
                    y: (size as RectangleWorkpieceSize).y,
                    z: (size as RectangleWorkpieceSize).z,
                }
            });
        } else if (workpiece.shape === WorkpieceShape.Cylinder) {
            updateWorkpiece({
                size: {
                    diameter: (size as CylinderWorkpieceSize).diameter,
                    length: (size as CylinderWorkpieceSize).length,
                }
            });
        }
    }, [updateWorkpiece, workpiece.shape]);

    // job type state FIXME
    useEffect(() => {
        const shape: WorkpieceShape = !materials.isRotate ? WorkpieceShape.Rectangle : WorkpieceShape.Cylinder;

        // Update shape
        setWorkpieceShape(shape);

        // Update size
        if (shape === WorkpieceShape.Rectangle) {
            setWorkpieceSize({
                x: materials.x,
                y: materials.y,
                z: materials.z,
            });
        } else if (shape === WorkpieceShape.Cylinder) {
            setWorkpieceSize({
                diameter: materials.diameter,
                length: materials.length,
            });
        }
    }, [
        materials,

        // new
        setWorkpieceShape, setWorkpieceSize,
        // workpiece.shape,
    ]);

    // Origin
    const [selectedOrigin, updateSelectedOrigin] = useSetState<Origin>(origin);

    // origin type
    const originTypeOptions = useMemo(() => {
        return getOriginTypeOptions(workpiece.shape);
    }, [workpiece.shape]);

    const onChangeOriginType = useCallback((option: OriginTypeOption) => {
        updateSelectedOrigin({ type: option.value });
    }, [updateSelectedOrigin]);

    // origin reference
    const setOriginReference = useCallback((reference: OriginReference) => {
        updateSelectedOrigin({
            reference,
        });
    }, [updateSelectedOrigin]);

    useEffect(() => {
        updateSelectedOrigin(origin);
    }, [updateSelectedOrigin, origin]);

    const originReferenceOptions = useMemo(() => {
        return getOriginReferenceOptions(workpiece.shape);
    }, [workpiece.shape]);

    const onChangeOriginReference = useCallback((option) => {
        setOriginReference(option.mode.value);
    }, [setOriginReference]);

    // In case default reference is not an option, select an available one as reference
    useEffect(() => {
        const targetOption = originReferenceOptions.find(option => option.value === selectedOrigin.reference);
        if (!targetOption && originReferenceOptions.length > 0) {
            const firstOption = originReferenceOptions[0];
            setOriginReference(firstOption.mode.value as OriginReference);
        }
    }, [
        setOriginReference,
        originReferenceOptions, selectedOrigin.reference,
    ]);

    const maxX = activeMachine?.metadata.size.x || 0;
    const maxY = activeMachine?.metadata.size.y || 0;

    // FIXME: Add image to origin options
    let imgOF3axisCoordinateMode = '';
    if (workpiece.shape === WorkpieceShape.Rectangle) { // TODO
        imgOF3axisCoordinateMode = `/resources/images/cnc-laser/working-origin-3-${selectedOrigin.reference}.png`;
    }

    let settingSizeDisabled = false;
    if (useBackground) {
        settingSizeDisabled = true;
    }

    const dispatch = useDispatch();
    useImperativeHandle(ref, () => {
        return {
            onChange: () => {
                dispatch(editorActions.setWorkpiece(
                    HEAD_LASER,
                    workpiece.shape,
                    workpiece.size,
                ));

                dispatch(editorActions.updateWorkpieceObject(HEAD_LASER));


                dispatch(editorActions.setOrigin(
                    HEAD_LASER,
                    selectedOrigin,
                ));

                const targetOption = originReferenceOptions.find(option => option.value === selectedOrigin.reference);

                // TODO
                if (workpiece.shape === WorkpieceShape.Rectangle) {
                    dispatch(editorActions.changeCoordinateMode(
                        HEAD_LASER,
                        targetOption.mode,
                        {
                            x: (workpiece.size as RectangleWorkpieceSize).x,
                            y: (workpiece.size as RectangleWorkpieceSize).y,
                            z: (workpiece.size as RectangleWorkpieceSize).z,
                        }
                    ));
                } else if (workpiece.shape === WorkpieceShape.Cylinder) {
                    dispatch(editorActions.changeCoordinateMode(
                        HEAD_LASER,
                        targetOption.mode,
                        {
                            x: (workpiece.size as CylinderWorkpieceSize).diameter * Math.PI,
                            y: (workpiece.size as CylinderWorkpieceSize).length,
                        }
                    ));
                }

                dispatch(editorActions.scaleCanvasToFit(HEAD_LASER));
            },
        };
    }, [
        dispatch,
        originReferenceOptions,

        workpiece.shape,
        workpiece.size,

        selectedOrigin,
    ]);

    return (
        <React.Fragment>
            <div className="margin-left-50">
                <div className="margin-bottom-16 font-weight-bold">
                    {i18n._('key-Term/Workpiece Size')}
                </div>
                {
                    workpiece.shape === WorkpieceShape.Rectangle && (
                        <div className="sm-flex">
                            <img
                                draggable="false"
                                style={{
                                    width: '100px',
                                    height: '100px'
                                }}
                                src="/resources/images/cnc-laser/working-size-3.png"
                                role="presentation"
                                alt="3 Axis"
                            />
                            <div className="margin-left-16 sm-flex-width">
                                <div className="sm-flex height-32 position-re">
                                    <span className="width-144 margin-right-8">{i18n._('key-CncLaser/JobSetup-Width (X)')}</span>
                                    <Input
                                        suffix="mm"
                                        disabled={inProgress || settingSizeDisabled}
                                        value={toFixed((workpiece.size as RectangleWorkpieceSize).x, 1)}
                                        max={maxX}
                                        min={2}
                                        onChange={(value) => {
                                            setWorkpieceSize({
                                                x: value,
                                                y: (workpiece.size as RectangleWorkpieceSize).y,
                                                z: (workpiece.size as RectangleWorkpieceSize).z,
                                            });
                                        }}
                                    />
                                </div>
                                <div className="sm-flex height-32 position-re margin-top-16">
                                    <span className="width-144 margin-right-8">{i18n._('key-CncLaser/JobSetup-Height (Y)')}</span>
                                    <Input
                                        suffix="mm"
                                        disabled={inProgress || settingSizeDisabled}
                                        value={toFixed((workpiece.size as RectangleWorkpieceSize).y, 1)}
                                        max={maxY}
                                        min={10}
                                        onChange={(value) => {
                                            setWorkpieceSize({
                                                x: (workpiece.size as RectangleWorkpieceSize).x,
                                                y: value,
                                                z: (workpiece.size as RectangleWorkpieceSize).z,
                                            });
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )
                }
                {
                    workpiece.shape === WorkpieceShape.Cylinder && (
                        <>
                            <div className="sm-flex">
                                <img
                                    draggable="false"
                                    style={{
                                        width: '330px',
                                        margin: '0'
                                    }}
                                    src="/resources/images/cnc-laser/working-size-4.png"
                                    role="presentation"
                                    alt="3 Axis"
                                />
                            </div>
                            <div className="margin-top-16">
                                <div className="sm-flex height-32 position-re">
                                    <span className="width-144 margin-right-8">{i18n._('key-CncLaser/JobSetup-Length (L)')}</span>
                                    <Input
                                        suffix="mm"
                                        disabled={inProgress || settingSizeDisabled}
                                        value={toFixed((workpiece.size as CylinderWorkpieceSize).length, 1)}
                                        max={maxY}
                                        min={10}
                                        onChange={(value) => {
                                            setWorkpieceSize({
                                                diameter: (workpiece.size as CylinderWorkpieceSize).diameter,
                                                length: value,
                                            });
                                        }}
                                    />
                                </div>
                                <div className="sm-flex height-32 position-re margin-top-8">
                                    <span className="width-144 margin-right-8">{i18n._('key-CncLaser/JobSetup-Diameter (D)')}</span>
                                    <Input
                                        suffix="mm"
                                        disabled={inProgress || settingSizeDisabled}
                                        value={toFixed((workpiece.size as CylinderWorkpieceSize).diameter, 1)}
                                        max={maxX}
                                        min={2}
                                        onChange={(value) => {
                                            setWorkpieceSize({
                                                diameter: value,
                                                length: (workpiece.size as CylinderWorkpieceSize).length,
                                            });
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    )
                }
                <div className="margin-top-24 margin-bottom-16 font-weight-bold">
                    {i18n._('key-CncLaser/JobSetup-Work Origin')}
                </div>
                {
                    workpiece.shape === WorkpieceShape.Rectangle && (
                        <div className="sm-flex">
                            <img
                                draggable="false"
                                style={{
                                    width: '100px',
                                    height: '100px'
                                }}
                                src={imgOF3axisCoordinateMode}
                                role="presentation"
                                alt="3 Axis"
                            />
                            <div className="margin-left-16">
                                <div className="height-32 sm-flex">
                                    <span className="width-144 margin-right-8 text-overflow-ellipsis">{i18n._('key-CncLaser/JobSetup-Origin Mode')}</span>
                                    <Select
                                        backspaceRemoves={false}
                                        size="120px"
                                        clearable={false}
                                        options={originTypeOptions}
                                        isGroup={false}
                                        placeholder={i18n._('key-CncLaser/JobSetup-Choose font')}
                                        value={selectedOrigin.type}
                                        onChange={onChangeOriginType}
                                        disabled={inProgress || settingSizeDisabled}
                                    />
                                </div>
                                <div className="height-32 margin-top-16 sm-flex">
                                    <span className="width-144 margin-right-8 text-overflow-ellipsis">{i18n._('key-CncLaser/JobSetup-Origin Position')}</span>
                                    <Select
                                        backspaceRemoves={false}
                                        size="120px"
                                        clearable={false}
                                        options={originReferenceOptions}
                                        isGroup={false}
                                        placeholder={i18n._('key-CncLaser/JobSetup-Choose font')}
                                        value={selectedOrigin.reference}
                                        onChange={onChangeOriginReference}
                                        disabled={inProgress || settingSizeDisabled}
                                    />
                                </div>
                            </div>
                        </div>
                    )
                }
                {
                    workpiece.shape === WorkpieceShape.Cylinder && (
                        <div className="sm-flex">
                            <img
                                draggable="false"
                                style={{
                                    width: '116px',
                                    height: '128px',
                                    margin: '0 auto'
                                }}
                                src="/resources/images/cnc-laser/working-origin-laser-4.png"
                                role="presentation"
                                alt="3 Axis"
                            />
                            <div className="margin-left-16 sm-flex-width sm-flex height-32">
                                <span className="width-144 margin-right-8">{i18n._('key-CncLaser/JobSetup-Origin Position')}</span>
                                <Select
                                    backspaceRemoves={false}
                                    size="120px"
                                    clearable={false}
                                    options={[
                                        {
                                            label: i18n._('key-CncLaser/JobSetup-Top'),
                                            value: 'top'
                                        }
                                    ]}
                                    isGroup={false}
                                    value="top"
                                    disabled
                                />
                            </div>
                        </div>
                    )
                }
            </div>
        </React.Fragment>
    );
});

export default JobSetupView;
