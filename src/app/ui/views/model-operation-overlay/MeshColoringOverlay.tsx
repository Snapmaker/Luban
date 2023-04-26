import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { actions as menuActions } from '../../../flux/appbar-menu';
import type { RootState } from '../../../flux/index.def';
import { actions as printingActions } from '../../../flux/printing';
import sceneActions from '../../../flux/printing/actions-scene';
import i18n from '../../../lib/i18n';
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
     * Brush size changed.
     */
    const [brushSize, setBrushSize] = useState(5); // unit: mm
    useEffect(() => {
        dispatch(printingActions.setSupportBrushRadius(brushSize / 2));
    }, [dispatch, brushSize]);

    // brush status
    const supportBrushStatus = useSelector((state: RootState) => state.printing.supportBrushStatus);
    const addSupport = useCallback(() => {
        dispatch(printingActions.setSupportBrushStatus('add'));
    }, [dispatch]);

    const removeSupport = useCallback(() => {
        dispatch(printingActions.setSupportBrushStatus('remove'));
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
        dispatch(printingActions.startEditSupportArea());

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
                                [styles.active]: supportBrushStatus === 'add'
                            }
                        )}
                        onClick={() => addSupport()}
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
                                [styles.active]: supportBrushStatus === 'remove'
                            }
                        )}
                        onClick={() => removeSupport()}
                        spanText={i18n._('Right Extruder')}
                        spanClassName={classNames(styles['action-title'])}
                    />
                </div>
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
