import React, { useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../../../lib/i18n';
import { Button } from '../../../components/Buttons';
import { NumberInput as Input } from '../../../components/Input';
import { actions as printingActions } from '../../../../flux/printing';
import styles from './styles.styl';
import { renderModal } from '../../../utils';
/* eslint-disable-next-line import/no-cycle */
import { CancelButton } from '../VisualizerLeftBar';
import { HEAD_PRINTING } from '../../../../constants';
import { logTransformOperation } from '../../../../lib/gaEvent';

const SupportOverlay = ({ editSupport, setTransformMode }) => {
    const modelGroup = useSelector(state => state?.printing?.modelGroup, shallowEqual);
    const supportOverhangAngle = useSelector(state => state?.printing.supportOverhangAngle, shallowEqual);
    const [willOverrideSupport, setWillOverrideSupport] = useState(false);
    const dispatch = useDispatch();

    const generateAutoSupportEnableForSelected = modelGroup.getModelsAttachedSupport(false).length > 0;

    const actions = {
        generateAutoSupport(angle) {
            dispatch(printingActions.computeAutoSupports(angle));
            setWillOverrideSupport(false);
            logTransformOperation(HEAD_PRINTING, 'support', 'auto');
        },
        checkIfOverrideSupport() {
            if (generateAutoSupportEnableForSelected || modelGroup.getModelsAttachedSupport().length > 0) {
                const res = modelGroup.checkIfOverrideSupport();
                if (res) {
                    setWillOverrideSupport(res);
                } else {
                    actions.generateAutoSupport(supportOverhangAngle);
                }
            }
        },
        clearAllManualSupport() {
            dispatch(printingActions.clearAllManualSupport());
            logTransformOperation(HEAD_PRINTING, 'support', 'clear');
        },
        editSupport() {
            dispatch(printingActions.exitPreview());
            // In preview mode, wait for modelGroup.object.parent recovery
            setTimeout(() => {
                editSupport();
                logTransformOperation(HEAD_PRINTING, 'support', 'edit_in');
            });
        }
    };
    const renderGenerateSupportConfirm = () => {
        return willOverrideSupport && renderModal({
            title: i18n._('key-Printing/LeftBar/Support-Confirm'),
            renderBody() {
                return (<div>{i18n._('key-Printing/LeftBar/Support-Confirm Message')}</div>);
            },
            actions: [
                {
                    name: i18n._('key-Printing/LeftBar/Support-No'),
                    onClick: () => {
                        setWillOverrideSupport(false);
                    }
                },
                {
                    name: i18n._('key-Printing/LeftBar/Support-Yes'),
                    isPrimary: true,
                    onClick: () => {
                        actions.generateAutoSupport(supportOverhangAngle);
                    }
                }
            ],
            onClose: () => {
                setWillOverrideSupport(false);
            }
        });
    };

    return (
        <>
            <div
                className={classNames(styles['support-overlay'], 'position-absolute width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white')}
                style={{
                    marginTop: '268px'
                }}
            >
                <div className={classNames(styles['overlay-title-font'], 'sm-flex justify-space-between border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40')}>
                    {i18n._('key-Printing/LeftBar/Support-Support')}
                    <CancelButton
                        onClick={() => setTransformMode('')}
                    />
                </div>
                <div className="padding-bottom-16 padding-top-12 padding-horizontal-16">
                    <div className={classNames(styles['overlay-sub-title-font'], 'sm-flex')}>{i18n._('key-Printing/LeftBar/Support-Auto Support')}</div>
                    <Button
                        className="margin-top-8"
                        type="primary"
                        priority="level-three"
                        width="100%"
                        onClick={() => actions.checkIfOverrideSupport()}
                    >
                        {
                            generateAutoSupportEnableForSelected ? <span>{i18n._('key-Printing/LeftBar/Support-Generate Auto Support')}</span> : <span>{i18n._('key-Printing/LeftBar/Support-Generate Auto Support (For All)')}</span>
                        }
                    </Button>
                    <div className="sm-flex justify-space-between height-32 margin-top-8">
                        <span className="sm-flex-auto">{i18n._('key-Printing/LeftBar/Support-Overhang Angle')}</span>
                        <div className="sm-flex-auto display-inline">
                            <Input
                                suffix="°"
                                size="small"
                                min={0}
                                max={90}
                                value={supportOverhangAngle}
                                onChange={(value) => {
                                    dispatch(printingActions.updateSupportOverhangAngle(value));
                                }}
                            />
                        </div>
                    </div>
                    <div className={classNames(styles['dashed-line'])} />
                    <div className={classNames(styles['overlay-sub-title-font'], 'sm-flex padding-top-8')}>{i18n._('key-Printing/LeftBar/Support-Editing Support')}</div>
                    <div className="sm-flex justify-space-between">
                        <Button
                            className="margin-top-8 display-inline"
                            type="primary"
                            priority="level-three"
                            width="120px"
                            onClick={actions.editSupport}
                        >
                            {
                                generateAutoSupportEnableForSelected ? <span>{i18n._('key-Printing/LeftBar/Support-Edit')}</span> : <span>{i18n._('key-Printing/LeftBar/Support-Edit All')}</span>
                            }
                        </Button>
                        <Button
                            className="margin-top-8 display-inline"
                            type="primary"
                            priority="level-three"
                            width="120px"
                            onClick={actions.clearAllManualSupport}
                        >
                            {
                                generateAutoSupportEnableForSelected ? <span>{i18n._('key-Printing/LeftBar/Support-Clear')}</span> : <span>{i18n._('key-Printing/LeftBar/Support-Clear All')}</span>
                            }
                        </Button>
                    </div>
                </div>
            </div>
            {renderGenerateSupportConfirm()}
        </>
    );
};
SupportOverlay.propTypes = {
    editSupport: PropTypes.func.isRequired,
    setTransformMode: PropTypes.func.isRequired,
};

export default SupportOverlay;
