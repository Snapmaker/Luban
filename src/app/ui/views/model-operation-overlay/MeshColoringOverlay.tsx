import { Radio } from 'antd';
import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { actions as menuActions } from '../../../flux/appbar-menu';
import type { RootState } from '../../../flux/index.def';
import { actions as printingActions } from '../../../flux/printing';
import { useMaterialPresetModel } from '../../../flux/printing/actions-preset';
import sceneActions from '../../../flux/printing/actions-scene';
import i18n from '../../../lib/i18n';
import type { ShortcutHandler } from '../../../lib/shortcut';
import { ShortcutHandlerPriority, ShortcutManager } from '../../../lib/shortcut';
import { BrushType } from '../../../models/ModelGroup';
import { Button } from '../../components/Buttons';
import { NumberInput as Input } from '../../components/Input';
import Slider from '../../components/Slider';
import Tooltip from '../../components/Tooltip';
import styles from './styles.styl';

interface MeshColoringOverlayProps {
    onClose: () => void;
}

const DEFAULT_SPHERE_BRUSH_SIZE = 10;
const DEFAULT_SMART_FILL_BRUSH_SIZE = 1;

/**
 * Note that here we re-use Support Brush to add marks to mesh, so
 * function names are inconsistent with their actual purpose.
 */
const MeshColoringOverlay: React.FC<MeshColoringOverlayProps> = ({ onClose }) => {
    const dispatch = useDispatch();

    /**
     * Brush Type
     */
    const { brushType } = useSelector((state: RootState) => state.printing);
    const onChangeBrushType = useCallback((newBrushType: BrushType) => {
        dispatch(sceneActions.setBrushType(newBrushType));
    }, [dispatch]);

    // Brush angle (Smart Fill mode)
    const [angle, setAngle] = useState(15);

    // Brush size
    const [brushSize, setBrushSize] = useState(DEFAULT_SPHERE_BRUSH_SIZE); // unit: mm
    useEffect(() => {
        dispatch(sceneActions.setSupportBrushRadius(brushSize / 2));
    }, [dispatch, brushSize]);

    const { modelGroup } = useSelector((state: RootState) => state.printing);
    useEffect(() => {
        if (brushType === BrushType.SmartFillBrush) {
            const brushOptions = modelGroup.brushOptions;
            setAngle(brushOptions.angle);
            setBrushSize(DEFAULT_SMART_FILL_BRUSH_SIZE);
        } else {
            setBrushSize(DEFAULT_SPHERE_BRUSH_SIZE);
        }
    }, [brushType, modelGroup]);

    const onChangeSmartFillAngle = useCallback((value: number) => {
        // change both local state & redux state
        setAngle(value);
        dispatch(sceneActions.setSmartFillBrushAngle(value));
    }, [dispatch]);

    // brush stackId
    const { brushStackId } = useSelector((state: RootState) => state.printing);
    const selectLeftExtruder = useCallback(() => {
        dispatch(sceneActions.setMeshStackId(LEFT_EXTRUDER));
    }, [dispatch]);
    const selectRightExtruder = useCallback(() => {
        dispatch(sceneActions.setMeshStackId(RIGHT_EXTRUDER));
    }, [dispatch]);

    // Select left by default
    useEffect(() => {
        selectRightExtruder();
    }, [selectRightExtruder]);

    // brush color
    const leftMaterialPresetModel = useMaterialPresetModel(LEFT_EXTRUDER);
    const leftMaterialColor = (leftMaterialPresetModel?.settings.color.default_value || '#fff') as string;

    const rightMaterialPresetModel = useMaterialPresetModel(RIGHT_EXTRUDER);
    const rightMaterialColor = (rightMaterialPresetModel?.settings.color.default_value || '#fff') as string;

    /**
     * Cancel changes.
     */
    const onCancel = useCallback(() => {
        dispatch(sceneActions.endMeshColoringMode(false));
        onClose();
    }, [dispatch, onClose]);

    /**
     * Confirm changes.
     */
    const onConfirm = useCallback(() => {
        dispatch(sceneActions.endMeshColoringMode(true));
        onClose();
    }, [dispatch, onClose]);

    // ESC = Cancel
    const handleKeydown = useCallback((event: KeyboardEvent) => {
        if (event.key === 'Escape') { // ESC
            event.stopPropagation();
            onCancel();
        }
    }, [onCancel]);

    // Wheel to control brush size
    const handleMousewheel = useCallback((event: WheelEvent) => {
        if (event.altKey) {
            event.stopPropagation();
            if (event.deltaY < 0) { // zoom in
                setBrushSize(prevDiameter => Math.min(prevDiameter + 1, 50));
            } else if (event.deltaY > 0) { // zoom out
                setBrushSize(prevDiameter => Math.max(prevDiameter - 1, 1));
            }
        }
    }, []);

    // Enter / leave mode
    useEffect(() => {
        dispatch(sceneActions.startMeshColoringMode());

        dispatch(printingActions.setShortcutStatus(false));
        dispatch(printingActions.setLeftBarOverlayVisible(true));
        dispatch(menuActions.disableMenu());

        const handler: ShortcutHandler = {
            title: 'MeshColoring',
            priority: ShortcutHandlerPriority.View,
            isActive: () => {
                return true;
            },
            shortcuts: {
                'SWITCH_LEFT_EXTRUDER': {
                    keys: ['1'],
                    callback: () => {
                        dispatch(sceneActions.setMeshStackId(LEFT_EXTRUDER));
                    },
                },
                'SWITCH_RIGHT_EXTRUDER': {
                    keys: ['2'],
                    callback: () => {
                        dispatch(sceneActions.setMeshStackId(RIGHT_EXTRUDER));
                    },
                }
            }
        };

        ShortcutManager.register(handler);

        return () => {
            ShortcutManager.unregister(handler);

            dispatch(printingActions.setShortcutStatus(true));
            dispatch(printingActions.setLeftBarOverlayVisible(false));
            dispatch(menuActions.enableMenu());
        };
    }, [dispatch]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeydown, true);
        window.addEventListener('wheel', handleMousewheel, true);

        return () => {
            window.removeEventListener('keydown', handleKeydown, true);
            window.removeEventListener('wheel', handleMousewheel, true);
        };
    }, [handleKeydown, handleMousewheel]);

    return (
        <div className={classNames(styles['mesh-coloring-overlay'])}>
            <header className={classNames(styles['overlay-sub-title-font'])}>
                <span>{i18n._('key-Printing/MeshEdit-Mesh Coloring')}</span>
            </header>
            <section>
                <div className="margin-top-10">
                    <div>{i18n._('key-Printing/MeshEdit-Color Select')}</div>
                    <div className="margin-top-8 sm-flex justify-space-between">
                        <Button
                            type="default"
                            width="180px"
                            className={classNames(
                                'height-32-button-with-border',
                                'border-radius-8',
                                {
                                    'border-blue-2': brushStackId === LEFT_EXTRUDER,
                                }
                            )}
                            onClick={selectLeftExtruder}
                        >
                            <span className="display-inline-block">
                                <span
                                    style={{
                                        backgroundColor: leftMaterialColor,
                                        verticalAlign: 'middle',
                                    }}
                                    className={classNames(
                                        'display-inline-block width-16 height-16',
                                        'border-radius-4 border-default-grey-1',
                                        'margin-right-8',
                                    )}
                                />
                                <span style={{ verticalAlign: 'middle' }}>{i18n._('Left Extruder')}</span>
                                <span style={{ verticalAlign: 'middle', fontSize: '12px', marginLeft: '4px' }}>(<i className="fa fa-keyboard-o" /> 1)</span>
                            </span>
                        </Button>
                        <Button
                            type="default"
                            width="180px"
                            className={classNames(
                                'height-32-button-with-border',
                                'border-radius-8',
                                {
                                    'border-blue-2': brushStackId === RIGHT_EXTRUDER,
                                }
                            )}
                            onClick={selectRightExtruder}
                        >
                            <span className="display-inline-block">
                                <span
                                    style={{
                                        backgroundColor: rightMaterialColor,
                                        verticalAlign: 'middle',
                                    }}
                                    className={classNames(
                                        'display-inline-block width-16 height-16',
                                        'border-radius-4 border-default-grey-1',
                                        'margin-right-8',
                                    )}
                                />
                                <span style={{ verticalAlign: 'middle' }}>{i18n._('Right Extruder')}</span>
                                <span style={{ verticalAlign: 'middle', fontSize: '12px', marginLeft: '4px' }}>(<i className="fa fa-keyboard-o" /> 2)</span>
                            </span>
                        </Button>

                    </div>
                </div>
                <div className="margin-top-10">
                    <Tooltip
                        placement="left"
                        title={(
                            <div className="padding-horizontal-16 padding-vertical-16">
                                <div className="font-weight-bold padding-bottom-16 border-bottom-white">
                                    {i18n._('key-Printing/MeshEdit-Mesh Coloring')}
                                </div>
                                <div className="font-size-small padding-top-16">
                                    <p className="font-weight-bold">{i18n._('key-Printing/MeshEdit-BrushType-SmartFillBrush')}</p>
                                    <p className="margin-left-16">{i18n._('key-Printing/MeshEdit-BrushType-SmartFill-Intro')}</p>
                                    <p className="font-weight-bold">{i18n._('key-Printing/MeshEdit-BrushType-SphereBrush')}</p>
                                    <p className="margin-left-16">{i18n._('key-Printing/MeshEdit-BrushType-SphereBrush-Intro')}</p>
                                </div>
                            </div>
                        )}
                    >
                        <p>{i18n._('key-Printing/MeshEdit-Method')}</p>
                        <Radio.Group
                            value={brushType}
                            onChange={(e) => onChangeBrushType(e.target.value)}
                        >
                            <Radio value={BrushType.SmartFillBrush}>{i18n._('key-Printing/MeshEdit-BrushType-SmartFillBrush')}</Radio>
                            <Radio value={BrushType.SphereBrush}>{i18n._('key-Printing/MeshEdit-BrushType-SphereBrush')}</Radio>
                        </Radio.Group>
                    </Tooltip>
                </div>
                {[BrushType.SmartFillBrush, BrushType.SphereBrush].includes(brushType) && (
                    <div className="margin-top-10">
                        <div>{i18n._('key-Printing/MeshEdit-Tolerance')}</div>
                        <div className="margin-top-8 sm-flex justify-space-between">
                            <Slider
                                className="border-radius-2"
                                value={angle}
                                min={0}
                                max={90}
                                step={1}
                                onChange={(value: number) => {
                                    onChangeSmartFillAngle(value);
                                }}
                            />
                            <Input
                                suffix="°"
                                size="small"
                                min={0}
                                max={90}
                                value={angle}
                                onChange={(value: number) => {
                                    onChangeSmartFillAngle(value);
                                }}
                            />
                        </div>
                    </div>
                )}
                {/* Sphere Brush */}
                {brushType === BrushType.SphereBrush && (
                    <div className="margin-top-10">
                        <div>{i18n._('key-Printing/LeftBar/EditSupport-Brush Size')}</div>
                        <div className={classNames(styles['overflow-visible'], 'margin-top-8 sm-flex justify-space-between')}>
                            <Slider
                                className="border-radius-2"
                                value={brushSize}
                                min={1}
                                max={50}
                                step={1}
                                onChange={(value) => {
                                    setBrushSize(value);
                                }}
                            />
                            <Input
                                suffix="mm"
                                size="small"
                                min={1}
                                max={50}
                                value={brushSize}
                                onChange={(value) => {
                                    setBrushSize(value);
                                }}
                            />
                        </div>
                    </div>
                )}
            </section>
            <footer className="sm-flex justify-flex-end">
                <Button
                    type="default"
                    priority="level-two"
                    width="96px"
                    onClick={onCancel}
                >
                    {i18n._('key-Common/Clear')}
                </Button>
                <Button
                    type="primary"
                    priority="level-two"
                    width="96px"
                    onClick={onConfirm}
                    className="margin-left-8"
                >
                    {i18n._('key-Modal/Common-Done')}
                </Button>
            </footer>
        </div>
    );
};

export default MeshColoringOverlay;
