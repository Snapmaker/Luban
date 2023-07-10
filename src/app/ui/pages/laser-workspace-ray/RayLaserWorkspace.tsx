import classNames from 'classnames';
import i18next from 'i18next';
import _ from 'lodash';
import includes from 'lodash/includes';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';

import {
    CNC_GCODE_SUFFIX,
    LASER_GCODE_SUFFIX,
    PRINTING_GCODE_SUFFIX,
    WORKFLOW_STATE_IDLE
} from '../../../constants';
import { RootState } from '../../../flux/index.def';
import { actions as widgetActions } from '../../../flux/widget';
import { actions as workspaceActions } from '../../../flux/workspace';
import { controller } from '../../../lib/controller';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import { Button } from '../../components/Buttons';
import Dropzone from '../../components/Dropzone';
import Modal from '../../components/Modal';
import MainToolBar from '../../layouts/MainToolBar';
import WorkspaceLayout from '../../layouts/WorkspaceLayout';
import styles from '../../layouts/styles/workspace.styl';
import { logPageView, renderWidgetList } from '../../utils';
import ConnectionWidget from '../../widgets/Connection';
import ConnectionControlWidget from '../../widgets/ConnectionControl';
import ConnectionFileTransferWidget from '../../widgets/ConnectionFileTransfer';
import EnclosureWidget from '../../widgets/Enclosure';
import VisualizerWidget from '../../widgets/WorkspaceVisualizer';


const allWidgets = {
    'connection': ConnectionWidget,
    'control': ConnectionControlWidget,
    'wifi-transport': ConnectionFileTransferWidget,
    'visualizer': VisualizerWidget,
    'enclosure': EnclosureWidget,
};


const ACCEPT = `${LASER_GCODE_SUFFIX}, ${CNC_GCODE_SUFFIX}, ${PRINTING_GCODE_SUFFIX}`;

const reloadPage = (forcedReload = true) => {
    // Reload the current page, without using the cache
    window.location.reload(forcedReload);
};

let workspaceVisualizerRef = null;

interface RayLaserWorkspaceProps {
    isPopup?: boolean;
    onClose: () => void;
    style: object;
    className: string;
}

const RayLaserWorkspace: React.FC<RayLaserWorkspaceProps> = ({ isPopup, onClose, style, className }) => {
    const history = useHistory();
    const dispatch = useDispatch();

    const defaultWidgets = useSelector((state: RootState) => state.widget.workspace.default.widgets);

    const [previewModalShow, setPreviewModalShow] = useState(false);
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
    const childRef = useCallback((ref) => {
        workspaceVisualizerRef = ref;
    }, []);

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
        onPreviewModalShow: (value) => {
            if (value !== previewModalShow) {
                setPreviewModalShow(value);
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
                                <h5>{i18n._('key-Workspace/Page-Server has stopped working.')}</h5>
                                <p>{i18n._('key-Workspace/Page-A problem caused the server to stop working correctly. Check the server status and try again.')}</p>
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            type="primary"
                            onClick={() => reloadPage()}
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

    const rightWidgetNames = ['connection'];

    return (
        <div style={style} className={classNames(className)}>
            <WorkspaceLayout
                renderMainToolBar={renderMainToolBar}
                renderLeftView={null}
                renderRightView={() => renderWidgetList('workspace', 'right', rightWidgetNames, allWidgets, listActions, {}, controlActions)}
            >
                <Dropzone
                    disabled={isDraggingWidget || controller.workflowState !== WORKFLOW_STATE_IDLE}
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

export default RayLaserWorkspace;
