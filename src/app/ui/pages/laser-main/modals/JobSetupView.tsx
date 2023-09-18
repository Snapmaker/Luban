import { Machine } from '@snapmaker/luban-platform';
import { includes } from 'lodash';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import {
    HEAD_LASER
} from '../../../../constants';
import {
    CylinderWorkpieceSize,
    JobOffsetMode,
    Materials,
    Origin,
    OriginReference,
    OriginTypeOption,
    RectangleWorkpieceSize,
    Workpiece,
    WorkpieceShape,
    getOriginReferenceOptions,
    getOriginTypeOptions
} from '../../../../constants/coordinate';
import { actions as editorActions } from '../../../../flux/editor';
import { RootState } from '../../../../flux/index.def';
import useSetState from '../../../../lib/hooks/set-state';
import i18n from '../../../../lib/i18n';
import { toFixed } from '../../../../lib/numeric-utils';
import { SnapmakerRayMachine } from '../../../../machines';
import { L20WLaserToolModule, L40WLaserToolModule } from '../../../../machines/snapmaker-2-toolheads';
import { NumberInput as Input } from '../../../components/Input';
import Select from '../../../components/Select';
import TipTrigger from '../../../components/TipTrigger';


export type JobSetupViewHandle = {
    onChange: () => void;
}

const JobSetupView = React.forwardRef<JobSetupViewHandle, {}>((_, ref) => {
    const activeMachine = useSelector((state: RootState) => state.machine.activeMachine) as Machine;

    const toolHead = useSelector((state: RootState) => state.machine.toolHead);
    const toolIdentifer = toolHead.laserToolhead;

    // const machineToolOptions = getMachineToolOptions(activeMachine?.identifier, toolIdentifer);

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

    // Use materials to update local workpiece state
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
    ]);

    /**
     * Work Origin
     */
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

    /**
     * Run Boundary Mode
     */
    const jobOffsetMode: JobOffsetMode = useSelector((state: RootState) => state.laser.jobOffsetMode);
    const [selectedJobOffsetMode, setSelectedJobOffsetMode] = useState(jobOffsetMode);

    const runBoundaryModeOptions = useMemo(() => {
        // hard-coded for ray machine
        if (includes([L20WLaserToolModule.identifier, L40WLaserToolModule.identifier], toolIdentifer)) {
            if (activeMachine?.identifier === SnapmakerRayMachine.identifier) {
                return [
                    {
                        label: i18n._('Crosshair'),
                        value: JobOffsetMode.Crosshair,
                    },
                    {
                        label: i18n._('Laser Spot'),
                        value: JobOffsetMode.LaserSpot,
                    },
                ];
            } else {
                return [
                    {
                        label: i18n._('Crosshair'),
                        value: JobOffsetMode.Crosshair,
                    },
                ];
            }
        } else {
            return [
                {
                    label: i18n._('Laser Spot'),
                    value: JobOffsetMode.LaserSpot,
                },
            ];
        }
    }, [activeMachine, toolIdentifer]);

    // Check job offset mode options
    useEffect(() => {
        const targetOption = runBoundaryModeOptions.find(option => option.value === jobOffsetMode);
        if (targetOption) {
            setSelectedJobOffsetMode(jobOffsetMode);
        } else {
            setSelectedJobOffsetMode(runBoundaryModeOptions[0].value);
        }
    }, [jobOffsetMode, runBoundaryModeOptions]);

    const onChangeJobOffsetMode = useCallback((option) => {
        setSelectedJobOffsetMode(option.value);
    }, []);

    /**
     * Other parameters calculated
     */
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
                // Workpiece
                dispatch(editorActions.setWorkpiece(
                    HEAD_LASER,
                    workpiece.shape,
                    workpiece.size,
                ));

                dispatch(editorActions.updateWorkpieceObject(HEAD_LASER));

                // Origin
                dispatch(editorActions.setOrigin(
                    HEAD_LASER,
                    selectedOrigin,
                ));

                // Run Boudanry Mode
                dispatch(editorActions.setJobOffsetMode(selectedJobOffsetMode));

                const targetOption = originReferenceOptions.find(option => option.value === selectedOrigin.reference);

                // FIXME
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

        selectedJobOffsetMode,
    ]);

    return (
        <div className="margin-left-50">
            <div>
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
            </div>
            <div className="margin-top-24">
                <div className="margin-bottom-16 font-weight-bold">
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
                                <TipTrigger
                                    title={i18n._('key-CncLaser/JobSetup-Origin Mode')}
                                    content={i18n._('Taking the object as the origin will take a certain location of the object as the origin. With the workpiece as the origin, a certain position of the workpiece will be used as the origin, and the relative position of the origin from the object will affect the final processing position.')}
                                >
                                    <div className="height-32 sm-flex">
                                        <span className="width-144 margin-right-8 text-overflow-ellipsis">
                                            {i18n._('key-CncLaser/JobSetup-Origin Mode')}
                                        </span>
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
                                </TipTrigger>
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
            <div className="margin-top-24">
                <div className="margin-bottom-16 font-weight-bold">
                    {i18n._('Job Offset')}
                </div>
                <TipTrigger
                    title={i18n._('Job Offset Mode')}
                    content={i18n._('Crosshair mode uses the crosshair for positioning, while Laser shot mode uses the working laser for positioning.')}
                >
                    <div className="sm-flex justify-space-between height-32">
                        <span className="width-144 margin-right-8 text-overflow-ellipsis">

                            {i18n._('Job Offset Mode')}
                        </span>
                        <Select
                            className="width-120"
                            options={runBoundaryModeOptions}
                            value={selectedJobOffsetMode}
                            onChange={onChangeJobOffsetMode}
                            disabled={runBoundaryModeOptions.length <= 1}
                        />
                    </div>
                </TipTrigger>
            </div>
        </div>
    );
});

export default JobSetupView;
