import _ from 'lodash';
import classNames from 'classnames';
import React, { useEffect, useRef, useState } from 'react';
import includes from 'lodash/includes';
import { useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { Button } from '../components/Buttons';
import Modal from '../components/Modal';
import Dropzone from '../components/Dropzone';

import { controller } from '../../lib/controller';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import {
    WORKFLOW_STATE_IDLE,
    LASER_GCODE_SUFFIX,
    CNC_GCODE_SUFFIX,
    PRINTING_GCODE_SUFFIX
} from '../../constants';
import { actions as workspaceActions } from '../../flux/workspace';
import { actions as widgetActions } from '../../flux/widget';

import { renderWidgetList, logPageView } from '../utils';

import styles from '../layouts/styles/workspace.styl';
import WorkspaceLayout from '../layouts/WorkspaceLayout';
import MainToolBar from '../layouts/MainToolBar';

import ControlWidget from '../widgets/Control';
import ConnectionWidget from '../widgets/Connection';
import ConsoleWidget from '../widgets/Console';
import GCodeWidget from '../widgets/GCode';
import MacroWidget from '../widgets/Macro';
import PurifierWidget from '../widgets/Purifier';
import MarlinWidget from '../widgets/Marlin';
import VisualizerWidget from '../widgets/WorkspaceVisualizer';
import WebcamWidget from '../widgets/Webcam';
import LaserParamsWidget from '../widgets/LaserParams';
import LaserSetBackground from '../widgets/LaserSetBackground';
import LaserTestFocusWidget from '../widgets/LaserTestFocus';
import CNCPathWidget from '../widgets/CNCPath';
import WifiTransport from '../widgets/WifiTransport';
import EnclosureWidget from '../widgets/Enclosure';

import JobType from '../widgets/JobType';
import PrintingVisualizer from '../widgets/PrintingVisualizer';
import MachineSettingWidget from '../widgets/MachineSetting';

const allWidgets = {
    'control': ControlWidget,
    'connection': ConnectionWidget,
    'console': ConsoleWidget,
    'gcode': GCodeWidget,
    'macro': MacroWidget,
    'macroPanel': MacroWidget,
    'purifier': PurifierWidget,
    'marlin': MarlinWidget,
    'visualizer': VisualizerWidget,
    'webcam': WebcamWidget,
    'printing-visualizer': PrintingVisualizer,
    'wifi-transport': WifiTransport,
    'enclosure': EnclosureWidget,
    'laser-params': LaserParamsWidget,
    'laser-set-background': LaserSetBackground,
    'laser-test-focus': LaserTestFocusWidget,
    'cnc-path': CNCPathWidget,
    'job-type': JobType,
    'machine-setting': MachineSettingWidget
};


const ACCEPT = `${LASER_GCODE_SUFFIX}, ${CNC_GCODE_SUFFIX}, ${PRINTING_GCODE_SUFFIX}`;

const reloadPage = (forcedReload = true) => {
    // Reload the current page, without using the cache
    window.location.reload(forcedReload);
};

function Workspace({ isPopup, onClose, style, className }) {
    const history = useHistory();
    const dispatch = useDispatch();
    const primaryWidgets = useSelector(state => state.widget.workspace.left.widgets);
    const secondaryWidgets = useSelector(state => state.widget.workspace.right.widgets);
    const defaultWidgets = useSelector(state => state.widget.workspace.default.widgets);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [connected, setConnected] = useState(controller.connected);
    const [leftItems, setLeftItems] = useState([
        {
            title: i18n._('key_ui/pages/Workspace_Back'),
            type: 'button',
            name: 'MainToolbarBack',
            action: () => {
                history.push('/');
            }
        }
    ]);

    const defaultContainer = useRef();

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
                title: 'Back',
                name: 'MainToolbarBack',
                action: onClose
            };
            setLeftItems([returnButton]);
        },
        onDropAccepted: (file) => {
            dispatch(workspaceActions.uploadGcodeFile(file));
        },
        onDropRejected: () => {
            const title = i18n._('key_ui/pages/Workspace_Warning');
            const body = i18n._('key_ui/pages/Workspace_Only G-code files are supported.');
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
                                <h5>{i18n._('key_ui/pages/Workspace_Server has stopped working.')}</h5>
                                <p>{i18n._('key_ui/pages/Workspace_A problem caused the server to stop working correctly. Check the server status and try again.')}</p>
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            btnStyle="primary"
                            onClick={reloadPage}
                        >
                            {i18n._('key_ui/pages/Workspace_Reload')}
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
            />
        );
    };

    const widgetProps = { };
    return (
        <div style={style} className={classNames(className)}>
            <WorkspaceLayout
                renderMainToolBar={renderMainToolBar}
                renderLeftView={() => renderWidgetList('workspace', 'left', primaryWidgets, allWidgets, listActions, widgetProps)}
                renderRightView={() => renderWidgetList('workspace', 'right', secondaryWidgets, allWidgets, listActions, widgetProps)}
                updateTabContainer={actions.updateTabContainer}
            >
                <Dropzone
                    disabled={isDraggingWidget || controller.workflowState !== WORKFLOW_STATE_IDLE}
                    accept={ACCEPT}
                    dragEnterMsg={i18n._('key_ui/pages/Workspace_Drop a G-code file here.')}
                    onDropAccepted={actions.onDropAccepted}
                    onDropRejected={actions.onDropRejected}
                >
                    <div
                        ref={defaultContainer}
                        className={classNames(
                            styles.defaultContainer,
                        )}
                    >
                        <VisualizerWidget />

                    </div>
                </Dropzone>
                {renderModalView(connected)}
            </WorkspaceLayout>
        </div>
    );
}

Workspace.propTypes = {
    onClose: PropTypes.func,
    isPopup: PropTypes.bool,
    style: PropTypes.object,
    className: PropTypes.string
};

export default Workspace;
