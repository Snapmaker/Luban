import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { actions as editorActions } from '../../../../flux/editor';
import {
    COORDINATE_MODE_BOTTOM_CENTER,
    COORDINATE_MODE_BOTTOM_LEFT,
    COORDINATE_MODE_BOTTOM_RIGHT,
    COORDINATE_MODE_CENTER,
    COORDINATE_MODE_TOP_LEFT,
    COORDINATE_MODE_TOP_RIGHT,
    HEAD_LASER,
} from '../../../../constants';
import { RootState } from '../../../../flux/index.def';
import useSetState from '../../../../lib/hooks/set-state';
import i18n from '../../../../lib/i18n';
import { toFixed } from '../../../../lib/numeric-utils';
import { NumberInput as Input } from '../../../components/Input';
import Select from '../../../components/Select';
import { renderModal } from '../../../utils';
import { JobTypeState } from '../../../widgets/JobType/JobTypeState';


type JobSetupViewHandle = {
    onChange: () => void;
}

const JobSetupView = forwardRef<JobSetupViewHandle, {}>((_, ref) => {
    const { size } = useSelector((state: RootState) => state.machine);

    const coordinateMode = useSelector(state => state[HEAD_LASER]?.coordinateMode, shallowEqual);
    const coordinateSize = useSelector(state => state[HEAD_LASER]?.coordinateSize, shallowEqual);
    const materials = useSelector((state: RootState) => state[HEAD_LASER]?.materials, shallowEqual);

    const { inProgress, useBackground } = useSelector((state: RootState) => state[HEAD_LASER]);

    // job type state FIXME
    const [jobTypeState, setJobTypeState] = useSetState<JobTypeState>({
        coordinateMode,
        coordinateSize,
        materials,
    });

    useEffect(() => {
        setJobTypeState({
            coordinateMode,
            coordinateSize,
            materials
        });
    }, [setJobTypeState, coordinateMode, coordinateSize, materials]);

    const coordinateModeList = [
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

    const actions = {
        changeCoordinateMode: (option) => {
            const newCoordinateMode = coordinateModeList.find(d => d.value === option.value);
            console.log('newCoordinateMode', newCoordinateMode);
            actions.setCoordinateModeAndCoordinateSize(newCoordinateMode.mode, jobTypeState.coordinateSize);
        },
        setCoordinateModeAndCoordinateSize: (coordinateMode_, coordinateSize_) => {
            setJobTypeState({
                ...jobTypeState,
                coordinateMode: coordinateMode_,
                coordinateSize: coordinateSize_,
            });
        },
    };

    const { isRotate, diameter, length } = jobTypeState.materials;
    const maxX = size.x;
    const maxY = size.y;

    let imgOF3axisCoordinateMode = '';
    // const imgLockingBlockPosition = `/resources/images/cnc-laser/lock-block-${lockingBlockPosition?.toLowerCase()}.png`;
    if (!isRotate && coordinateMode.value !== 'bottom-center') { // TODO
        imgOF3axisCoordinateMode = `/resources/images/cnc-laser/working-origin-3-${coordinateMode.value}.png`;
    }

    let settingSizeDisabled = false;
    if (useBackground) {
        settingSizeDisabled = true;
    }

    const dispatch = useDispatch();
    useImperativeHandle(ref, () => {
        return {
            onChange: () => {
                dispatch(editorActions.changeCoordinateMode(HEAD_LASER,
                    jobTypeState.coordinateMode, jobTypeState.coordinateSize));
                dispatch(editorActions.updateMaterials(HEAD_LASER, jobTypeState.materials));
                dispatch(editorActions.scaleCanvasToFit(HEAD_LASER));
            },
        };
    }, [
        dispatch,
        jobTypeState.coordinateMode,
        jobTypeState.coordinateSize,
        jobTypeState.materials,
    ]);

    return (
        <React.Fragment>
            <div className="margin-left-50">
                <div className="margin-bottom-16 font-weight-bold">
                    {i18n._('key-CncLaser/JobSetup-Work Size')}
                </div>
                {!isRotate && (
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
                                <span className="width-120 margin-right-8">{i18n._('key-CncLaser/JobSetup-Width (X)')}</span>
                                <Input
                                    suffix="mm"
                                    disabled={inProgress || settingSizeDisabled}
                                    value={toFixed(coordinateSize.x, 1)}
                                    max={maxX}
                                    min={2}
                                    onChange={(value) => {
                                        actions.setCoordinateModeAndCoordinateSize(
                                            coordinateMode,
                                            {
                                                x: value,
                                                y: coordinateSize.y
                                            }
                                        );
                                    }}
                                />
                            </div>
                            <div className="sm-flex height-32 position-re margin-top-16">
                                <span className="width-120 margin-right-8">{i18n._('key-CncLaser/JobSetup-Height (Y)')}</span>
                                <Input
                                    suffix="mm"
                                    disabled={inProgress || settingSizeDisabled}
                                    value={toFixed(coordinateSize.y, 1)}
                                    max={maxY}
                                    min={10}
                                    onChange={(value) => {
                                        actions.setCoordinateModeAndCoordinateSize(
                                            coordinateMode,
                                            {
                                                x: coordinateSize.x,
                                                y: value,
                                            }
                                        );
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
                {isRotate && (
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
                                <span className="width-120 margin-right-8">{i18n._('key-CncLaser/JobSetup-Length (L)')}</span>
                                <Input
                                    suffix="mm"
                                    disabled={inProgress || settingSizeDisabled}
                                    value={toFixed(length, 1)}
                                    max={size.y}
                                    min={10}
                                    onChange={(value) => {
                                        setJobTypeState(
                                            COORDINATE_MODE_BOTTOM_CENTER,
                                            {
                                                x: diameter * Math.PI,
                                                y: value
                                            },
                                            { length: value }
                                        );
                                    }}
                                />
                            </div>
                            <div className="sm-flex height-32 position-re margin-top-8">
                                <span className="width-120 margin-right-8">{i18n._('key-CncLaser/JobSetup-Diameter (D)')}</span>
                                <Input
                                    suffix="mm"
                                    disabled={inProgress || settingSizeDisabled}
                                    value={toFixed(diameter, 1)}
                                    max={size.x}
                                    min={2}
                                    onChange={(value) => {
                                        setJobTypeState(
                                            COORDINATE_MODE_BOTTOM_CENTER,
                                            {
                                                x: value * Math.PI,
                                                y: length
                                            },
                                            { diameter: value }
                                        );
                                    }}
                                />
                            </div>
                        </div>
                    </>
                )}
                <div className="margin-top-24 margin-bottom-16 font-weight-bold">
                    {i18n._('key-CncLaser/JobSetup-Work Origin')}
                </div>
                {!isRotate && (
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
                                <span className="width-120 margin-right-8 text-overflow-ellipsis">{i18n._('key-CncLaser/JobSetup-Origin Position')}</span>
                                <Select
                                    backspaceRemoves={false}
                                    size="120px"
                                    clearable={false}
                                    options={coordinateModeList}
                                    isGroup={false}
                                    placeholder={i18n._('key-CncLaser/JobSetup-Choose font')}
                                    value={jobTypeState.coordinateMode.value}
                                    onChange={actions.changeCoordinateMode}
                                    disabled={inProgress || settingSizeDisabled}
                                />
                            </div>
                        </div>
                    </div>
                )}
                {
                    isRotate && (
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
                                <span className="width-120 margin-right-8">{i18n._('key-CncLaser/JobSetup-Origin Position')}</span>
                                <Select
                                    backspaceRemoves={false}
                                    size="120px"
                                    clearable={false}
                                    options={[
                                        {
                                            label: i18n._('key-CncLaser/JobSetup-Top'),
                                            value: 'top'
                                        }]}
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

interface JobSetupModalProps {
    onClose?: () => void;
}

const JobSetupModal: React.FC<JobSetupModalProps> = (props) => {
    const { onClose } = props;

    const jobSetupViewRef = useRef<JobSetupViewHandle>();

    return renderModal({
        title: i18n._('key-CncLaser/JobSetup-Job Setup'),
        renderBody: () => {
            return <JobSetupView ref={jobSetupViewRef} />;
        },
        actions: [
            {
                name: i18n._('key-CncLaser/JobSetup-Cancel'),
                onClick: () => {
                    onClose && onClose();
                }
            },
            {
                name: i18n._('key-CncLaser/JobSetup-Confirm'),
                isPrimary: true,
                onClick: () => {
                    if (jobSetupViewRef.current) {
                        jobSetupViewRef.current.onChange();
                    }
                    onClose && onClose();
                }
            }
        ],
        onClose: () => {
            onClose && onClose();
        },
    });
};

export default JobSetupModal;
