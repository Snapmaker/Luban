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

const SupportOverlay = ({ editSupport, CancelButton, setTransformMode }) => {
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray, shallowEqual);
    const modelGroup = useSelector(state => state?.printing?.modelGroup, shallowEqual);
    const supportOverhangAngle = useSelector(state => state?.printing.supportOverhangAngle, shallowEqual);
    const [willOverrideSupport, setWillOverrideSupport] = useState(false);
    const dispatch = useDispatch();

    const actions = {
        generateAutoSupport(angle) {
            dispatch(printingActions.computeAutoSupports(angle));
            setWillOverrideSupport(false);
        },
        checkIfOverrideSupport() {
            const res = modelGroup.checkIfOverrideSupport();
            if (res) {
                setWillOverrideSupport(res);
            } else {
                actions.generateAutoSupport(supportOverhangAngle);
            }
        },
        clearAllManualSupport() {
            dispatch(printingActions.clearAllManualSupport());
        },
        editSupport() {
            editSupport();
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
                className={classNames(styles['support-overlay'], 'position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white')}
                style={{
                    marginTop: '268px'
                }}
            >
                <div className="sm-flex justify-space-between border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40 font-size-middle">
                    {i18n._('key-Printing/LeftBar/Support-Support')}
                    <CancelButton
                        onClick={() => setTransformMode('')}
                    />
                </div>
                <div className="padding-bottom-16 padding-top-12 padding-horizontal-16">
                    <div className="sm-flex font-size-middle">{i18n._('key-Printing/LeftBar/Support-Auto Support')}</div>
                    <Button
                        className="margin-top-8"
                        type="primary"
                        priority="level-three"
                        width="100%"
                        onClick={() => actions.checkIfOverrideSupport()}
                    >
                        {
                            selectedModelArray.length > 0 ? <span>{i18n._('key-Printing/LeftBar/Support-Generate Auto Support')}</span> : <span>{i18n._('key-Printing/LeftBar/Support-Generate Auto Support (For All)')}</span>
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
                    <div className="sm-flex font-size-middle">{i18n._('key-Printing/LeftBar/Support-Editing Support')}</div>
                    <div className="sm-flex justify-space-between">
                        <Button
                            className="margin-top-8 display-inline"
                            type="primary"
                            priority="level-three"
                            width="120px"
                            onClick={actions.editSupport}
                        >
                            {
                                selectedModelArray.length > 0 ? <span>{i18n._('key-Printing/LeftBar/Support-Edit')}</span> : <span>{i18n._('key-Printing/LeftBar/Support-Edit All')}</span>
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
                                selectedModelArray.length > 0 ? <span>{i18n._('key-Printing/LeftBar/Support-Clear')}</span> : <span>{i18n._('key-Printing/LeftBar/Support-Clear All')}</span>
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
    CancelButton: PropTypes.func.isRequired
};

export default SupportOverlay;
