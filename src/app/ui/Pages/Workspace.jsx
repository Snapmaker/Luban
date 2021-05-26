import _ from 'lodash';
import classNames from 'classnames';
import { connect } from 'react-redux';
import pubsub from 'pubsub-js';
import React, { PureComponent } from 'react';
import includes from 'lodash/includes';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Button } from '../../components/Buttons';
import Modal from '../../components/Modal';
import { controller } from '../../lib/controller';
import i18n from '../../lib/i18n';
import DefaultWidgets from './WorkspaceWidgets/DefaultWidgets';
import PrimaryWidgets from './WorkspaceWidgets/PrimaryWidgets';
import SecondaryWidgets from './WorkspaceWidgets/SecondaryWidgets';
import Dropzone from '../../components/Dropzone';
import styles from '../Layouts/styles/workspace.styl';
import WorkspaceLayout from '../Layouts/WorkspaceLayout';
import MainToolBar from '../Layouts/MainToolBar';

import {
    WORKFLOW_STATE_IDLE,
    LASER_GCODE_SUFFIX,
    CNC_GCODE_SUFFIX,
    PRINTING_GCODE_SUFFIX
} from '../../constants';
import modal from '../../lib/modal';
import { actions as workspaceActions } from '../../flux/workspace';
import { actions as widgetActions } from '../../flux/widget';

const ACCEPT = `${LASER_GCODE_SUFFIX}, ${CNC_GCODE_SUFFIX}, ${PRINTING_GCODE_SUFFIX}`;

const reloadPage = (forcedReload = true) => {
    // Reload the current page, without using the cache
    window.location.reload(forcedReload);
};

class Workspace extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes,
        showPrimaryContainer: PropTypes.bool.isRequired,
        showSecondaryContainer: PropTypes.bool.isRequired,
        defaultWidgets: PropTypes.array.isRequired,
        primaryWidgets: PropTypes.array.isRequired,
        secondaryWidgets: PropTypes.array.isRequired,
        updateTabContainer: PropTypes.func.isRequired,

        uploadGcodeFile: PropTypes.func.isRequired
    };

    state = {
        connected: controller.connected,
        havePrimaryWidget: this.props.showPrimaryContainer,
        haveSecondaryWidget: this.props.showSecondaryContainer,
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

    widgetEventHandler = {
        onDragStart: () => {
            this.setState({ isDraggingWidget: true });
        },
        onDragEnd: () => {
            this.setState({ isDraggingWidget: false });
        }
    };

    actions = {
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
        this.addResizeEventListener();

        // setTimeout(() => {
        //     A workaround solution to trigger componentDidUpdate on initial render
        // this.setState({ mounted: true });
        // }, 0);
    }

    componentDidUpdate() {
        this.resizeDefaultContainer();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
        this.removeResizeEventListener();
    }

    resizeDefaultContainer = () => {
        // const sidebar = document.querySelector('#sidebar');
        const sidebar = {
            offsetWidth: 0
        };
        const primaryContainer = this.primaryContainer.current?.parentElement;
        const primaryToggler = this.primaryToggler.current?.parentElement;
        const secondaryContainer = this.secondaryContainer.current?.parentElement;
        const secondaryToggler = this.secondaryToggler.current?.parentElement;
        const defaultContainer = this.defaultContainer.current?.parentElement;
        const { showPrimaryContainer, showSecondaryContainer } = this.props;

        { // Mobile-Friendly View
            const { location } = this.props;
            const disableHorizontalScroll = !(showPrimaryContainer && showSecondaryContainer);

            if (location.pathname === '/workspace' && disableHorizontalScroll) {
                // Disable horizontal scroll
                document.body.scrollLeft = 0;
                document.body.style.overflowX = 'hidden';
            } else {
                // Enable horizontal scroll
                document.body.style.overflowX = '';
            }
        }
        if (showPrimaryContainer) {
            defaultContainer.style.left = `${primaryContainer.offsetWidth + sidebar.offsetWidth}px`;
            primaryToggler.style.left = `${primaryContainer.offsetWidth + sidebar.offsetWidth}px`;
        } else {
            defaultContainer.style.left = `${sidebar.offsetWidth}px`;
            primaryToggler.style.left = `${sidebar.offsetWidth}px`;
        }

        if (showSecondaryContainer) {
            defaultContainer.style.right = `${secondaryContainer.offsetWidth}px`;
            secondaryToggler.style.right = `${secondaryContainer.offsetWidth}px`;
        } else {
            defaultContainer.style.right = '0px';
            secondaryToggler.style.right = '0px';
        }

        // Publish a 'resize' event
        pubsub.publish('resize'); // Also see "widgets/Visualizer"
    };

    togglePrimaryContainer = () => {
        const { showPrimaryContainer } = this.props;
        console.log('togglePrimaryContainer', showPrimaryContainer);
        this.props.updateTabContainer('left', { show: !showPrimaryContainer });
        this.setState({
            havePrimaryWidget: !showPrimaryContainer
        });
        // Publish a 'resize' event
        pubsub.publish('resize'); // Also see "widgets/Visualizer"
    };

    toggleSecondaryContainer = () => {
        const { showSecondaryContainer } = this.props;
        console.log('toggleSecondaryContainer', showSecondaryContainer);
        this.props.updateTabContainer('right', { show: !showSecondaryContainer });
        this.setState({
            haveSecondaryWidget: !showSecondaryContainer
        });

        // Publish a 'resize' event
        pubsub.publish('resize'); // Also see "widgets/Visualizer"
    };

    addResizeEventListener() {
        this.onResizeThrottled = _.throttle(this.resizeDefaultContainer, 50);
        window.addEventListener('resize', this.onResizeThrottled);
    }

    removeResizeEventListener() {
        window.removeEventListener('resize', this.onResizeThrottled);
        this.onResizeThrottled = null;
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
                        <div style={{ display: 'flex' }}>
                            <i className="fa fa-exclamation-circle fa-4x text-danger" />
                            <div style={{ marginLeft: 25 }}>
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

    renderLeftView(defaultWidgets, primaryWidgets) {
        return (
            <div
                ref={this.primaryContainer}
            >
                <PrimaryWidgets
                    defaultWidgets={defaultWidgets}
                    primaryWidgets={primaryWidgets}
                    toggleToDefault={this.actions.toggleToDefault}
                    onDragStart={this.widgetEventHandler.onDragStart}
                    onDragEnd={this.widgetEventHandler.onDragEnd}
                    updateTabContainer={this.props.updateTabContainer}
                />
            </div>
        );
    }

    renderLeftTogglerView(showPrimaryContainer) {
        const hidePrimaryContainer = !showPrimaryContainer;
        return (
            <div
                ref={this.primaryToggler}
            >
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={this.togglePrimaryContainer}
                >
                    {!hidePrimaryContainer && (
                        <i className="fa fa-chevron-left" style={{ verticalAlign: 'middle' }} />
                    )}
                    {hidePrimaryContainer && (
                        <i className="fa fa-chevron-right" style={{ verticalAlign: 'middle' }} />
                    )}
                </button>
            </div>
        );
    }

    renderCenterView(state) {
        const {
            havePrimaryWidget,
            haveSecondaryWidget,
            isDraggingWidget
        } = state;
        return (
            <Dropzone
                disabled={isDraggingWidget || controller.workflowState !== WORKFLOW_STATE_IDLE}
                accept={ACCEPT}
                dragEnterMsg={i18n._('Drop a G-code file here.')}
                havePrimaryWidget={havePrimaryWidget}
                haveSecondaryWidget={haveSecondaryWidget}
                onDropAccepted={this.actions.onDropAccepted}
                onDropRejected={this.actions.onDropRejected}
            >
                <div
                    ref={this.defaultContainer}
                    className={classNames(
                        styles.defaultContainer,
                        styles.fixed
                    )}
                >

                    <DefaultWidgets
                        defaultWidgets={this.props.defaultWidgets}
                        toggleFromDefault={this.actions.toggleFromDefault}
                    />
                </div>
            </Dropzone>
        );
    }

    renderRightTogglerView(showSecondaryContainer) {
        const hideSecondaryContainer = !showSecondaryContainer;
        return (
            <div
                ref={this.secondaryToggler}
            >
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={this.toggleSecondaryContainer}
                >
                    {!hideSecondaryContainer && (
                        <i className="fa fa-chevron-right" style={{ verticalAlign: 'middle' }} />
                    )}
                    {hideSecondaryContainer && (
                        <i className="fa fa-chevron-left" style={{ verticalAlign: 'middle' }} />
                    )}
                </button>
            </div>
        );
    }

    renderRightView(defaultWidgets, secondaryWidgets) {
        return (
            <div
                ref={this.secondaryContainer}
            >
                <SecondaryWidgets
                    defaultWidgets={defaultWidgets}
                    secondaryWidgets={secondaryWidgets}
                    toggleToDefault={this.actions.toggleToDefault}
                    onDragStart={this.widgetEventHandler.onDragStart}
                    onDragEnd={this.widgetEventHandler.onDragEnd}
                    updateTabContainer={this.props.updateTabContainer}
                />
            </div>
        );
    }

    renderMainToolBar = () => {
        const locationArray = [
            {
                title: 'Copy',
                action: () => this.props.history.push('laser')
            }
        ];
        const projectArray = [
            {
                title: 'Edit',
                action: () => this.props.history.push('cnc')
            }
        ];
        return (
            <MainToolBar
                locationArray={locationArray}
                projectArray={projectArray}
            />
        );
    }

    render() {
        const { style, className, primaryWidgets, secondaryWidgets, defaultWidgets, showPrimaryContainer, showSecondaryContainer } = this.props;
        const {
            connected
        } = this.state;

        return (
            <div style={style} className={classNames(className)}>
                <WorkspaceLayout
                    hideSecondaryContainer={!showSecondaryContainer}
                    hidePrimaryContainer={!showPrimaryContainer}
                    renderMainToolBar={this.renderMainToolBar}
                    renderModalView={() => this.renderModalView(connected)}
                    renderLeftView={() => this.renderLeftView(defaultWidgets, primaryWidgets)}
                    renderLeftTogglerView={() => this.renderLeftTogglerView(showPrimaryContainer)}
                    renderCenterView={() => this.renderCenterView(this.state)}
                    renderRightView={() => this.renderRightView(defaultWidgets, secondaryWidgets)}
                    renderRightTogglerView={() => this.renderRightTogglerView(showSecondaryContainer)}
                />
            </div>
        );
    }
}
const mapStateToProps = (state) => {
    const widget = state.widget;
    const showPrimaryContainer = widget.workspace.left.show;
    const primaryWidgets = widget.workspace.left.widgets;
    const showSecondaryContainer = widget.workspace.right.show;
    const secondaryWidgets = widget.workspace.right.widgets;
    const defaultWidgets = widget.workspace.default.widgets;
    return {
        showPrimaryContainer,
        showSecondaryContainer,
        defaultWidgets,
        primaryWidgets,
        secondaryWidgets
    };
};
const mapDispatchToProps = (dispatch) => ({
    uploadGcodeFile: (file) => dispatch(workspaceActions.uploadGcodeFile(file)),
    updateTabContainer: (container, value) => dispatch(widgetActions.updateTabContainer('workspace', container, value))
});

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(Workspace));
