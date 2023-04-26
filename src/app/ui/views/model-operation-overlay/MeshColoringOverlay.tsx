import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { actions as menuActions } from '../../../flux/appbar-menu';
import type { RootState } from '../../../flux/index.def';
import { actions as printingActions } from '../../../flux/printing';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import { NumberInput as Input } from '../../components/Input';
import Slider from '../../components/Slider';
import SvgIcon from '../../components/SvgIcon';
import styles from './styles.styl';

interface MeshColoringOverlayProps {
    onClose: () => void;
}

let tmpDiameter;
const MeshColoringOverlay: React.FC<MeshColoringOverlayProps> = ({ onClose }) => {
    const [diameter, setDiameter] = useState(5);
    const supportBrushStatus = useSelector((state: RootState) => state.printing.supportBrushStatus);
    const dispatch = useDispatch();

    const actions = {
        finish: (shouldApplyChanges) => {
            dispatch(printingActions.finishEditSupportArea(shouldApplyChanges));
            onClose();
        },
        handleMousewheel: (e) => {
            if (e.altKey) {
                e.stopPropagation();
                if (e.deltaY < 0) { // zoom in
                    tmpDiameter++;
                    if (tmpDiameter > 50) {
                        tmpDiameter = 50;
                    }
                    setDiameter(tmpDiameter);
                } else if (e.deltaY > 0) { // zoom out
                    tmpDiameter--;
                    if (tmpDiameter < 1) {
                        tmpDiameter = 1;
                    }
                    setDiameter(tmpDiameter);
                }
            }
        },
        handleKeydown: (e) => {
            if (e.keyCode === 27) { // ESC
                e.stopPropagation();
                actions.finish(false);
            }
        },
        addSupport: () => {
            dispatch(printingActions.setSupportBrushStatus('add'));
        },
        removeSupport: () => {
            dispatch(printingActions.setSupportBrushStatus('remove'));
        },
        onCancel: () => {
            actions.finish(false);
        },
        onConfirm: () => {
            actions.finish(true);
        }
    };

    useEffect(() => {
        dispatch(printingActions.startEditSupportArea());
        // Mousetrap doesn't support unbind specific shortcut callback, use native instead
        window.addEventListener('keydown', actions.handleKeydown, true);
        window.addEventListener('wheel', actions.handleMousewheel, true);
        dispatch(printingActions.setShortcutStatus(false));
        dispatch(printingActions.setLeftBarOverlayVisible(true));
        dispatch(menuActions.disableMenu());
        return () => {
            dispatch(printingActions.setShortcutStatus(true));
            dispatch(printingActions.setLeftBarOverlayVisible(false));
            dispatch(menuActions.enableMenu());
            window.removeEventListener('keydown', actions.handleKeydown, true);
            window.removeEventListener('wheel', actions.handleMousewheel, true);
        };
    }, []);

    useEffect(() => {
        tmpDiameter = diameter;
        dispatch(printingActions.setSupportBrushRadius(diameter / 2));
    }, [diameter]);

    return (
        <div className={classNames(styles['edit-support'])}>
            <header className={classNames(styles['overlay-sub-title-font'])}>
                <span>{i18n._('key-Printing/LeftBar/EditSupport-Edit Support')}</span>
            </header>
            <section>
                <div className={classNames(styles['support-btn-switchs'])}>
                    <SvgIcon
                        name="SupportAdd"
                        size={24}
                        type={['static']}
                        className={classNames(styles['support-btn-switch'], 'sm-tab', 'align-c', supportBrushStatus === 'add' ? styles.active : '')}
                        onClick={() => { actions.addSupport(); }}
                        spanText={i18n._('key-Printing/LeftBar/EditSupport-Add')}
                        spanClassName={classNames(styles['action-title'])}
                    />
                    <SvgIcon
                        name="SupportDelete"
                        size={24}
                        type={['static']}
                        className={classNames(styles['support-btn-switch'], 'sm-tab', 'align-c', supportBrushStatus === 'remove' ? styles.active : '')}
                        onClick={() => { actions.removeSupport(); }}
                        spanText={i18n._('key-Printing/LeftBar/EditSupport-Delete')}
                        spanClassName={classNames(styles['action-title'])}
                    />
                </div>
                <div className="margin-top-10">
                    <div>{i18n._('key-Printing/LeftBar/EditSupport-Brush Size')}</div>
                    <div className={classNames(styles['overflow-visible'], 'margin-top-8 sm-flex justify-space-between')}>
                        <Slider
                            className="border-radius-2"
                            value={diameter}
                            min={1}
                            max={50}
                            step={1}
                            onChange={(value) => {
                                setDiameter(value);
                            }}
                        />
                        <Input
                            suffix="mm"
                            size="small"
                            min={1}
                            max={50}
                            value={diameter}
                            onChange={(value) => {
                                setDiameter(value);
                            }}
                        />
                    </div>
                </div>
            </section>
            <footer className="sm-flex justify-space-between">
                <Button
                    onClick={actions.onCancel}
                    priority="level-two"
                    type="default"
                    width="96px"
                >
                    {i18n._('key-Printing/LeftBar/EditSupport-Cancel')}
                </Button>
                <Button
                    type="primary"
                    onClick={actions.onConfirm}
                    priority="level-two"
                    width="96px"
                    className="margin-left-8"
                >
                    {i18n._('key-Printing/LeftBar/EditSupport-Done')}
                </Button>
            </footer>
        </div>
    );
};

export default MeshColoringOverlay;
