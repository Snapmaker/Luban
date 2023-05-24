import React, { useEffect, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { Spin } from 'antd';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import STLLoader from '../../../scene/three-extensions/STLLoader';
import { EPS, toFixed } from '../../../lib/numeric-utils';
import { NumberInput as Input } from '../../components/Input';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';
import { HEAD_LASER, DATA_PREFIX } from '../../../constants';
import { actions as editorActions } from '../../../flux/editor';
import { actions as menuActions } from '../../../flux/appbar-menu';
import ModelViewer from './Canvas';

let scale = 1, canvasRange = {};
const MAX_Z = 500, MIN_SIZE = 0.1, MAX_THICKNESS = 50, DEFAULT_THICKNESS = 1.5;

const StackedModel = ({ setStackedModelModalDsiabled }) => {
    const { isProcessing = false, svgInfo, stlInfo, modelInitSize, initScale } = useSelector(state => state[HEAD_LASER].cutModelInfo);
    const coordinateSize = useSelector(state => state[HEAD_LASER].coordinateSize, shallowEqual);
    const [disabled, setDisabled] = useState(false);
    const [size, setSize] = useState(modelInitSize);
    const [cuttingModel, setCuttingModel] = useState(false);
    const [modelGeometry, setModelGeometry] = useState(null);
    const [thickness, setThickness] = useState(DEFAULT_THICKNESS);
    const dispatch = useDispatch();

    function findSuitableScale(curScale, limit) {
        const scaleX = limit.x / modelInitSize.x;
        const scaleY = limit.y / modelInitSize.y;
        const scaleZ = limit.z / modelInitSize.z;

        const maxScale = Math.min(scaleX, scaleY, scaleZ);
        return Math.min(maxScale, curScale);
    }

    const actions = {
        loadModel: () => {
            // load cutted model
            if (!stlInfo) return;
            new STLLoader().load(
                `${DATA_PREFIX}/${stlInfo.filename}`,
                (geometry) => {
                    geometry.computeBoundingBox();
                    const box3 = geometry.boundingBox;
                    const x = -(box3.max.x + box3.min.x) / 2;
                    const y = -(box3.max.y + box3.min.y) / 2;
                    const z = -(box3.max.z + box3.min.z) / 2;
                    geometry.translate(x, y, z);
                    geometry.scale(1, -1, 1);
                    setModelGeometry(geometry);
                    setCuttingModel(false);
                },
                () => {},
                () => {
                    setCuttingModel(false);
                }
            );
        },
        generateModelStack: () => {
            setCuttingModel(true);
            dispatch(editorActions.generateModelStack(HEAD_LASER, size.x, size.y, thickness, scale));
        },
        onChangeLogicalX: (value) => {
            if (value !== toFixed(size.x, 1)) {
                const curScale = value / modelInitSize.x;
                if (Math.abs(scale - curScale) > EPS) {
                    scale = findSuitableScale(curScale, canvasRange);
                    setSize({
                        x: modelInitSize.x * scale,
                        y: modelInitSize.y * scale,
                        z: modelInitSize.z * scale
                    });
                }
            }
        },
        onChangeLogicalY: (value) => {
            if (value !== toFixed(size.y, 1)) {
                const curScale = value / modelInitSize.y;
                if (Math.abs(scale - curScale) > EPS) {
                    scale = findSuitableScale(curScale, canvasRange);
                    setSize({
                        x: modelInitSize.x * scale,
                        y: modelInitSize.y * scale,
                        z: modelInitSize.z * scale
                    });
                }
            }
        },
        onChangeLogicalZ: (value) => {
            if (value !== toFixed(size.z, 1)) {
                const curScale = value / modelInitSize.z;
                if (Math.abs(scale - curScale) > EPS) {
                    scale = findSuitableScale(curScale, canvasRange);
                    setSize({
                        x: modelInitSize.x * scale,
                        y: modelInitSize.y * scale,
                        z: modelInitSize.z * scale
                    });
                }
            }
        },
        onChangeMaterialThick: (value) => {
            if (value !== thickness) {
                setThickness(value);
            }
        }
    };
    useEffect(() => {
        dispatch(editorActions.setShortcutStatus(HEAD_LASER, false));
        dispatch(menuActions.disableMenu());
        canvasRange = { x: coordinateSize.x, y: coordinateSize.y, z: MAX_Z };
        scale = initScale;

        return () => {
            dispatch(editorActions.setShortcutStatus(HEAD_LASER, true));
            dispatch(menuActions.enableMenu());
        };
    }, []);
    useEffect(() => {
        setDisabled(isProcessing);
        setStackedModelModalDsiabled(isProcessing);
    }, [isProcessing]);
    useEffect(() => {
        if (size.x && size.y && size.z && thickness && !cuttingModel) {
            actions.generateModelStack();
        }
    }, [size, thickness]);
    useEffect(() => {
        if (stlInfo && stlInfo.filename && cuttingModel) {
            actions.loadModel();
        }
    }, [stlInfo]);
    return (
        <div className={classNames(styles['model-cut-modal'])}>
            <div className={classNames(styles['model-cut-modal-left'], 'display-inline')}>
                <Spin spinning={disabled} className={classNames(styles.spin)} tip={i18n._('key-StackedModel/Import-Loading')}>
                    <div className={classNames(styles['model-viewer-container'])}>
                        <ModelViewer geometry={modelGeometry} coordinateSize={canvasRange} />
                    </div>
                </Spin>
                <div className={classNames('margin-top-8', 'text-center', styles.description)} style={{ visibility: disabled ? 'hidden' : 'visible' }}>
                    <span>{i18n._('key-StackedModel/Import-Layers')} </span>
                    <span>{stlInfo?.layers}</span>
                    <span className={classNames(styles['desc-split'])}>|</span>
                    <span>{i18n._('key-StackedModel/Import-Sheets')} </span>
                    <span>{svgInfo?.length}</span>
                </div>
            </div>
            <div className={classNames(styles['model-size-container'])}>
                <div>
                    <div className={classNames(styles.title)}>{i18n._('key-StackedModel/Import-Model Size')}</div>
                    <div className="sm-flex height-32 margin-vertical-16">
                        <span className="sm-flex-width sm-flex justify-space-between">
                            <div className="position-re sm-flex align-flex-start">
                                <span className="width-16 height-32 display-inline unit-text align-c margin-left-4 margin-right-4">
                                    X
                                </span>
                                <span>
                                    <Input
                                        suffix="mm"
                                        className="margin-horizontal-2"
                                        disabled={disabled}
                                        value={toFixed(size.x, 1)}
                                        size="large"
                                        min={MIN_SIZE}
                                        max={coordinateSize.x}
                                        onChange={(value) => {
                                            actions.onChangeLogicalX(value);
                                        }}
                                    />
                                </span>
                            </div>
                        </span>
                    </div>
                    <div className="sm-flex height-32 margin-vertical-16">
                        <span className="sm-flex-width sm-flex justify-space-between">
                            <div className="position-re sm-flex align-flex-start">
                                <span className="width-16 height-32 display-inline unit-text align-c margin-left-4 margin-right-4">
                                    Y
                                </span>
                                <span>
                                    <Input
                                        suffix="mm"
                                        disabled={disabled}
                                        className="margin-horizontal-2"
                                        value={toFixed(size.y, 1)}
                                        size="large"
                                        min={MIN_SIZE}
                                        max={coordinateSize.y}
                                        onChange={(value) => {
                                            actions.onChangeLogicalY(value);
                                        }}
                                    />
                                </span>
                            </div>
                        </span>
                    </div>
                    <div className="sm-flex height-32 margin-vertical-16">
                        <span className="sm-flex-width sm-flex justify-space-between">
                            <div className="position-re sm-flex align-flex-start">
                                <span className="width-16 height-32 display-inline unit-text align-c margin-left-4 margin-right-4">
                                    Z
                                </span>
                                <span>
                                    <Input
                                        suffix="mm"
                                        disabled={disabled}
                                        className="margin-horizontal-2"
                                        value={toFixed(size.z, 1)}
                                        size="large"
                                        min={MIN_SIZE}
                                        max={MAX_Z}
                                        onChange={(value) => {
                                            actions.onChangeLogicalZ(value);
                                        }}
                                    />
                                </span>
                            </div>
                        </span>
                    </div>
                </div>
                <div>
                    <div className={classNames(styles.title, styles.thickness)}>{i18n._('key-StackedModel/Import-Material Thickness')}</div>
                    <div className="sm-flex height-32 margin-vertical-16">
                        <span className="sm-flex-width sm-flex justify-space-between">
                            <div className="position-re sm-flex align-flex-start">
                                <span className="width-16 height-32 display-inline unit-text align-c margin-left-4 margin-right-4">
                                    T
                                </span>
                                <span>
                                    <Input
                                        suffix="mm"
                                        disabled={disabled}
                                        className="margin-horizontal-2"
                                        value={toFixed(thickness, 1)}
                                        size="large"
                                        min={MIN_SIZE}
                                        max={MAX_THICKNESS}
                                        onChange={(value) => {
                                            actions.onChangeMaterialThick(value);
                                        }}
                                    />
                                </span>
                            </div>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
StackedModel.propTypes = {
    setStackedModelModalDsiabled: PropTypes.func.isRequired
};

export default StackedModel;
