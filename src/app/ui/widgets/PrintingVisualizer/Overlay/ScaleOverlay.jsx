import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import i18next from 'i18next';
import PropTypes from 'prop-types';
import { throttle, includes } from 'lodash';
import classNames from 'classnames';
import styles from './styles.styl';
import i18n from '../../../../lib/i18n';
import { actions as printingActions } from '../../../../flux/printing';
/* eslint-disable-next-line import/no-cycle */
import { CancelButton } from '../VisualizerLeftBar';
import { NumberInput as Input } from '../../../components/Input';
import Checkbox from '../../../components/Checkbox';
import { Button } from '../../../components/Buttons';
import { emitUpdateControlInputEvent } from '../../../components/SMCanvas/TransformControls';
import { HEAD_PRINTING, SCALE_MODE } from '../../../../constants';
import { logTransformOperation } from '../../../../lib/gaEvent';

const longLang = ['de', 'it'];
const ScaleOverlay = React.memo(({
    setTransformMode,
    onModelAfterTransform
}) => {
    const isPrimeTowerSelected = useSelector(state => state?.printing?.modelGroup?.isPrimeTowerSelected());
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray);
    const transformation = useSelector(state => state?.printing?.modelGroup?.getSelectedModelTransformationForPrinting(), shallowEqual);
    const primeTowerHeight = useSelector(state => state?.printing?.primeTowerHeight, shallowEqual);
    const selectedGroup = useSelector(state => state?.printing?.modelGroup?.selectedGroup, shallowEqual);
    const isSelectedModelAllVisible = useSelector(state => state?.printing?.modelGroup?.isSelectedModelAllVisible(), shallowEqual);
    const [scalePercentObj, setScalePercentObj] = useState({
        x: 100,
        y: 100,
        z: 100
    });
    const selectedModelBBoxDes = useSelector(state => state?.printing?.modelGroup?.getSelectedModelBBoxWHD(), shallowEqual);
    // hidden model size after scale
    // const [initModelSize, setInitModelSize] = useState({
    //     x: selectedModelBBoxDes.x / selectedGroup.scale.x,
    //     y: selectedModelBBoxDes.y / selectedGroup.scale.y,
    //     z: selectedModelBBoxDes.z / selectedGroup.scale.z,
    // }); // the model size when scale = 1
    const [modelX, setModelX] = useState(0);
    const [modelY, setModelY] = useState(0);
    // const [modelZ, setModelZ] = useState(0);
    const [uniformScalingState, setUniformScalingState] = useState(true);
    const dispatch = useDispatch();
    const [modelSize, setModelSize] = useState({});
    const updateScale = throttle((event) => {
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
    }, 1000);
    useEffect(() => {
        window.addEventListener('update-scale', updateScale);
        return () => {
            window.removeEventListener('update-scale', updateScale);
        };
    }, []);
    useEffect(() => {
        // hidden model size after scale
        // const updateInitModelSize = {
        //     x: selectedModelBBoxDes.x / selectedGroup.scale.x,
        //     y: selectedModelBBoxDes.y / selectedGroup.scale.y,
        //     z: selectedModelBBoxDes.z / selectedGroup.scale.z,
        // };
        // setInitModelSize(updateInitModelSize);
        if (isPrimeTowerSelected) {
            const originModelSize = {
                scaledX: selectedModelBBoxDes.x / selectedGroup.scale.x,
                scaledY: selectedModelBBoxDes.y / selectedGroup.scale.y,
                scaledZ: selectedModelBBoxDes.z / selectedGroup.scale.z
            };
            setModelX(Number(selectedModelBBoxDes.x.toFixed(1)));
            setModelY(Number(selectedModelBBoxDes.y.toFixed(1)));
            // setModelZ(Number(selectedModelBBoxDes.z.toFixed(1)));
            setModelSize(originModelSize);
        }
        const newScalePercentObj = {
            x: Math.round(Math.abs(transformation.scaleX || 0) * 1000) / 10,
            y: Math.round(Math.abs(transformation.scaleY || 0) * 1000) / 10,
            z: Math.round(Math.abs(transformation.scaleZ || 0) * 1000) / 10
        };
        setScalePercentObj(newScalePercentObj);
        setUniformScalingState(transformation.uniformScalingState);
    }, [selectedModelArray]);

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
    const onModelTransform = (transformations, isReset, _isPrimeTowerSelected = false) => {
        const newTransformation = {};
        let value = null;
        let updateAxis = null;
        Object.keys(transformations).forEach(keyItem => {
            value = transformations[keyItem];
            switch (keyItem) {
                case 'scaleX':
                    if (_isPrimeTowerSelected) {
                        newTransformation.scaleY = (transformation.scaleX > 0 ? value : -value);
                        newTransformation.uniformScalingState = false;
                    }
                    newTransformation.scaleX = (transformation.scaleX > 0 ? value : -value);
                    updateAxis = 'x';
                    break;
                case 'scaleY':
                    if (_isPrimeTowerSelected) {
                        newTransformation.scaleX = (transformation.scaleY > 0 ? value : -value);
                        newTransformation.uniformScalingState = false;
                    }
                    newTransformation.scaleY = (transformation.scaleY > 0 ? value : -value);
                    updateAxis = 'y';
                    break;
                case 'scaleZ':
                    newTransformation.scaleZ = (transformation.scaleZ > 0 ? value : -value);
                    updateAxis = 'z';
                    break;
                default:
                    break;
            }
        });
        dispatch(printingActions.updateSelectedModelTransformation(newTransformation, isReset ? _isPrimeTowerSelected : undefined));
        !isReset && logTransformOperation(HEAD_PRINTING, 'scale', 'input_%');
        emitUpdateControlInputEvent({
            controlValue: {
                mode: SCALE_MODE,
                axis: isReset ? undefined : updateAxis,
                data: {
                    [updateAxis]: newTransformation[`scale${updateAxis.toUpperCase()}`] * 100
                }
            }
        });
    };

    const resetScale = (_isPrimeTowerSelected) => {
        onModelTransform({
            'scaleX': 1,
            'scaleY': 1,
            'scaleZ': _isPrimeTowerSelected ? primeTowerHeight : 1,
            'uniformScalingState': !_isPrimeTowerSelected
        }, true);
        logTransformOperation(HEAD_PRINTING, 'scale', 'reset');
        emitUpdateControlInputEvent({
            controlValue: {
                mode: SCALE_MODE,
                data: {
                    x: 100,
                    y: 100,
                    z: 100
                }
                // axis: updateAxis
            }
        });
        onModelAfterTransform();
    };

    const scaleToFitSelectedModel = () => {
        logTransformOperation(HEAD_PRINTING, 'scale', 'to_fit');
        dispatch(printingActions.scaleToFitSelectedModelWithRotate());
    };

    return (
        <div
            className="position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
            style={{
                marginTop: '112px'
            }}
        >
            <div className={classNames(styles['overlay-title-font'], 'sm-flex justify-space-between border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40')}>
                {i18n._('key-Printing/LeftBar-Scale')}
                <CancelButton
                    onClick={() => setTransformMode('')}
                />
            </div>
            <div className="padding-vertical-16 padding-horizontal-16">
                <div className="sm-flex height-32 margin-bottom-8">
                    <span className="sm-flex-none width-16 color-red-1">X</span>
                    <div className="position-ab sm-flex-none margin-horizontal-24">
                        {isPrimeTowerSelected && (
                            <Input
                                suffix="mm"
                                size="small"
                                min={1}
                                // min={0.1}
                                value={modelX}
                                onChange={(value) => {
                                    onModelTransform({ 'scaleX': value / modelSize.scaledX }, false, isPrimeTowerSelected);
                                    onModelAfterTransform();
                                }}
                                className="margin-right-8"
                            />
                        )}
                        <Input
                            suffix="%"
                            size="small"
                            min={1}
                            disabled={!isSelectedModelAllVisible && !isPrimeTowerSelected}
                            value={scalePercentObj.x}
                            onChange={(value) => {
                                setScalePercentObj((obj) => {
                                    return {
                                        ...obj,
                                        x: value
                                    };
                                });
                                onModelTransform({ 'scaleX': value / 100 }, false, isPrimeTowerSelected);
                                onModelAfterTransform();
                            }}
                        />
                    </div>
                </div>
                <div className="sm-flex height-32 margin-bottom-8">
                    <span className="sm-flex-none width-16 color-green-1">Y</span>
                    <div className="position-ab sm-flex-none margin-horizontal-24">
                        {isPrimeTowerSelected && (
                            <Input
                                suffix="mm"
                                size="small"
                                min={1}
                                value={modelY}
                                onChange={(value) => {
                                    onModelTransform({ 'scaleY': value / modelSize.scaledY }, false, isPrimeTowerSelected);
                                    onModelAfterTransform();
                                }}
                                className="margin-right-8"
                            />
                        )}
                        <Input
                            suffix="%"
                            size="small"
                            min={1}
                            value={scalePercentObj.y}
                            disabled={!isPrimeTowerSelected && !isSelectedModelAllVisible}
                            onChange={(value) => {
                                setScalePercentObj((obj) => {
                                    return {
                                        ...obj,
                                        y: value
                                    };
                                });
                                onModelTransform({ 'scaleY': value / 100 }, false, isPrimeTowerSelected);
                                onModelAfterTransform();
                            }}
                        />
                    </div>
                </div>
                {!isPrimeTowerSelected && (
                    <div className="sm-flex height-32 margin-bottom-8">
                        <span className="sm-flex-none width-16 color-blue-2">Z</span>
                        <div className="position-ab sm-flex-none margin-horizontal-24">
                            {/* hidden model size after scale */}
                            {/* <Input
                                suffix="mm"
                                size="small"
                                min={isPrimeTowerSelected ? 1 : initModelSize.z * 0.01}
                                value={modelZ}
                                onChange={(value) => {
                                    onModelTransform({ 'scaleZ': value / modelSize.scaledZ }, false, isPrimeTowerSelected);
                                    onModelAfterTransform();
                                }}
                                className="margin-right-8"
                            /> */}
                            <Input
                                suffix="%"
                                size="small"
                                min={1}
                                value={scalePercentObj.z}
                                disabled={!isSelectedModelAllVisible}
                                onChange={(value) => {
                                    setScalePercentObj((obj) => {
                                        return {
                                            ...obj,
                                            z: value
                                        };
                                    });
                                    onModelTransform({ 'scaleZ': value / 100 });
                                    onModelAfterTransform();
                                }}
                            />
                        </div>
                    </div>
                )}
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
                <div className={`sm-flex ${includes(longLang, i18next.language) && 'sm-flex-wrap'}`}>
                    {!isPrimeTowerSelected && (
                        <Button
                            className={`margin-top-32 margin-bottom-8 ${!includes(longLang, i18next.language) && 'margin-right-8'}`}
                            type="primary"
                            priority="level-three"
                            width="100%"
                            disabled={!isSelectedModelAllVisible}
                            onClick={scaleToFitSelectedModel}
                        >
                            <span>{i18n._('key-Printing/LeftBar-Scale to Fit')}</span>
                        </Button>
                    )}
                    <Button
                        className={`${isPrimeTowerSelected && 'margin-top-24'} ${!includes(longLang, i18next.language) && 'margin-top-32'}`}
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

ScaleOverlay.propTypes = {
    setTransformMode: PropTypes.func.isRequired,
    onModelAfterTransform: PropTypes.func.isRequired,
};
export default ScaleOverlay;
