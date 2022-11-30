import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { PrintMode } from '../../../../constants/print-base';
import { actions as printingActions } from '../../../../flux/printing';
import i18n from '../../../../lib/i18n';
import Anchor from '../../../components/Anchor';
import { Button } from '../../../components/Buttons';
import SvgIcon from '../../../components/SvgIcon';
import styles from './styles.styl';


// TODO: Add supported print mode configuration on machine definition.
function getPrintModeOptions() {
    return [
        {
            label: i18n._('key-PrintMode/Normal'),
            value: PrintMode.Default,
            iconName: 'MainToolbarPrintModeNormal',
        },
        {
            label: i18n._('key-PrintMode/Backup'),
            value: PrintMode.IDEXBackup,
            iconName: 'MainToolbarPrintModeBackup',
        },
        {
            label: i18n._('key-PrintMode/Duplication'),
            value: PrintMode.IDEXDuplication,
            iconName: 'MainToolbarPrintModeDuplication',
        },
        {
            label: i18n._('key-PrintMode/Mirror'),
            value: PrintMode.IDEXMirror,
            iconName: 'MainToolbarPrintModeMirror',
        },
    ];
}


/**
 * Overlay that can be used to change print mode.
 *
 * @return {*}
 * @constructor
 */
const ChangePrintModeOverlay = (props) => {
    const dispatch = useDispatch();

    const printMode = useSelector(state => state.printing.printMode);

    const printModeOptions = getPrintModeOptions();
    const [selectedPrintMode, setSelectedPrintMode] = useState(printModeOptions[0].value);

    // Select initial print mode
    useEffect(() => {
        for (const printModeOption of printModeOptions) {
            if (printModeOption.value === printMode) {
                setSelectedPrintMode(printMode);
                return;
            }
        }

        // select the first mode if not matching any option
        setSelectedPrintMode(printModeOptions[0].value);
    }, [printMode]);

    function apply() {
        dispatch(printingActions.updatePrintMode(selectedPrintMode));
        props.onApply();
    }

    function cancel() {
        props.onCancel();
    }

    function changePrintMode(targetPrintMode) {
        if (targetPrintMode !== selectedPrintMode) {
            setSelectedPrintMode(targetPrintMode);
        }
    }

    // this.props.setPageMode(PageMode.Default);
    return (
        <div className="position-absolute width-438 margin-left-72 border-default-grey-1 border-radius-8 background-color-white">
            <div className={classNames(styles['overlay-title-font'], 'border-bottom-normal padding-vertical-12 padding-horizontal-16')}>
                {i18n._('Print Mode')}
            </div>
            <div className="sm-flex justify-space-between padding-vertical-16 padding-horizontal-16">
                {
                    printModeOptions && printModeOptions.map(printModeOption => {
                        const isSelected = selectedPrintMode === printModeOption.value;

                        return (
                            <Anchor key={printModeOption.value} onClick={() => changePrintMode(printModeOption.value)}>
                                <div
                                    className={classNames('width-88  border-radius-8 border-default-grey-1', {
                                        'border-color-blue-2': isSelected
                                    })}
                                >
                                    <div className={classNames('margin-top-16 margin-bottom-8 align-c width-percent-100')}>
                                        <SvgIcon
                                            name={printModeOption.iconName}
                                            type={['static']}
                                            size={24}
                                            hoversize={24}
                                            color={isSelected ? '#1890FF' : '#85888C'}
                                        />
                                    </div>
                                    <div
                                        className={classNames('margin-vertical-8 align-c', {
                                            'color-blue-2': isSelected,
                                            'color-black-3': !isSelected,
                                        })}
                                    >
                                        {printModeOption.label}
                                    </div>
                                </div>
                            </Anchor>
                        );
                    })
                }
            </div>
            <div className="background-grey-3 padding-vertical-8 sm-flex padding-horizontal-16 justify-flex-end border-radius-bottom-8">
                <Button
                    onClick={cancel}
                    priority="level-two"
                    width="96px"
                    type="default"
                >
                    {i18n._('key-Modal/Common-Cancel')}
                </Button>
                <Button
                    priority="level-two"
                    width="96px"
                    onClick={apply}
                    className="margin-left-8"
                >
                    {i18n._('key-Laser/CameraCapture-Apply')}
                </Button>
            </div>
        </div>
    );
};

ChangePrintModeOverlay.propTypes = {
    onApply: PropTypes.func,
    onCancel: PropTypes.func,
};

export default ChangePrintModeOverlay;
