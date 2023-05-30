import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styles from './styles.styl';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import { NumberInput as Input } from '../../components/Input';
import SvgIcon from '../../components/SvgIcon';
import Slider from '../../components/Slider';
import { actions as printingActions } from '../../../flux/printing';
import sceneActions from '../../../flux/printing/actions-scene';
import { actions as menuActions } from '../../../flux/appbar-menu';
import { HEAD_PRINTING } from '../../../constants';
import { logTransformOperation } from '../../../lib/gaEvent';

let tmpDiameter;
const EditSupportOverlay = ({ onClose }) => {
    const [diameter, setDiameter] = useState(5);
    const supportBrushStatus = useSelector(state => state.printing.supportBrushStatus);
    const dispatch = useDispatch();

    const actions = {
        finish: (shouldApplyChanges) => {
            logTransformOperation(HEAD_PRINTING, 'support', 'edit_done');
            dispatch(sceneActions.finishEditSupportMode(shouldApplyChanges));
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
            dispatch(sceneActions.setSupportBrushStatus('add'));
        },
        removeSupport: () => {
            dispatch(sceneActions.setSupportBrushStatus('remove'));
        },
        onCancel: () => {
            actions.finish(false);
        },
        onConfirm: () => {
            actions.finish(true);
        }
    };

    useEffect(() => {
        dispatch(sceneActions.startEditSupportMode());

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
        dispatch(sceneActions.setSupportBrushRadius(diameter / 2));
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
                            onAfterChange={() => {
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
EditSupportOverlay.propTypes = {
    onClose: PropTypes.func.isRequired
};

export default EditSupportOverlay;
