import { Radio } from 'antd';
import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { actions as menuActions } from '../../../flux/appbar-menu';
import type { RootState } from '../../../flux/index.def';
import { actions as printingActions } from '../../../flux/printing';
import sceneActions from '../../../flux/printing/actions-scene';
import i18n from '../../../lib/i18n';
import { BrushType } from '../../../models/ModelGroup';
import { Button } from '../../components/Buttons';
import { NumberInput as Input } from '../../components/Input';
import Slider from '../../components/Slider';
import SvgIcon from '../../components/SvgIcon';
import styles from './styles.styl';

interface MeshColoringOverlayProps {
    onClose: () => void;
}

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
    const [angle, setAngle] = useState(5);

    // Brush size changed
    const [brushSize, setBrushSize] = useState(3); // unit: mm
    useEffect(() => {
        dispatch(printingActions.setSupportBrushRadius(brushSize / 2));
    }, [dispatch, brushSize]);

    const { modelGroup } = useSelector((state: RootState) => state.printing);
    useEffect(() => {
        if (brushType === BrushType.SmartFillBrush) {
            const brushOptions = modelGroup.brushOptions;
            setAngle(brushOptions.angle);
            setBrushSize(1);
        } else {
            setBrushSize(3);
        }
    }, [brushType, modelGroup]);

    const onChangeSmartFillAngle = useCallback((value: number) => {
        setAngle(value);
        dispatch(sceneActions.setSmartFillBrushAngle(value));
    }, [dispatch]);

    // brush status
    const { meshColoringBrushMark } = useSelector((state: RootState) => state.printing);
    const selectLeftExtruder = useCallback(() => {
        dispatch(sceneActions.updateMeshColoringBrushMark(LEFT_EXTRUDER));
    }, [dispatch]);

    const selectRightExtruder = useCallback(() => {
        dispatch(sceneActions.updateMeshColoringBrushMark(RIGHT_EXTRUDER));
    }, [dispatch]);

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

    // Enter
    useEffect(() => {
        dispatch(sceneActions.startMeshColoringMode());

        dispatch(printingActions.setShortcutStatus(false));
        dispatch(printingActions.setLeftBarOverlayVisible(true));
        dispatch(menuActions.disableMenu());

        window.addEventListener('keydown', handleKeydown, true);
        window.addEventListener('wheel', handleMousewheel, true);

        return () => {
            window.removeEventListener('keydown', handleKeydown, true);
            window.removeEventListener('wheel', handleMousewheel, true);

            dispatch(printingActions.setShortcutStatus(true));
            dispatch(printingActions.setLeftBarOverlayVisible(false));
            dispatch(menuActions.enableMenu());
        };
    }, [dispatch, handleKeydown, handleMousewheel]);

    return (
        <div className={classNames(styles['edit-support'])}>
            <header className={classNames(styles['overlay-sub-title-font'])}>
                <span>{i18n._('key-Printing/MeshColoring-Mesh Coloring')}</span>
            </header>
            <section>
                <div className={classNames(styles['support-btn-switchs'])}>
                    <SvgIcon
                        name="SupportAdd"
                        size={24}
                        type={['static']}
                        className={classNames(
                            styles['support-btn-switch'], 'sm-tab', 'align-c',
                            {
                                [styles.active]: meshColoringBrushMark === LEFT_EXTRUDER
                            }
                        )}
                        onClick={() => selectLeftExtruder()}
                        spanText={i18n._('Left Extruder')}
                        spanClassName={classNames(styles['action-title'])}
                    />
                    <SvgIcon
                        name="SupportDelete"
                        size={24}
                        type={['static']}
                        className={classNames(
                            styles['support-btn-switch'], 'sm-tab', 'align-c',
                            {
                                [styles.active]: meshColoringBrushMark === RIGHT_EXTRUDER
                            }
                        )}
                        onClick={() => selectRightExtruder()}
                        spanText={i18n._('Right Extruder')}
                        spanClassName={classNames(styles['action-title'])}
                    />
                </div>
                <div className="margin-top-10">
                    <p>Method</p>
                    <Radio.Group
                        value={brushType}
                        onChange={(e) => onChangeBrushType(e.target.value)}
                    >
                        <Radio value={BrushType.SmartFillBrush}>Smart Fill</Radio>
                        <Radio value={BrushType.SphereBrush}>Brush</Radio>
                    </Radio.Group>
                </div>
                {brushType === BrushType.SmartFillBrush && (
                    <div className="margin-top-10">
                        <div>{i18n._('key-Printing/MeshEdit-Tolerance')}</div>
                        <div className="margin-top-8 sm-flex justify-space-between">
                            <Slider
                                className="border-radius-2"
                                value={angle}
                                min={0}
                                max={20}
                                step={1}
                                onChange={(value: number) => {
                                    onChangeSmartFillAngle(value);
                                }}
                            />
                            <Input
                                suffix="°"
                                size="small"
                                min={0}
                                max={20}
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
            <footer className="sm-flex justify-space-between">
                <Button
                    type="default"
                    priority="level-two"
                    width="96px"
                    onClick={onCancel}
                >
                    {i18n._('key-Modal/Common-Cancel')}
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
