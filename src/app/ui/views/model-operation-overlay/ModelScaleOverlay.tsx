import classNames from 'classnames';
import { isUndefined, throttle } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { HEAD_PRINTING } from '../../../constants';
import { RootState } from '../../../flux/index.def';
import { actions as printingActions } from '../../../flux/printing';
import { logTransformOperation } from '../../../lib/gaEvent';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import Checkbox from '../../components/Checkbox';
import { NumberInput as Input } from '../../components/Input';

import CancelButton from './CancelButton';
import styles from './styles.styl';

// const longLang = ['de', 'it'];

interface Transformation {
    scaleX?: number;
    scaleY?: number;
    scaleZ?: number;

    uniformScalingState?: boolean;
}

interface ModelScaleOverlayProps {
    setTransformMode: (transformMode: string) => void,
    onModelAfterTransform: () => void;
}

const ModelScaleOverlay: React.FC<ModelScaleOverlayProps> = React.memo((props) => {
    const { setTransformMode, onModelAfterTransform } = props;

    const dispatch = useDispatch();

    const isPrimeTowerSelected = useSelector((state: RootState) => state.printing?.modelGroup?.isPrimeTowerSelected());
    const selectedModelArray = useSelector((state: RootState) => state.printing?.modelGroup?.selectedModelArray);
    const transformation = useSelector((state: RootState) => state.printing?.modelGroup?.getSelectedModelTransformationForPrinting(), shallowEqual);
    const primeTowerHeight = useSelector((state: RootState) => state.printing?.primeTowerHeight, shallowEqual);
    const selectedGroup = useSelector((state: RootState) => state.printing?.modelGroup?.selectedGroup, shallowEqual);
    const isSelectedModelAllVisible = useSelector((state: RootState) => state.printing?.modelGroup?.isSelectedModelAllVisible(), shallowEqual);
    const selectedModelBBoxDes = useSelector((state: RootState) => state.printing?.modelGroup?.getSelectedModelBBoxWHD(), shallowEqual);

    const [scalePercentObj, setScalePercentObj] = useState({
        x: 100,
        y: 100,
        z: 100
    });

    const [modelX, setModelX] = useState(0);
    const [modelY, setModelY] = useState(0);
    const [modelZ, setModelZ] = useState(0);
    const [uniformScalingState, setUniformScalingState] = useState(true);
    const [modelSize, setModelSize] = useState({ scaledX: 1, scaledY: 1, scaledZ: 1 });

    const updateScale = useCallback(throttle((event) => {
        const { detail } = event;
        // When multiple models are selected, delayed updating is required
        setTimeout(() => {
            setScalePercentObj(detail.scale);
        });
        setModelX(Math.round(detail.scale.x * 20) / 100);
        setModelY(Math.round(detail.scale.y * 20) / 100);
        // hidden model size after scale
        // setModelX(Math.round(detail.scale.x * initModelSize.x) / 100);
        // setModelY(Math.round(detail.scale.y * initModelSize.y) / 100);
        // setModelZ(Math.round(detail.scale.z * initModelSize.z) / 100);
        // !detail.isPrimeTower && setModelZ(Math.round(detail.scale.z * initModelSize.z) / 100);
    }, 1000), []);

    useEffect(() => {
        window.addEventListener('update-scale', updateScale);
        return () => {
            window.removeEventListener('update-scale', updateScale);
        };
    }, []);

    useEffect(() => {
        if (isPrimeTowerSelected) {
            const originModelSize = {
                scaledX: selectedModelBBoxDes.x / selectedGroup.scale.x,
                scaledY: selectedModelBBoxDes.y / selectedGroup.scale.y,
                scaledZ: selectedModelBBoxDes.z / selectedGroup.scale.z,
            };
            setModelX(Number(selectedModelBBoxDes.x.toFixed(2)));
            setModelY(Number(selectedModelBBoxDes.y.toFixed(2)));
            setModelZ(Number(selectedModelBBoxDes.z.toFixed(2)));
            setModelSize(originModelSize);
        } else {
            const originModelSize = {
                scaledX: selectedModelBBoxDes.x / selectedGroup.scale.x,
                scaledY: selectedModelBBoxDes.y / selectedGroup.scale.y,
                scaledZ: selectedModelBBoxDes.z / selectedGroup.scale.z,
            };
            setModelX(Number(selectedModelBBoxDes.x.toFixed(2)));
            setModelY(Number(selectedModelBBoxDes.y.toFixed(2)));
            setModelZ(Number(selectedModelBBoxDes.z.toFixed(2)));
            setModelSize(originModelSize);
        }

        const newScalePercentObj = {
            x: Math.round(Math.abs(transformation.scaleX || 0) * 1000) / 10,
            y: Math.round(Math.abs(transformation.scaleY || 0) * 1000) / 10,
            z: Math.round(Math.abs(transformation.scaleZ || 0) * 1000) / 10,
        };
        setScalePercentObj(newScalePercentObj);
        setUniformScalingState(transformation.uniformScalingState);
    }, [selectedModelArray, selectedModelBBoxDes, isPrimeTowerSelected, transformation, selectedGroup.scale]);

    const changeUniformScalingState = () => {
        setUniformScalingState((_uniformScalingState) => {
            const newTransformation = {
                uniformScalingState: !_uniformScalingState
            };
            dispatch(printingActions.updateSelectedModelTransformation(newTransformation));
            onModelAfterTransform();
            return !_uniformScalingState;
        });
    };

    const onModelTransform = (transformations: Transformation, isReset = false, _isPrimeTowerSelected = false) => {
        const newTransformation: Transformation = {};
        let value = null;
        Object.keys(transformations).forEach(keyItem => {
            value = transformations[keyItem];
            switch (keyItem) {
                case 'scaleX':
                    if (_isPrimeTowerSelected) {
                        newTransformation.scaleY = (transformation.scaleX > 0 ? value : -value);
                        newTransformation.uniformScalingState = false;
                    }
                    newTransformation.scaleX = (transformation.scaleX > 0 ? value : -value);
                    break;
                case 'scaleY':
                    if (_isPrimeTowerSelected) {
                        newTransformation.scaleX = (transformation.scaleY > 0 ? value : -value);
                        newTransformation.uniformScalingState = false;
                    }
                    newTransformation.scaleY = (transformation.scaleY > 0 ? value : -value);
                    break;
                case 'scaleZ':
                    newTransformation.scaleZ = (transformation.scaleZ > 0 ? value : -value);
                    break;
                default:
                    break;
            }
        });

        dispatch(printingActions.updateSelectedModelTransformation(newTransformation, isReset ? _isPrimeTowerSelected : undefined));

        !isReset && logTransformOperation(HEAD_PRINTING, 'scale', 'input_%');
    };

    /**
     * Handling function used to scale prime tower.
     *
     * Keep scaleX, scaleY the same, since prime tower is a circle.
     */
    const scalePrimeTower = useCallback((targetTransformation: Transformation) => {
        const newTransformation: Transformation = {};
        for (const key of Object.keys(targetTransformation)) {
            const value = targetTransformation[key];
            switch (key) {
                case 'scaleX': {
                    const scaleValue = (transformation.scaleX > 0 ? value : -value);
                    newTransformation.scaleX = scaleValue;
                    newTransformation.scaleY = scaleValue;
                    newTransformation.uniformScalingState = false; // only for XY
                    break;
                }
                case 'scaleY': {
                    const scaleValue = (transformation.scaleY > 0 ? value : -value);
                    newTransformation.scaleX = scaleValue;
                    newTransformation.scaleY = scaleValue;
                    newTransformation.uniformScalingState = false; // only for XY
                    break;
                }
                default:
                    break;
            }
        }

        dispatch(printingActions.updateSelectedModelTransformation(newTransformation));
    }, [dispatch, transformation]);

    const resetScale = (_isPrimeTowerSelected) => {
        onModelTransform({
            'scaleX': 1,
            'scaleY': 1,
            'scaleZ': _isPrimeTowerSelected ? primeTowerHeight : 1,
            'uniformScalingState': !_isPrimeTowerSelected
        }, true);

        logTransformOperation(HEAD_PRINTING, 'scale', 'reset');

        onModelAfterTransform();
    };

    const scaleToFitSelectedModel = () => {
        logTransformOperation(HEAD_PRINTING, 'scale', 'to_fit');
        dispatch(printingActions.scaleToFitSelectedModelWithRotate());
    };

    /**
     * Render row component for modify selected models.
     *
     * dimensionOptions = {
     *     display: true,
     *     onChange: (value) => void,
     * }
     * percentageOptions = {
     *     display: true,
     *     onChange: (value) => void,
     * }
     */
    const renderAxisInput = useCallback((
        {
            label,
            disabled = false,
            dimensionOptions = { display: true, value: 0, min: 1, onChange: null },
            percentageOptions = { display: true, value: 100, min: 1, onChange: null },
        }
    ) => {
        dimensionOptions.display = isUndefined(dimensionOptions.display) ? true : dimensionOptions.display;
        dimensionOptions.min = isUndefined(dimensionOptions.min) ? 1 : dimensionOptions.min;

        percentageOptions.display = isUndefined(percentageOptions.display) ? true : percentageOptions.display;
        percentageOptions.min = isUndefined(percentageOptions.min) ? 1 : percentageOptions.min;

        let labelColor = '';
        if (label === 'X') {
            labelColor = 'color-red-1';
        } else if (label === 'Y') {
            labelColor = 'color-green-1';
        } else {
            labelColor = 'color-blue-2';
        }

        return (
            <div className="sm-flex height-32 margin-bottom-8">
                <span className={classNames('sm-flex-auto width-16', labelColor)}>{label}</span>
                <div className="position-absolute sm-flex-auto margin-horizontal-24">
                    {
                        dimensionOptions.display && (
                            <Input
                                suffix="mm"
                                size="small"
                                min={dimensionOptions.min}
                                disabled={disabled}
                                value={dimensionOptions.value}
                                onChange={dimensionOptions?.onChange}
                                className="margin-right-8"
                            />
                        )
                    }
                    {
                        percentageOptions && (
                            <Input
                                suffix="%"
                                size="small"
                                min={percentageOptions.min}
                                disabled={disabled}
                                value={percentageOptions.value}
                                onChange={percentageOptions?.onChange}
                            />
                        )
                    }
                </div>
            </div>
        );
    }, []);

    return (
        <div
            className="position-absolute width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
            style={{
                marginTop: '112px',
            }}
        >
            <div
                className={classNames(
                    styles['overlay-title-font'],
                    'sm-flex justify-space-between',
                    'border-bottom-normal padding-horizontal-16 height-40',
                )}
            >
                {i18n._('key-Printing/LeftBar-Scale')}
                <CancelButton
                    onClick={() => setTransformMode('')}
                />
            </div>
            <div className="padding-vertical-16 padding-horizontal-16">
                {
                    renderAxisInput({
                        label: 'X',
                        disabled: !isSelectedModelAllVisible && !isPrimeTowerSelected,
                        dimensionOptions: {
                            display: true,
                            value: modelX,
                            min: 0.01,
                            onChange: (value: number) => {
                                if (isPrimeTowerSelected) {
                                    scalePrimeTower({ scaleX: value / modelSize.scaledX });
                                } else {
                                    onModelTransform({ scaleX: value / modelSize.scaledX });
                                }
                                onModelAfterTransform();
                            },
                        },
                        percentageOptions: {
                            display: true,
                            value: scalePercentObj.x,
                            min: 0.01,
                            onChange: (value: number) => {
                                if (isPrimeTowerSelected) {
                                    scalePrimeTower({ scaleX: value / 100 });
                                } else {
                                    onModelTransform({ scaleX: value / 100 });
                                }
                                onModelAfterTransform();
                            },
                        },
                    })
                }
                {
                    renderAxisInput({
                        label: 'Y',
                        disabled: !isSelectedModelAllVisible && !isPrimeTowerSelected,
                        dimensionOptions: {
                            display: true,
                            value: modelY,
                            min: 0.01,
                            onChange: (value: number) => {
                                if (isPrimeTowerSelected) {
                                    scalePrimeTower({ scaleY: value / modelSize.scaledY });
                                } else {
                                    onModelTransform({ scaleY: value / modelSize.scaledY });
                                }
                                onModelAfterTransform();
                            },
                        },
                        percentageOptions: {
                            display: true,
                            value: scalePercentObj.y,
                            min: 0.01,
                            onChange: (value: number) => {
                                if (isPrimeTowerSelected) {
                                    scalePrimeTower({ scaleY: value / 100 });
                                } else {
                                    onModelTransform({ scaleY: value / 100 });
                                }
                                onModelAfterTransform();
                            },
                        },
                    })
                }
                {/* Z axis scale, note that prime tower is no able to scale by Z */}
                {
                    renderAxisInput({
                        label: 'Z',
                        disabled: isPrimeTowerSelected || !isSelectedModelAllVisible && !isPrimeTowerSelected,
                        dimensionOptions: {
                            display: true,
                            value: modelZ,
                            min: 0.01,
                            onChange: (value: number) => {
                                onModelTransform({ scaleZ: value / modelSize.scaledZ });
                                onModelAfterTransform();
                            },
                        },
                        percentageOptions: {
                            display: true,
                            value: scalePercentObj.z,
                            min: 0.01,
                            onChange: (value: number) => {
                                onModelTransform({ scaleZ: value / 100 });
                                onModelAfterTransform();
                            },
                        },
                    })
                }
                {/* Uniform scaling checkbox */}
                <div className="sm-flex height-32 margin-bottom-8">
                    <Checkbox
                        defaultChecked={isPrimeTowerSelected ? true : uniformScalingState}
                        checked={isPrimeTowerSelected ? true : uniformScalingState}
                        onClick={() => {
                            changeUniformScalingState(); // Todo: bug, state error
                        }}
                        disabled={!isSelectedModelAllVisible || isPrimeTowerSelected || selectedModelArray.length > 1}
                    />
                    <span
                        className="height-32 margin-horizontal-8"
                    >
                        {i18n._('key-Printing/LeftBar-Uniform Scaling')}
                    </span>
                </div>
                {/* Buttons */}
                <div
                    className={classNames(
                        'sm-flex sm-flex-wrap',
                        'margin-top-8',
                    )}
                >
                    {
                        !isPrimeTowerSelected && (
                            <Button
                                className="margin-top-8"
                                type="primary"
                                priority="level-three"
                                width="100%"
                                disabled={!isSelectedModelAllVisible}
                                onClick={scaleToFitSelectedModel}
                            >
                                <span>{i18n._('key-Printing/LeftBar-Scale to Fit')}</span>
                            </Button>
                        )
                    }
                    <Button
                        className="margin-top-8"
                        type="primary"
                        priority="level-three"
                        width="100%"
                        disabled={!isPrimeTowerSelected && !isSelectedModelAllVisible}
                        onClick={() => resetScale(isPrimeTowerSelected)}
                    >
                        <span>{i18n._('key-Printing/LeftBar-Reset')}</span>
                    </Button>
                </div>
            </div>
        </div>
    );
});

export default ModelScaleOverlay;
