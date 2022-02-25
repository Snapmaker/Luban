import React, { useState, useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { throttle } from 'lodash';
import i18n from '../../../../lib/i18n';
import { actions as printingActions } from '../../../../flux/printing';
/* eslint-disable-next-line import/no-cycle */
import { CancelButton } from '../VisualizerLeftBar';
import modal from '../../../../lib/modal';
import { NumberInput as Input } from '../../../components/Input';
import { Button } from '../../../components/Buttons';
import { EPSILON } from '../../../../constants';

const RotateOverlay = ({
    setTransformMode,
    onModelAfterTransform,
    rotateWithAnalysis,
    autoRotateSelectedModel
}) => {
    const [rotateX, setRotateX] = useState(0);
    const [rotateY, setRotateY] = useState(0);
    const [rotateZ, setRotateZ] = useState(0);
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray);
    const rotationAnalysisEnable = (selectedModelArray.length === 1 && selectedModelArray[0].visible && !selectedModelArray[0].parent);
    const transformation = useSelector(state => state?.printing?.modelGroup?.getSelectedModelTransformationForPrinting(), shallowEqual);
    const dispatch = useDispatch();
    const updateRotate = (detail) => {
        throttle(() => {
            setRotateX(Math.round(THREE.Math.radToDeg(detail.rotate.x) * 10) / 10);
            setRotateY(Math.round(THREE.Math.radToDeg(detail.rotate.y) * 10) / 10);
            setRotateZ(Math.round(THREE.Math.radToDeg(detail.rotate.z) * 10) / 10);
        }, 1000)();
    };
    useEffect(() => {
        window.addEventListener('update-rotate', ({ detail }) => {
            updateRotate(detail);
        });
        return () => {
            window.removeEventListener('update-rotate', ({ detail }) => {
                updateRotate(detail);
            });
        };
    }, []);

    useEffect(() => {
        setRotateX(Math.round(THREE.Math.radToDeg(transformation.rotationX) * 10) / 10);
        setRotateY(Math.round(THREE.Math.radToDeg(transformation.rotationY) * 10) / 10);
        setRotateZ(Math.round(THREE.Math.radToDeg(transformation.rotationZ) * 10) / 10);
    }, [selectedModelArray]);

    const onModelTransform = (transformations) => {
        const newTransformation = {};
        Object.keys(transformations).forEach(keyItem => {
            const value = transformations[keyItem];
            switch (keyItem) {
                case 'rotateX':
                    newTransformation.rotationX = value;
                    break;
                case 'rotateY':
                    newTransformation.rotationY = value;
                    break;
                case 'rotateZ':
                    newTransformation.rotationZ = value;
                    break;
                default:
                    break;
            }
        });
        dispatch(printingActions.updateSelectedModelTransformation(newTransformation));
    };

    const isNonUniformScaled = () => {
        const { scaleX, scaleY, scaleZ } = selectedModelArray[0].transformation;
        return Math.abs(Math.abs(scaleX) - Math.abs(scaleY)) > EPSILON
            || Math.abs(Math.abs(scaleX) - Math.abs(scaleZ)) > EPSILON
            || Math.abs(Math.abs(scaleY) - Math.abs(scaleZ)) > EPSILON;
    };

    const rotateOnlyForUniformScale = (rotateFn) => {
        if (isNonUniformScaled()) {
            modal({
                cancelTitle: i18n._('key-Modal/Common-OK'),
                title: i18n._('key-Printing/Rotation-error title'),
                body: i18n._('key-Printing/Rotation-error tips')
            });
        } else {
            rotateFn && rotateFn();
        }
    };

    const autoRotate = () => {
        rotateOnlyForUniformScale(() => {
            autoRotateSelectedModel();
        });
    };

    const resetRotation = () => {
        onModelTransform({
            'rotateX': 0,
            'rotateY': 0,
            'rotateZ': 0
        });
        onModelAfterTransform();
    };

    return (
        <div
            className="position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
            style={{
                marginTop: '164px'
            }}
        >
            <div className="sm-flex justify-space-between border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40">
                {i18n._('key-Printing/LeftBar-Rotate')}
                <CancelButton
                    onClick={() => setTransformMode('')}
                />
            </div>
            <div className="padding-vertical-16 padding-horizontal-16">
                <div className="sm-flex height-32 margin-bottom-8">
                    <span className="sm-flex-auto width-16 color-red-1">X</span>
                    <div className="position-ab sm-flex-auto margin-horizontal-24">
                        <Input
                            size="small"
                            min={-180}
                            max={180}
                            value={rotateX}
                            suffix="°"
                            onChange={(degree) => {
                                onModelTransform({ 'rotateX': THREE.Math.degToRad(degree) });
                                onModelAfterTransform();
                            }}
                        />
                    </div>
                </div>
                <div className="sm-flex height-32 margin-bottom-8">
                    <span className="sm-flex-auto width-16 color-green-1">Y</span>
                    <div className="position-ab sm-flex-auto margin-horizontal-24">
                        <Input
                            size="small"
                            min={-180}
                            max={180}
                            suffix="°"
                            value={rotateY}
                            onChange={(degree) => {
                                onModelTransform({ 'rotateY': THREE.Math.degToRad(degree) });
                                onModelAfterTransform();
                            }}
                        />
                    </div>
                </div>
                <div className="sm-flex height-32 margin-bottom-8">
                    <span className="sm-flex-auto width-16 color-blue-2">Z</span>
                    <div className="position-ab sm-flex-auto margin-horizontal-24">
                        <Input
                            size="small"
                            min={-180}
                            max={180}
                            suffix="°"
                            value={rotateZ}
                            onChange={(degree) => {
                                onModelTransform({ 'rotateZ': THREE.Math.degToRad(degree) });
                                onModelAfterTransform();
                            }}
                        />
                    </div>
                </div>
                <div className="sm-flex">
                    <Button
                        className="margin-top-32 margin-right-8"
                        type="primary"
                        priority="level-three"
                        width="100%"
                        onClick={autoRotate}
                        disabled={!rotationAnalysisEnable}
                    >
                        <span>{i18n._('key-Printing/LeftBar-Auto Rotate')}</span>
                    </Button>
                    <Button
                        className="margin-top-32 margin-left-8"
                        type="primary"
                        priority="level-three"
                        width="100%"
                        onClick={resetRotation}
                    >
                        <span>{i18n._('key-Printing/LeftBar-Reset')}</span>
                    </Button>
                </div>
                <div className="sm-flex">
                    <Button
                        className="margin-top-16"
                        type="primary"
                        priority="level-three"
                        width="100%"
                        disabled={!rotationAnalysisEnable}
                        onClick={rotateWithAnalysis}
                    >
                        <span>{i18n._('key-Printing/LeftBar-Rotate on Face')}</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};

RotateOverlay.propTypes = {
    setTransformMode: PropTypes.func.isRequired,
    onModelAfterTransform: PropTypes.func.isRequired,
    rotateWithAnalysis: PropTypes.func.isRequired,
    autoRotateSelectedModel: PropTypes.func.isRequired
};
export default RotateOverlay;
