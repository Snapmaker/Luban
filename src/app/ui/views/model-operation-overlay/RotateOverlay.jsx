import React, { useState, useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { throttle, filter, isUndefined, isNull } from 'lodash';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import { actions as printingActions } from '../../../flux/printing';
/* eslint-disable-next-line import/no-cycle */
import { CancelButton } from '../../widgets/PrintingVisualizer/VisualizerLeftBar';
import modal from '../../../lib/modal';
import ThreeGroup from '../../../models/ThreeGroup';
import { NumberInput as Input } from '../../components/Input';
import { Button } from '../../components/Buttons';
import SvgIcon from '../../components/SvgIcon';
import { EPSILON, HEAD_PRINTING } from '../../../constants';
import ThreeUtils from '../../../scene/three-extensions/ThreeUtils';
import { logTransformOperation } from '../../../lib/gaEvent';
import styles from './styles.styl';

const isNonUniformScaled = (autoRotateModelArray) => {
    if (autoRotateModelArray.length === 1) {
        if (autoRotateModelArray[0] instanceof ThreeGroup) {
            return autoRotateModelArray[0].children.some(modelItem => {
                const { scaleX, scaleY, scaleZ } = modelItem.transformation;
                return Math.abs(Math.abs(scaleX) - Math.abs(scaleY)) > EPSILON
                    || Math.abs(Math.abs(scaleX) - Math.abs(scaleZ)) > EPSILON
                    || Math.abs(Math.abs(scaleY) - Math.abs(scaleZ)) > EPSILON;
            });
        } else {
            return false;
        }
    }
    return autoRotateModelArray.some(modelItem => {
        const { scaleX, scaleY, scaleZ } = modelItem.transformation;
        return Math.abs(Math.abs(scaleX) - Math.abs(scaleY)) > EPSILON
            || Math.abs(Math.abs(scaleX) - Math.abs(scaleZ)) > EPSILON
            || Math.abs(Math.abs(scaleY) - Math.abs(scaleZ)) > EPSILON;
    });
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
    const isPrimeTowerSelected = useSelector(state => state?.printing?.modelGroup?.isPrimeTowerSelected());

    const modelExcludePrimeTower = filter(selectedModelArray, (item) => {
        return item.type !== 'primeTower';
    });
    const isSingleSelected = modelExcludePrimeTower.length === 1 && isSelectedModelAllVisible;
    // const [hasSelectedModel, setHasSelectedModel] = useState(false);
    // const [isSingleSelected, setIsSingleSelected] = useState(false);
    const rotationAnalysisEnableForSelected = hasModels && !isPrimeTowerSelected && isSelectedModelAllVisible;
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
        const autoRotateModelArray = rotationAnalysisEnableForSelected ? selectedModelArray : modelGroup.getVisibleModels();
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

    const disabled = !isSingleSelected || !!transformDisabled;

    const faceDownMannuallySvgs = () => {
        const dataModal = [{
            name: 'ViewLeft',
            click: () => rotateByDirection('Y', -90, 'direction'),
            mouseEnter: () => setHoverFace('left'),
        }, {
            name: 'ViewFront',
            click: () => rotateByDirection('X', 90, 'direction'),
            mouseEnter: () => setHoverFace('front'),
        }, {
            name: 'ViewRight',
            click: () => rotateByDirection('Y', 90, 'direction'),
            mouseEnter: () => setHoverFace('right'),
        }, {
            name: 'ViewBack',
            click: () => rotateByDirection('X', -90, 'direction'),
            mouseEnter: () => setHoverFace('back'),
        }, {
            name: 'ViewTop',
            click: () => rotateByDirection('X', 180, 'direction'),
            mouseEnter: () => setHoverFace('top'),
        }];

        return dataModal.map(v => (
            <div key={v.name} className={classNames(styles['rotate-svg'])} disabled={disabled}>
                <SvgIcon
                    name={v.name}
                    size={24}
                    type={['static']}
                    disabled={disabled}
                    onClick={v.click}
                    onMouseEnter={() => {
                        if (!disabled) {
                            v.mouseEnter();
                        }
                    }}
                    onMouseLeave={() => setHoverFace('null')}
                />
            </div>

        ));
    };

    return (
        <div
            className="position-absolute width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
            style={{
                marginTop: '164px'
            }}
        >
            <div className={classNames(styles['overlay-title-font'], 'sm-flex justify-space-between border-bottom-normal padding-horizontal-16 height-40')}>
                {i18n._('key-Printing/LeftBar-Rotate')}
                <CancelButton
                    onClick={() => setTransformMode('')}
                />
            </div>
            <div className="padding-top-12 padding-bottom-16 padding-horizontal-16">
                <div>
                    <div className={classNames(styles['overlay-sub-title-font'])}>{i18n._('key-Printing/LeftBar-Auto Rotate')}</div>
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

                <div className={classNames(styles['dashed-line'])} />
                <div className="padding-top-12">
                    <div className={classNames(styles['overlay-sub-title-font'])}>
                        {i18n._('key-Printing/LeftBar-Rotate By Direction')}
                    </div>
                    <div className="sm-flex margin-top-4">
                        {faceDownMannuallySvgs()}
                    </div>
                    <Button
                        className="margin-top-4"
                        type="primary"
                        priority="level-three"
                        width="100%"
                        disabled={!isSingleSelected || !!transformDisabled}
                        onClick={rotateWithAnalysis}
                    >
                        <span>{i18n._('key-Printing/LeftBar-Rotate on Face')}</span>
                    </Button>
                </div>
                <div className={classNames(styles['dashed-line'])} />
                <div className="padding-top-12">
                    <div className={classNames(styles['overlay-sub-title-font'])}>
                        {i18n._('key-Printing/LeftBar-Free Rotate')}
                    </div>
                    <div className="sm-flex height-32 margin-vertical-8">
                        <span className="sm-flex-auto width-16 color-red-1">X</span>
                        <div className="position-absolute sm-flex-auto margin-horizontal-24">
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
                        <div className="position-absolute sm-flex-auto margin-horizontal-24">
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
                        <div className="position-absolute sm-flex-auto margin-horizontal-24">
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
