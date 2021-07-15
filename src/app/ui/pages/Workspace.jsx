import _ from 'lodash';
import classNames from 'classnames';
import { connect } from 'react-redux';
import React, { PureComponent } from 'react';
import includes from 'lodash/includes';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Button } from '../components/Buttons';
import Modal from '../components/Modal';
import { controller } from '../../lib/controller';
import i18n from '../../lib/i18n';
// import DefaultWidgets from './WorkspaceWidgets/DefaultWidgets';
// import PrimaryWidgets from './WorkspaceWidgets/PrimaryWidgets';
// import SecondaryWidgets from './WorkspaceWidgets/SecondaryWidgets';

import Dropzone from '../components/Dropzone';
import styles from '../layouts/styles/workspace.styl';
import WorkspaceLayout from '../layouts/WorkspaceLayout';
import MainToolBar from '../layouts/MainToolBar';

import {
    WORKFLOW_STATE_IDLE,
    LASER_GCODE_SUFFIX,
    CNC_GCODE_SUFFIX,
    PRINTING_GCODE_SUFFIX
} from '../../constants';
import modal from '../../lib/modal';
import { actions as projectActions } from '../../flux/project';
import { actions as workspaceActions } from '../../flux/workspace';
import { actions as widgetActions } from '../../flux/widget';

import { renderWidgetList } from '../utils';

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
// import PrintingMaterialWidget from '../widgets/PrintingMaterial';
// import PrintingConfigurationsWidget from '../widgets/PrintingConfigurations';
// import PrintingOutputWidget from '../widgets/PrintingOutput';
import WifiTransport from '../widgets/WifiTransport';
import EnclosureWidget from '../widgets/Enclosure';
import CncLaserObjectList from '../widgets/CncLaserList';
// import PrintingObjectList from '../widgets/PrintingObjectList';
import JobType from '../widgets/JobType';
import PrintingVisualizer from '../widgets/PrintingVisualizer';
import MachineSettingWidget from '../widgets/MachineSetting';

const allWidgets = {
    'control': ControlWidget,
    // 'axesPanel': DevelopAxesWidget,
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
    // 'laser-output': CncLaserOutputWidget,
    'laser-set-background': LaserSetBackground,
    'laser-test-focus': LaserTestFocusWidget,
    'cnc-path': CNCPathWidget,
    // 'cnc-output': CncLaserOutputWidget,
    'cnc-laser-object-list': CncLaserObjectList,
    'job-type': JobType,
    'machine-setting': MachineSettingWidget
};


const ACCEPT = `${LASER_GCODE_SUFFIX}, ${CNC_GCODE_SUFFIX}, ${PRINTING_GCODE_SUFFIX}`;

const reloadPage = (forcedReload = true) => {
    // Reload the current page, without using the cache
    window.location.reload(forcedReload);
};

class Workspace extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes,
        defaultWidgets: PropTypes.array.isRequired,
        primaryWidgets: PropTypes.array.isRequired,
        secondaryWidgets: PropTypes.array.isRequired,
        updateTabContainer: PropTypes.func.isRequired,
        // save: PropTypes.func.isRequired,

        uploadGcodeFile: PropTypes.func.isRequired
    };

    state = {
        leftItems: [
            {
                title: i18n._('Home'),
                type: 'button',
                name: 'MainToolbarHome',
                action: () => {
                    this.props.history.push('/');
                }
            }
        ],
        connected: controller.connected,
        isDraggingWidget: false
    };

    primaryContainer = React.createRef();

    secondaryContainer = React.createRef();

    primaryToggler = React.createRef();

    secondaryToggler = React.createRef();

    defaultContainer = React.createRef();

    controllerEvents = {
        'connect': () => {
            this.setState({ connected: controller.connected });
        },
        'disconnect': () => {
            this.setState({ connected: controller.connected });
        }
    };

    listActions = {
        // toggleToDefault: this.actions.toggleToDefault,
        onDragStart: () => {
            this.setState({ isDraggingWidget: true });
        },
        onDragEnd: () => {
            this.setState({ isDraggingWidget: false });
        }
    };

    actions = {
        addReturnButton: () => {
            if (!this.props.onClose) {
                return;
            }
            const returnButton = {
                title: 'Return',
                action: this.props.onClose
            };
            this.setState({ leftItems: [returnButton] });
        },
        onDropAccepted: (file) => {
            this.props.uploadGcodeFile(file);
        },
        onDropRejected: () => {
            const title = i18n._('Warning');
            const body = i18n._('Only G-code files are supported');
            modal({
                title: title,
                body: body
            });
        },
        toggleFromDefault: (widgetId) => () => {
            // clone
            const defaultWidgets = _.slice(this.props.defaultWidgets);
            if (includes(defaultWidgets, widgetId)) {
                defaultWidgets.splice(defaultWidgets.indexOf(widgetId), 1);
                this.props.updateTabContainer('default', { widgets: defaultWidgets });
            }
        },
        toggleToDefault: (widgetId) => () => {
            // clone
            const defaultWidgets = _.slice(this.props.defaultWidgets);
            if (!includes(defaultWidgets, widgetId)) {
                defaultWidgets.push(widgetId);
                this.props.updateTabContainer('default', { widgets: defaultWidgets });
            }
        }
    };

    componentDidMount() {
        this.addControllerEvents();

        if (this.props.isPopup && this.props.onClose) {
            this.actions.addReturnButton();
        }
        // setTimeout(() => {
        //     A workaround solution to trigger componentDidUpdate on initial render
        // this.setState({ mounted: true });
        // }, 0);
    }

    componentWillUnmount() {
        this.removeControllerEvents();
        // this.props.save('3dp');
    }


    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    renderModalView(connected) {
        if (connected) {
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
                                <h5>{i18n._('Server has stopped working')}</h5>
                                <p>{i18n._('A problem caused the server to stop working correctly. Check out the server status and try again.')}</p>
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            btnStyle="primary"
                            onClick={reloadPage}
                        >
                            {i18n._('Reload')}
                        </Button>
                    </Modal.Footer>
                </Modal>
            );
        }
    }


    renderMainToolBar = () => {
        return (
            <MainToolBar
                leftItems={this.state.leftItems}
            />
        );
    }

    render() {
        const { style, className, primaryWidgets, secondaryWidgets } = this.props;
        const {
            isDraggingWidget,
            connected
        } = this.state;
        console.log('primaryWidgets', primaryWidgets, secondaryWidgets);

        const widgetProps = { };
        return (
            <div style={style} className={classNames(className)}>
                <WorkspaceLayout
                    renderMainToolBar={this.renderMainToolBar}
                    renderLeftView={() => renderWidgetList('workspace', 'left', primaryWidgets, allWidgets, this.listActions, widgetProps)}
                    renderRightView={() => renderWidgetList('workspace', 'right', secondaryWidgets, allWidgets, this.listActions, widgetProps)}
                    updateTabContainer={this.props.updateTabContainer}
                >
                    <Dropzone
                        disabled={isDraggingWidget || controller.workflowState !== WORKFLOW_STATE_IDLE}
                        accept={ACCEPT}
                        dragEnterMsg={i18n._('Drop a G-code file here.')}
                        onDropAccepted={this.actions.onDropAccepted}
                        onDropRejected={this.actions.onDropRejected}
                    >
                        <div
                            ref={this.defaultContainer}
                            className={classNames(
                                styles.defaultContainer,
                            )}
                        >
                            <VisualizerWidget />

                        </div>
                    </Dropzone>
                    {this.renderModalView(connected)}
                </WorkspaceLayout>
            </div>
        );
    }
}
const mapStateToProps = (state) => {
    const widget = state.widget;
    const primaryWidgets = widget.workspace.left.widgets;
    const secondaryWidgets = widget.workspace.right.widgets;
    const defaultWidgets = widget.workspace.default.widgets;
    return {
        defaultWidgets,
        primaryWidgets,
        secondaryWidgets
    };
};
const mapDispatchToProps = (dispatch) => ({
    uploadGcodeFile: (file) => dispatch(workspaceActions.uploadGcodeFile(file)),
    save: (pageHeadType) => dispatch(projectActions.save(pageHeadType)),
    updateTabContainer: (container, value) => dispatch(widgetActions.updateTabContainer('workspace', container, value))
});

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(Workspace));
