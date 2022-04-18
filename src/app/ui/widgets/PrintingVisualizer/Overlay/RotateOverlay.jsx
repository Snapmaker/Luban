import React, { useState, useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { throttle, filter, isUndefined, isNull } from 'lodash';
import i18n from '../../../../lib/i18n';
import { actions as printingActions } from '../../../../flux/printing';
/* eslint-disable-next-line import/no-cycle */
import { CancelButton } from '../VisualizerLeftBar';
import modal from '../../../../lib/modal';
import { NumberInput as Input } from '../../../components/Input';
import { Button } from '../../../components/Buttons';
import SvgIcon from '../../../components/SvgIcon';
import { EPSILON, HEAD_PRINTING } from '../../../../constants';
import ThreeGroup from '../../../../models/ThreeGroup';
import ThreeModel from '../../../../models/ThreeModel';
import ThreeUtils from '../../../../three-extensions/ThreeUtils';
import { logTransformOperation } from '../../../utils/gaEvent';

const isNonUniformScaled = (autoRotateModelArray) => {
    const result = autoRotateModelArray.every(modelItem => {
        const { scaleX, scaleY, scaleZ } = modelItem.transformation;
        return Math.abs(Math.abs(scaleX) - Math.abs(scaleY)) > EPSILON
            || Math.abs(Math.abs(scaleX) - Math.abs(scaleZ)) > EPSILON
            || Math.abs(Math.abs(scaleY) - Math.abs(scaleZ)) > EPSILON;
    });
    return result;
};

const rotateOnlyForUniformScale = (rotateFn, autoRotateModelArray) => {
    if (isNonUniformScaled(autoRotateModelArray)) {
        modal({
            cancelTitle: i18n._('key-Modal/Common-OK'),
            title: i18n._('key-Printing/Rotation-error title'),
            body: i18n._('key-Printing/Rotation-error tips')
        });
    } else {
        rotateFn && rotateFn();
    }
};

// const initQuaternion = new THREE.Quaternion();

const RotateOverlay = React.memo(({
    setTransformMode,
    onModelAfterTransform,
    rotateWithAnalysis,
    hasModels,
    autoRotateSelectedModel,
    setHoverFace,
    transformDisabled
}) => {
    const [rotateX, setRotateX] = useState(null);
    const [rotateY, setRotateY] = useState(null);
    const [rotateZ, setRotateZ] = useState(null);
    const modelGroup = useSelector(state => state?.printing?.modelGroup);
    const models = modelGroup.models;
    const selectedModelArray = modelGroup.selectedModelArray;
    const isSelectedModelAllVisible = useSelector(state => state?.printing?.modelGroup?.isSelectedModelAllVisible(), shallowEqual);
    const modelExcludePrimeTower = filter(selectedModelArray, (item) => {
        return item.type !== 'primeTower';
    });
    const isSingleSelected = modelExcludePrimeTower.length === 1 && isSelectedModelAllVisible;
    // const [hasSelectedModel, setHasSelectedModel] = useState(false);
    // const [isSingleSelected, setIsSingleSelected] = useState(false);
    const rotationAnalysisEnableForSelected = hasModels && selectedModelArray.length && selectedModelArray.every((modelItem) => {
        return modelItem instanceof ThreeGroup || modelItem instanceof ThreeModel;
    });
    const dispatch = useDispatch();
    const updateRotate = (event) => {
        const { detail } = event;
        throttle(() => {
            !isUndefined(detail.rotate.x) && setRotateX(isNull(detail.rotate.x) ? null : detail.rotate.x);
            !isUndefined(detail.rotate.y) && setRotateY(isNull(detail.rotate.y) ? null : detail.rotate.y);
            !isUndefined(detail.rotate.z) && setRotateZ(isNull(detail.rotate.z) ? null : detail.rotate.z);
        }, 1000)();
    };
    useEffect(() => {
        window.addEventListener('update-rotate', updateRotate);
        return () => {
            window.removeEventListener('update-rotate', updateRotate);
        };
    }, []);

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

    const autoRotate = () => {
        const autoRotateModelArray = rotationAnalysisEnableForSelected ? selectedModelArray : modelGroup.getModels('primeTower');
        rotateOnlyForUniformScale(() => {
            autoRotateSelectedModel();
        }, autoRotateModelArray);
        logTransformOperation(HEAD_PRINTING, 'roate', 'auto');
    };

    const resetRotation = () => {
        onModelTransform({
            'rotateX': THREE.Math.degToRad(0),
            'rotateY': THREE.Math.degToRad(0),
            'rotateZ': THREE.Math.degToRad(0)
        });
        onModelAfterTransform();
        logTransformOperation(HEAD_PRINTING, 'roate', 'reset');
    };

    const rotateByDirection = (rotateAxis, rotateAngle, type) => {
        dispatch(printingActions.recordModelBeforeTransform(modelGroup));
        const _rotateAxis = new THREE.Vector3(rotateAxis === 'X' ? 1 : 0, rotateAxis === 'Y' ? 1 : 0, rotateAxis === 'Z' ? 1 : 0);
        const quaternion = new THREE.Quaternion().setFromAxisAngle(_rotateAxis, THREE.Math.degToRad(rotateAngle));
        if (type === 'freeRotate') {
            selectedModelArray.forEach(modelItem => {
                if (!modelItem.visible) return;
                const revertParent = ThreeUtils.removeObjectParent(modelItem.meshObject);
                // initQuaternion.copy(modelItem.meshObject.quaternion);
                modelItem.meshObject.applyQuaternion(quaternion);
                modelItem.meshObject.updateMatrix();
                revertParent();
            });
            logTransformOperation(HEAD_PRINTING, 'roate', 'free');
        } else if (type === 'direction') {
            const meshObject = selectedModelArray[0].meshObject;
            const revertParent = ThreeUtils.removeObjectParent(meshObject);
            selectedModelArray[0].meshObject.applyQuaternion(quaternion);
            selectedModelArray[0].meshObject.updateMatrix();
            revertParent();
            logTransformOperation(HEAD_PRINTING, 'roate', 'direction');
        }
        modelGroup.onModelAfterTransform();
        dispatch(printingActions.recordModelAfterTransform('rotate', modelGroup));
        dispatch(printingActions.destroyGcodeLine());
        dispatch(printingActions.displayModel());
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
                <div className="padding-bottom-16 border-bottom-dashed">
                    <div className="heading-3-normal">{i18n._('key-Printing/LeftBar-Auto Rotate')}</div>
                    <Button
                        className="margin-top-8"
                        type="primary"
                        priority="level-three"
                        width="100%"
                        onClick={autoRotate}
                        disabled={models.length === 0}
                    >
                        {i18n._(`${rotationAnalysisEnableForSelected ? 'key-Printing/LeftBar-Auto Rotate Selected Models' : 'key-Printing/LeftBar-Auto Rotate All Models'}`)}
                    </Button>
                </div>
                <div className="padding-vertical-16 border-bottom-dashed">
                    <div className="heading-3-normal">
                        {i18n._('key-Printing/LeftBar-Rotate By Direction')}
                    </div>
                    <div className="sm-flex margin-top-8">
                        <SvgIcon
                            name="ViewLeft"
                            size={24}
                            type={['static']}
                            disabled={!isSingleSelected || !!transformDisabled}
                            onClick={() => rotateByDirection('Y', -90, 'direction')}
                            onMouseEnter={() => {
                                setHoverFace('left');
                            }}
                            onMouseLeave={() => {
                                setHoverFace('null');
                            }}
                        />
                        <SvgIcon
                            className="margin-left-8"
                            name="ViewFront"
                            size={24}
                            type={['static']}
                            disabled={!isSingleSelected || !!transformDisabled}
                            onClick={() => rotateByDirection('X', 90, 'direction')}
                            onMouseEnter={() => {
                                setHoverFace('front');
                            }}
                            onMouseLeave={() => {
                                setHoverFace('null');
                            }}
                        />
                        <SvgIcon
                            className="margin-left-8"
                            name="ViewRight"
                            size={24}
                            type={['static']}
                            disabled={!isSingleSelected || !!transformDisabled}
                            onClick={() => rotateByDirection('Y', 90, 'direction')}
                            onMouseEnter={() => {
                                setHoverFace('right');
                            }}
                            onMouseLeave={() => {
                                setHoverFace('null');
                            }}
                        />
                        <SvgIcon
                            className="margin-left-8"
                            name="ViewBack"
                            size={24}
                            type={['static']}
                            disabled={!isSingleSelected || !!transformDisabled}
                            onClick={() => rotateByDirection('X', -90, 'direction')}
                            onMouseEnter={() => {
                                setHoverFace('back');
                            }}
                            onMouseLeave={() => {
                                setHoverFace('null');
                            }}
                        />
                        <SvgIcon
                            className="margin-left-8"
                            name="ViewTop"
                            size={24}
                            type={['static']}
                            disabled={!isSingleSelected || !!transformDisabled}
                            onClick={() => rotateByDirection('X', 180, 'direction')}
                            onMouseEnter={() => {
                                setHoverFace('top');
                            }}
                            onMouseLeave={() => {
                                setHoverFace('null');
                            }}
                        />
                    </div>
                    <Button
                        className="margin-top-16"
                        type="primary"
                        priority="level-three"
                        width="100%"
                        disabled={!isSingleSelected || !!transformDisabled}
                        onClick={rotateWithAnalysis}
                    >
                        <span>{i18n._('key-Printing/LeftBar-Rotate on Face')}</span>
                    </Button>
                </div>
                <div className="padding-top-16">
                    <div className="heading-3-normal">
                        {i18n._('key-Printing/LeftBar-Free Rotate')}
                    </div>
                    <div className="sm-flex height-32 margin-vertical-8">
                        <span className="sm-flex-auto width-16 color-red-1">X</span>
                        <div className="position-ab sm-flex-auto margin-horizontal-24">
                            <Input
                                size="large"
                                placeholder={i18n._('key-Printing/LeftBar-Enter an degree')}
                                value={rotateX}
                                suffix="°"
                                allowUndefined
                                disabled={!isSelectedModelAllVisible || !!transformDisabled}
                                onPressEnter={(e) => {
                                    rotateByDirection('X', e.target.value, 'freeRotate');
                                }}
                            />
                        </div>
                    </div>
                    <div className="sm-flex height-32 margin-bottom-8">
                        <span className="sm-flex-auto width-16 color-green-1">Y</span>
                        <div className="position-ab sm-flex-auto margin-horizontal-24">
                            <Input
                                size="large"
                                placeholder={i18n._('key-Printing/LeftBar-Enter an degree')}
                                suffix="°"
                                value={rotateY}
                                allowUndefined
                                disabled={!isSelectedModelAllVisible || !!transformDisabled}
                                onPressEnter={(e) => {
                                    rotateByDirection('Y', e.target.value, 'freeRotate');
                                }}
                            />
                        </div>
                    </div>
                    <div className="sm-flex height-32 margin-bottom-8">
                        <span className="sm-flex-auto width-16 color-blue-2">Z</span>
                        <div className="position-ab sm-flex-auto margin-horizontal-24">
                            <Input
                                size="large"
                                placeholder={i18n._('key-Printing/LeftBar-Enter an degree')}
                                suffix="°"
                                value={rotateZ}
                                disabled={!isSelectedModelAllVisible || !!transformDisabled}
                                allowUndefined
                                onPressEnter={(e) => {
                                    rotateByDirection('Z', e.target.value, 'freeRotate');
                                }}
                            />
                        </div>
                    </div>
                    <Button
                        className="margin-top-8"
                        type="primary"
                        priority="level-three"
                        width="100%"
                        onClick={resetRotation}
                        disabled={!isSelectedModelAllVisible || !!transformDisabled}
                    >
                        <span>{i18n._('key-Printing/LeftBar-Reset')}</span>
                    </Button>
                </div>
            </div>
        </div>
    );
});

RotateOverlay.propTypes = {
    setTransformMode: PropTypes.func.isRequired,
    onModelAfterTransform: PropTypes.func.isRequired,
    rotateWithAnalysis: PropTypes.func.isRequired,
    hasModels: PropTypes.bool.isRequired,
    autoRotateSelectedModel: PropTypes.func.isRequired,
    setHoverFace: PropTypes.func.isRequired,
    transformDisabled: PropTypes.bool.isRequired
};
export default RotateOverlay;
