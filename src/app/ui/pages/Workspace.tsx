import { WorkflowStatus } from '@snapmaker/luban-platform';
import classNames from 'classnames';
import i18next from 'i18next';
import _ from 'lodash';
import includes from 'lodash/includes';
import PropTypes from 'prop-types';
import React, { useEffect, useRef, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { CNC_GCODE_SUFFIX, LASER_GCODE_SUFFIX, PRINTING_GCODE_SUFFIX } from '../../constants';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, MACHINE_SERIES } from '../../constants/machines';
import { RootState } from '../../flux/index.def';
import { actions as widgetActions } from '../../flux/widget';
import { actions as workspaceActions } from '../../flux/workspace';
import { controller } from '../../communication/socket-communication';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import { Button } from '../components/Buttons';
import Dropzone from '../components/Dropzone';
import Modal from '../components/Modal';
import MainToolBar from '../layouts/MainToolBar';
import WorkspaceLayout from '../layouts/WorkspaceLayout';
import styles from '../layouts/styles/workspace.styl';
import { logPageView, renderWidgetList } from '../utils';
import AirPurifierWidget from '../widgets/AirPurifierWidget';
import CNCPathWidget from '../widgets/CNCPath';
import ConnectionWidget from '../widgets/Connection';
import ConnectionControlWidget from '../widgets/ConnectionControl';
import ConnectionFileTransferWidget from '../widgets/ConnectionFileTransfer';
import ConnectionToolControlWidget from '../widgets/ConnectionToolControl';
import ConsoleWidget from '../widgets/Console';
import EnclosureWidget from '../widgets/Enclosure';
import JobStatusWidget from '../widgets/JobStatusWidget';
import LaserParamsWidget from '../widgets/LaserParams';
import LaserSetBackground from '../widgets/LaserSetBackground';
import LaserTestFocusWidget from '../widgets/LaserTestFocus';
import MachineSettingWidget from '../widgets/MachineSetting';
import MacroWidget from '../widgets/Macro';
import PrintingVisualizer from '../widgets/PrintingVisualizer';
import WebcamWidget from '../widgets/Webcam';
import VisualizerWidget from '../widgets/WorkspaceVisualizer';
import {
    SnapmakerA150Machine,
    SnapmakerA250Machine,
    SnapmakerA350Machine,
    SnapmakerArtisanMachine,
} from '../../machines';


const allWidgets = {
    'connection': ConnectionWidget,
    'control': ConnectionControlWidget,
    'wifi-transport': ConnectionFileTransferWidget,
    'console': ConsoleWidget,
    'macro': MacroWidget,
    'purifier': AirPurifierWidget,
    'marlin': ConnectionToolControlWidget,
    'visualizer': VisualizerWidget,
    'webcam': WebcamWidget,
    'printing-visualizer': PrintingVisualizer,
    'enclosure': EnclosureWidget,
    'laser-params': LaserParamsWidget,
    'laser-set-background': LaserSetBackground,
    'laser-test-focus': LaserTestFocusWidget,
    'cnc-path': CNCPathWidget,
    'machine-setting': MachineSettingWidget,
    'job-status': JobStatusWidget,
};


const ACCEPT = `${LASER_GCODE_SUFFIX}, ${CNC_GCODE_SUFFIX}, ${PRINTING_GCODE_SUFFIX}`;

const reloadPage = (forcedReload = true) => {
    // Reload the current page, without using the cache
    window.location.reload(forcedReload);
};

let workspaceVisualizerRef = null;

// TODO: Workspace widgets can only support G-code based machine, add configuration
//  to machine indicating if it supports plain G-code.
function getUnsupportedWidgets(machineIdentifier, toolHead) {
    if (!machineIdentifier) return [];

    if ([SnapmakerA150Machine.identifier, SnapmakerA250Machine.identifier, SnapmakerA350Machine.identifier].includes(machineIdentifier)) {
        if (toolHead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2) {
            return [];
        }
    }

    if (machineIdentifier === MACHINE_SERIES.J1.identifier) {
        // G-code execution need firmware upgrades
        // Unsupported widgets: console, control, macro (v4.8)
        return ['control', 'macro'];
    }

    if (machineIdentifier === SnapmakerArtisanMachine.identifier) {
        return [];
    }

    return [];
}

interface WorkspaceProps {
    isPopup?: boolean;
    onClose?: () => void;
    style?: object;
    className?: string;
}

const Workspace: React.FC<WorkspaceProps> = ({ isPopup, onClose, style, className }) => {
    const history = useHistory();
    const dispatch = useDispatch();

    const primaryWidgets = useSelector((state: RootState) => state.widget.workspace.left.widgets);
    const secondaryWidgets = useSelector((state: RootState) => state.widget.workspace.right.widgets);
    const defaultWidgets = useSelector((state: RootState) => state.widget.workspace.default.widgets);

    const {
        machineIdentifier: connectedMachineIdentifier,
        toolHead,
    } = useSelector(state => state.workspace, shallowEqual);

    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [connected, setConnected] = useState(controller.connected);
    const [leftItems, setLeftItems] = useState([
        {
            title: i18n._('key-Workspace/Page-Back'),
            type: 'button',
            name: 'MainToolbarBack',
            action: () => {
                history.push('/');
            }
        }
    ]);

    const defaultContainer = useRef();
    const childRef = (ref) => {
        workspaceVisualizerRef = ref;
    };

    const controllerEvents = {
        'connect': () => {
            setConnected(controller.connected);
        },
        'disconnect': () => {
            setConnected(controller.connected);
        }
    };

    const listActions = {
        // toggleToDefault: actions.toggleToDefault,
        onDragStart: () => {
            setIsDraggingWidget(true);
        },
        onDragEnd: () => {
            setIsDraggingWidget(false);
        }
    };

    const actions = {
        updateTabContainer: (container, value) => {
            dispatch(widgetActions.updateTabContainer('workspace', container, value));
        },
        addReturnButton: () => {
            if (!onClose) {
                return;
            }
            const returnButton = {
                title: 'key-Workspace/Page-Back',
                name: 'MainToolbarBack',
                action: onClose
            };
            setLeftItems([returnButton]);
        },
        onDropAccepted: (file) => {
            dispatch(workspaceActions.uploadGcodeFile(file));
        },
        onDropRejected: () => {
            const title = i18n._('key-Workspace/Page-Warning');
            const body = i18n._('key-Workspace/Page-Only G-code files are supported.');
            modal({
                title: title,
                body: body
            });
        },
        toggleFromDefault: (widgetId) => () => {
            // clone
            const widgets = _.slice(defaultWidgets);
            if (includes(widgets, widgetId)) {
                widgets.splice(widgets.indexOf(widgetId), 1);
                actions.updateTabContainer('default', { widgets: widgets });
            }
        },
        toggleToDefault: (widgetId) => () => {
            // clone
            const widgets = _.slice(defaultWidgets);
            if (!includes(widgets, widgetId)) {
                widgets.push(widgetId);
                actions.updateTabContainer('default', { widgets: widgets });
            }
        }
    };

    // control machine work/stop and preview modal show, for wifiTransport widget
    const controlActions = {
        onCallBackRun: () => {
            workspaceVisualizerRef.actions.handleRun();
        },
        onCallBackPause: () => {
            workspaceVisualizerRef.actions.handlePause();
        },
        onCallBackStop: () => {
            workspaceVisualizerRef.actions.handleStop();
        },
    };

    function addControllerEvents() {
        Object.keys(controllerEvents).forEach(eventName => {
            const callback = controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    function removeControllerEvents() {
        Object.keys(controllerEvents).forEach(eventName => {
            const callback = controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    useEffect(() => {
        addControllerEvents();

        if (isPopup && onClose) {
            actions.addReturnButton();
        }
        logPageView({
            pathname: '/workspace'
        });

        return () => {
            removeControllerEvents();
        };
    }, []);

    function renderModalView(_connected) {
        if (_connected) {
            return null;
        } else {
            return (
                <Modal
                    disableOverlay
                    showCloseButton={false}
                >
                    <Modal.Body>
                        <div className="sm-flex">
                            <i className="fa fa-exclamation-circle fa-4x text-danger" />
                            <div className="margin-left-24">
                                <h5>{i18n._('key-Workspace/Page-Server has stopped working.')}</h5>
                                <p>{i18n._('key-Workspace/Page-A problem caused the server to stop working correctly. Check the server status and try again.')}</p>
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            type="primary"
                            onClick={reloadPage}
                        >
                            {i18n._('key-Workspace/Page-Reload')}
                        </Button>
                    </Modal.Footer>
                </Modal>
            );
        }
    }


    const renderMainToolBar = () => {
        return (
            <MainToolBar
                leftItems={leftItems}
                lang={i18next.language}
            />
        );
    };

    const unsupported = getUnsupportedWidgets(connectedMachineIdentifier, toolHead);

    const leftWidgetNames = primaryWidgets.filter((widgetName) => {
        return !includes(unsupported, widgetName);
    });
    const rightWidgetNames = secondaryWidgets.filter((widgetName) => {
        return !includes(unsupported, widgetName);
    });

    return (
        <div style={style} className={classNames(className)}>
            <WorkspaceLayout
                renderMainToolBar={renderMainToolBar}
                renderLeftView={() => renderWidgetList('workspace', 'left', leftWidgetNames, allWidgets, listActions, {})}
                renderRightView={() => renderWidgetList('workspace', 'right', rightWidgetNames, allWidgets, listActions, {}, controlActions)}
                updateTabContainer={actions.updateTabContainer}
            >
                <Dropzone
                    disabled={isDraggingWidget || controller.workflowState !== WorkflowStatus.Idle}
                    accept={ACCEPT}
                    dragEnterMsg={i18n._('key-Workspace/Page-Drop a G-code file here.')}
                    onDropAccepted={actions.onDropAccepted}
                    onDropRejected={actions.onDropRejected}
                >
                    <div
                        ref={defaultContainer}
                        className={classNames(
                            styles.defaultContainer,
                        )}
                    >
                        <VisualizerWidget onRef={ref => childRef(ref)} />
                    </div>
                </Dropzone>
                {renderModalView(connected)}
            </WorkspaceLayout>
        </div>
    );
};

Workspace.propTypes = {
    onClose: PropTypes.func,
    isPopup: PropTypes.bool,
    style: PropTypes.object,
    className: PropTypes.string
};

export default Workspace;
