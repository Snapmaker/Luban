import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';
import { throttle } from 'lodash';
import i18n from '../../../../lib/i18n';
import { actions as printingActions } from '../../../../flux/printing';
/* eslint-disable-next-line import/no-cycle */
import { CancelButton } from '../VisualizerLeftBar';
import { NumberInput as Input } from '../../../components/Input';
import Checkbox from '../../../components/Checkbox';
import { Button } from '../../../components/Buttons';
import { updateControlInputEvent } from '../../../components/SMCanvas/TransformControls';
import { SCALE_MODE } from '../../../../constants';

const ScaleOverlay = React.memo(({
    setTransformMode,
    onModelAfterTransform,
    size
}) => {
    const isPrimeTowerSelected = useSelector(state => state?.printing?.modelGroup?.isPrimeTowerSelected());
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray);
    const transformation = useSelector(state => state?.printing?.modelGroup?.getSelectedModelTransformationForPrinting(), shallowEqual);
    const primeTowerHeight = useSelector(state => state?.printing?.primeTowerHeight, shallowEqual);
    const selectedModelBBoxDes = useSelector(state => state?.printing?.modelGroup?.getSelectedModelBBoxWHD());
    const selectedGroup = useSelector(state => state?.printing?.modelGroup?.selectedGroup, shallowEqual);
    const [scalePercentObj, setScalePercentObj] = useState({
        x: 100,
        y: 100,
        z: 100
    });
    const [initModelSize, setInitModelSize] = useState({
        x: selectedModelBBoxDes.x / selectedGroup.scale.x,
        y: selectedModelBBoxDes.y / selectedGroup.scale.y,
        z: selectedModelBBoxDes.z / selectedGroup.scale.z,
    }); // the model size when scale = 1
    const [modelX, setModelX] = useState(0);
    const [modelY, setModelY] = useState(0);
    const [modelZ, setModelZ] = useState(0);
    const [uniformScalingState, setUniformScalingState] = useState(true);
    const dispatch = useDispatch();
    const [modelSize, setModelSize] = useState({});
    // const [updateAxis, setUpdateAxis] = useState('');
    const updateScale = (event) => {
        const { detail } = event;
        throttle(() => {
            setScalePercentObj(detail.scale);
            setModelX(Math.round(detail.scale.x * initModelSize.x) / 100);
            setModelY(Math.round(detail.scale.y * initModelSize.y) / 100);
            setModelZ(Math.round(detail.scale.z * initModelSize.z) / 100);
            !detail.isPrimeTower && setModelZ(Math.round(detail.scale.z * initModelSize.z) / 100);
        }, 1000)();
    };
    useEffect(() => {
        window.addEventListener('update-scale', updateScale);
        return () => {
            window.removeEventListener('update-scale', updateScale);
        };
    }, []);
    useEffect(() => {
        const updateInitModelSize = {
            x: selectedModelBBoxDes.x / selectedGroup.scale.x,
            y: selectedModelBBoxDes.y / selectedGroup.scale.y,
            z: selectedModelBBoxDes.z / selectedGroup.scale.z,
        };
        setInitModelSize(updateInitModelSize);
        const originModelSize = {
            scaledX: selectedModelBBoxDes.x / selectedGroup.scale.x,
            scaledY: selectedModelBBoxDes.y / selectedGroup.scale.y,
            scaledZ: selectedModelBBoxDes.z / selectedGroup.scale.z
        };
        setModelX(Number(selectedModelBBoxDes.x.toFixed(1)));
        setModelY(Number(selectedModelBBoxDes.y.toFixed(1)));
        setModelZ(Number(selectedModelBBoxDes.z.toFixed(1)));
        setModelSize(originModelSize);
        const newScalePercentObj = {
            x: Math.round(Math.abs(transformation.scaleX) * 1000) / 10,
            y: Math.round(Math.abs(transformation.scaleY) * 1000) / 10,
            z: Math.round(Math.abs(transformation.scaleZ) * 1000) / 10
        };
        setScalePercentObj(newScalePercentObj);
        setUniformScalingState(transformation.uniformScalingState);
    }, [selectedModelArray]);

    const changeUniformScalingState = (_uniformScalingState) => {
        const newTransformation = {
            uniformScalingState: !_uniformScalingState
        };
        dispatch(printingActions.updateSelectedModelTransformation(newTransformation));
        onModelAfterTransform();
    };
    const onModelTransform = (transformations, isReset, _isPrimeTowerSelected = false) => {
        const newTransformation = {};
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
        dispatch(printingActions.updateSelectedModelTransformation(newTransformation, isReset ? _isPrimeTowerSelected : false));
    };

    const resetScale = (_isPrimeTowerSelected) => {
        onModelTransform({
            'scaleX': 1,
            'scaleY': 1,
            'scaleZ': _isPrimeTowerSelected ? primeTowerHeight : 1,
            'uniformScalingState': !_isPrimeTowerSelected
        }, true);
        window.dispatchEvent(updateControlInputEvent({
            controlValue: {
                mode: SCALE_MODE,
                data: {
                    x: 100,
                    y: 100,
                    z: 100
                }
                // axis: updateAxis
            }
        }));
        onModelAfterTransform();
    };

    const scaleToFitSelectedModel = () => {
        const scalar = ['x', 'y', 'z'].reduce((prev, key) => Math.min((size[key] - 5) / selectedModelBBoxDes[key], prev), Number.POSITIVE_INFINITY);
        const newTransformation = {
            scaleX: scalar * transformation.scaleX,
            scaleY: scalar * transformation.scaleY,
            scaleZ: scalar * transformation.scaleZ,
            positionX: 0,
            positionY: 0
        };
        dispatch(printingActions.updateSelectedModelTransformation(newTransformation));
        onModelAfterTransform();
    };

    return (
        <div
            className="position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
            style={{
                marginTop: '112px'
            }}
        >
            <div className="sm-flex justify-space-between border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40">
                {i18n._('key-Printing/LeftBar-Scale')}
                <CancelButton
                    onClick={() => setTransformMode('')}
                />
            </div>
            <div className="padding-vertical-16 padding-horizontal-16">
                <div className="sm-flex height-32 margin-bottom-8">
                    <span className="sm-flex-auto width-16 color-red-1">X</span>
                    <div className="position-ab sm-flex-auto margin-horizontal-24">
                        <Input
                            suffix="mm"
                            size="small"
                            min={1}
                            value={modelX}
                            onChange={(value) => {
                                onModelTransform({ 'scaleX': value / modelSize.scaledX }, false, true);
                                onModelAfterTransform();
                            }}
                            className="margin-right-8"
                        />
                        <Input
                            suffix="%"
                            size="small"
                            min={1}
                            value={scalePercentObj.x}
                            onChange={(value) => {
                                onModelTransform({ 'scaleX': value / 100 }, false, isPrimeTowerSelected);
                                onModelAfterTransform();
                            }}
                        />
                    </div>
                </div>
                <div className="sm-flex height-32 margin-bottom-8">
                    <span className="sm-flex-auto width-16 color-green-1">Y</span>
                    <div className="position-ab sm-flex-auto margin-horizontal-24">
                        <Input
                            suffix="mm"
                            size="small"
                            min={1}
                            value={modelY}
                            onChange={(value) => {
                                onModelTransform({ 'scaleY': value / modelSize.scaledY }, false, true);
                                onModelAfterTransform();
                            }}
                            className="margin-right-8"
                        />
                        <Input
                            suffix="%"
                            size="small"
                            min={1}
                            value={scalePercentObj.y}
                            onChange={(value) => {
                                onModelTransform({ 'scaleY': value / 100 }, false, isPrimeTowerSelected);
                                onModelAfterTransform();
                            }}
                        />
                    </div>
                </div>
                {!isPrimeTowerSelected && (
                    <div className="sm-flex height-32 margin-bottom-8">
                        <span className="sm-flex-auto width-16 color-blue-2">Z</span>
                        <div className="position-ab sm-flex-auto margin-horizontal-24">
                            <Input
                                suffix="mm"
                                size="small"
                                min={1}
                                value={modelZ}
                                onChange={(value) => {
                                    onModelTransform({ 'scaleZ': value / modelSize.scaledZ }, false, true);
                                    onModelAfterTransform();
                                }}
                                className="margin-right-8"
                            />
                            <Input
                                suffix="%"
                                size="small"
                                min={1}
                                value={scalePercentObj.z}
                                onChange={(value) => {
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
                            changeUniformScalingState(uniformScalingState); // Todo: bug, state error
                        }}
                        disabled={isPrimeTowerSelected}
                    />
                    <span
                        className="height-20 margin-horizontal-8"
                    >
                        {i18n._('key-Printing/LeftBar-Uniform Scaling')}
                    </span>
                </div>
                <div className="sm-flex">
                    {!isPrimeTowerSelected && (
                        <Button
                            className="margin-top-32 margin-right-8"
                            type="primary"
                            priority="level-three"
                            width="100%"
                            onClick={scaleToFitSelectedModel}
                        >
                            <span>{i18n._('key-Printing/LeftBar-Scale to Fit')}</span>
                        </Button>
                    )}
                    <Button
                        className="margin-top-32 margin-left-8"
                        type="primary"
                        priority="level-three"
                        width="100%"
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
    size: PropTypes.object.isRequired
};
export default ScaleOverlay;
