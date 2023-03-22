import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { PrintMode } from '@snapmaker/luban-platform';

import { actions as printingActions } from '../../../flux/printing';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import Anchor from '../../components/Anchor';
import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';
import styles from './styles.styl';


/**
 * Get available print mode options of active machine.
 *
 * @param activeMachine
 * @return {Array}
 */
function getPrintModeOptions(activeMachine) {
    const supportedPrintModes = [];
    if (activeMachine && activeMachine.metadata?.printModes) {
        for (const options of activeMachine.metadata.printModes) {
            supportedPrintModes.push(options.mode);
        }
    }

    // Make sure at least default mode is available for all machines
    if (supportedPrintModes.length === 0) {
        supportedPrintModes.push(PrintMode.Default);
    }

    const printModeResourcesMap = {
        [PrintMode.Default]: {
            label: i18n._('key-PrintMode/Normal'),
            value: PrintMode.Default,
            iconName: 'MainToolbarPrintModeNormal',
        },
        [PrintMode.IDEXBackup]: {
            label: i18n._('key-PrintMode/Backup'),
            value: PrintMode.IDEXBackup,
            iconName: 'MainToolbarPrintModeBackup',
        },
        [PrintMode.IDEXDuplication]: {
            label: i18n._('key-PrintMode/Duplication'),
            value: PrintMode.IDEXDuplication,
            iconName: 'MainToolbarPrintModeDuplication',
        },
        [PrintMode.IDEXMirror]: {
            label: i18n._('key-PrintMode/Mirror'),
            value: PrintMode.IDEXMirror,
            iconName: 'MainToolbarPrintModeMirror',
        },
    };

    const options = [];
    for (const printMode of supportedPrintModes) {
        if (printModeResourcesMap[printMode]) {
            options.push(printModeResourcesMap[printMode]);
        } else {
            log.warning(`Unsupported print mode: ${printMode}`);
        }
    }

    return options;
}


/**
 * Overlay that can be used to change print mode.
 */
const ChangePrintModeOverlay = (props) => {
    const dispatch = useDispatch();

    const activeMachine = useSelector(state => state.machine.activeMachine);
    const printMode = useSelector(state => state.printing.printMode);

    const printModeOptions = useMemo(() => {
        return getPrintModeOptions(activeMachine);
    }, [activeMachine]);

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
    }, [printMode, printModeOptions]);

    function changePrintMode(targetPrintMode) {
        if (targetPrintMode !== selectedPrintMode) {
            setSelectedPrintMode(targetPrintMode);
            dispatch(printingActions.updatePrintMode(targetPrintMode));
        }
    }
    function onClose() {
        props.onClose && props.onClose();
    }

    return (
        <div className="position-absolute width-438 margin-left-72 border-default-grey-1 border-radius-8 background-color-white">
            <div className={classNames(styles['overlay-title-font'], 'border-bottom-normal padding-vertical-8 padding-horizontal-16')}>
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
            <div
                className={classNames(
                    'padding-horizontal-16 padding-vertical-8 border-radius-bottom-8',
                    'sm-flex justify-flex-end',
                    'background-grey-3',
                )}
            >
                <Button
                    onClick={onClose}
                    priority="level-two"
                    width="96px"
                    type="default"
                >
                    {i18n._('key-Printing/ProfileManager-Close')}
                </Button>
            </div>
        </div>
    );
};

ChangePrintModeOverlay.propTypes = {
    onClose: PropTypes.func,
};

export default ChangePrintModeOverlay;
