import _ from 'lodash';
import classNames from 'classnames';
import colornames from 'colornames';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import shallowCompare from 'react-addons-shallow-compare';
import { Dropdown, MenuItem } from 'react-bootstrap';
import Detector from 'three/examples/js/Detector';
import Interpolate from '../../components/Interpolate';
import i18n from '../../lib/i18n';
import {
    // Grbl
    GRBL,
    GRBL_ACTIVE_STATE_IDLE,
    GRBL_ACTIVE_STATE_RUN,
    GRBL_ACTIVE_STATE_HOLD,
    GRBL_ACTIVE_STATE_DOOR,
    GRBL_ACTIVE_STATE_HOME,
    GRBL_ACTIVE_STATE_SLEEP,
    GRBL_ACTIVE_STATE_ALARM,
    GRBL_ACTIVE_STATE_CHECK,
    // Marlin
    MARLIN,
    // Smoothie
    SMOOTHIE,
    SMOOTHIE_ACTIVE_STATE_IDLE,
    SMOOTHIE_ACTIVE_STATE_RUN,
    SMOOTHIE_ACTIVE_STATE_HOLD,
    SMOOTHIE_ACTIVE_STATE_DOOR,
    SMOOTHIE_ACTIVE_STATE_HOME,
    SMOOTHIE_ACTIVE_STATE_SLEEP,
    SMOOTHIE_ACTIVE_STATE_ALARM,
    SMOOTHIE_ACTIVE_STATE_CHECK,
    // TinyG
    TINYG,
    TINYG_MACHINE_STATE_INITIALIZING,
    TINYG_MACHINE_STATE_READY,
    TINYG_MACHINE_STATE_ALARM,
    TINYG_MACHINE_STATE_STOP,
    TINYG_MACHINE_STATE_END,
    TINYG_MACHINE_STATE_RUN,
    TINYG_MACHINE_STATE_HOLD,
    TINYG_MACHINE_STATE_PROBE,
    TINYG_MACHINE_STATE_CYCLE,
    TINYG_MACHINE_STATE_HOMING,
    TINYG_MACHINE_STATE_JOG,
    TINYG_MACHINE_STATE_INTERLOCK,
    TINYG_MACHINE_STATE_SHUTDOWN,
    TINYG_MACHINE_STATE_PANIC,
    // Workflow
    WORKFLOW_STATE_IDLE
} from '../../constants';
import styles from './primary-toolbar.styl';

class PrimaryToolbar extends Component {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    shouldComponentUpdate(nextProps, nextState) {
        return shallowCompare(this, nextProps, nextState);
    }
    canSendCommand() {
        const { state } = this.props;
        const { port, controller, workflowState } = state;

        if (!port) {
            return false;
        }
        if (!controller.type || !controller.state) {
            return false;
        }
        if (workflowState !== WORKFLOW_STATE_IDLE) {
            return false;
        }

        return true;
    }
    renderControllerType() {
        const { state } = this.props;
        const controllerType = state.controller.type;

        return (
            <div className={styles.controllerType}>
                {controllerType}
            </div>
        );
    }
    renderControllerState() {
        const { state } = this.props;
        const controllerType = state.controller.type;
        const controllerState = state.controller.state;
        let stateStyle = '';
        let stateText = '';

        if (controllerType === GRBL) {
            const activeState = _.get(controllerState, 'status.activeState');

            stateStyle = {
                [GRBL_ACTIVE_STATE_IDLE]: 'controller-state-default',
                [GRBL_ACTIVE_STATE_RUN]: 'controller-state-primary',
                [GRBL_ACTIVE_STATE_HOLD]: 'controller-state-warning',
                [GRBL_ACTIVE_STATE_DOOR]: 'controller-state-warning',
                [GRBL_ACTIVE_STATE_HOME]: 'controller-state-primary',
                [GRBL_ACTIVE_STATE_SLEEP]: 'controller-state-success',
                [GRBL_ACTIVE_STATE_ALARM]: 'controller-state-danger',
                [GRBL_ACTIVE_STATE_CHECK]: 'controller-state-info'
            }[activeState];

            stateText = {
                [GRBL_ACTIVE_STATE_IDLE]: i18n.t('controller:Grbl.activeState.idle'),
                [GRBL_ACTIVE_STATE_RUN]: i18n.t('controller:Grbl.activeState.run'),
                [GRBL_ACTIVE_STATE_HOLD]: i18n.t('controller:Grbl.activeState.hold'),
                [GRBL_ACTIVE_STATE_DOOR]: i18n.t('controller:Grbl.activeState.door'),
                [GRBL_ACTIVE_STATE_HOME]: i18n.t('controller:Grbl.activeState.home'),
                [GRBL_ACTIVE_STATE_SLEEP]: i18n.t('controller:Grbl.activeState.sleep'),
                [GRBL_ACTIVE_STATE_ALARM]: i18n.t('controller:Grbl.activeState.alarm'),
                [GRBL_ACTIVE_STATE_CHECK]: i18n.t('controller:Grbl.activeState.check')
            }[activeState];
        }

        // FIXME
        if (controllerType === MARLIN) {
            // Unsupported
        }

        if (controllerType === SMOOTHIE) {
            const activeState = _.get(controllerState, 'status.activeState');

            stateStyle = {
                [SMOOTHIE_ACTIVE_STATE_IDLE]: 'controller-state-default',
                [SMOOTHIE_ACTIVE_STATE_RUN]: 'controller-state-primary',
                [SMOOTHIE_ACTIVE_STATE_HOLD]: 'controller-state-warning',
                [SMOOTHIE_ACTIVE_STATE_DOOR]: 'controller-state-warning',
                [SMOOTHIE_ACTIVE_STATE_HOME]: 'controller-state-primary',
                [SMOOTHIE_ACTIVE_STATE_SLEEP]: 'controller-state-success',
                [SMOOTHIE_ACTIVE_STATE_ALARM]: 'controller-state-danger',
                [SMOOTHIE_ACTIVE_STATE_CHECK]: 'controller-state-info'
            }[activeState];

            stateText = {
                [SMOOTHIE_ACTIVE_STATE_IDLE]: i18n.t('controller:Smoothie.activeState.idle'),
                [SMOOTHIE_ACTIVE_STATE_RUN]: i18n.t('controller:Smoothie.activeState.run'),
                [SMOOTHIE_ACTIVE_STATE_HOLD]: i18n.t('controller:Smoothie.activeState.hold'),
                [SMOOTHIE_ACTIVE_STATE_DOOR]: i18n.t('controller:Smoothie.activeState.door'),
                [SMOOTHIE_ACTIVE_STATE_HOME]: i18n.t('controller:Smoothie.activeState.home'),
                [SMOOTHIE_ACTIVE_STATE_SLEEP]: i18n.t('controller:Smoothie.activeState.sleep'),
                [SMOOTHIE_ACTIVE_STATE_ALARM]: i18n.t('controller:Smoothie.activeState.alarm'),
                [SMOOTHIE_ACTIVE_STATE_CHECK]: i18n.t('controller:Smoothie.activeState.check')
            }[activeState];
        }

        if (controllerType === TINYG) {
            const machineState = _.get(controllerState, 'sr.machineState');

            // https://github.com/synthetos/g2/wiki/Alarm-Processing
            stateStyle = {
                [TINYG_MACHINE_STATE_INITIALIZING]: 'controller-state-warning',
                [TINYG_MACHINE_STATE_READY]: 'controller-state-default',
                [TINYG_MACHINE_STATE_ALARM]: 'controller-state-danger',
                [TINYG_MACHINE_STATE_STOP]: 'controller-state-default',
                [TINYG_MACHINE_STATE_END]: 'controller-state-default',
                [TINYG_MACHINE_STATE_RUN]: 'controller-state-primary',
                [TINYG_MACHINE_STATE_HOLD]: 'controller-state-warning',
                [TINYG_MACHINE_STATE_PROBE]: 'controller-state-primary',
                [TINYG_MACHINE_STATE_CYCLE]: 'controller-state-primary',
                [TINYG_MACHINE_STATE_HOMING]: 'controller-state-primary',
                [TINYG_MACHINE_STATE_JOG]: 'controller-state-primary',
                [TINYG_MACHINE_STATE_INTERLOCK]: 'controller-state-warning',
                [TINYG_MACHINE_STATE_SHUTDOWN]: 'controller-state-danger',
                [TINYG_MACHINE_STATE_PANIC]: 'controller-state-danger'
            }[machineState];

            stateText = {
                [TINYG_MACHINE_STATE_INITIALIZING]: i18n.t('controller:TinyG.machineState.initializing'),
                [TINYG_MACHINE_STATE_READY]: i18n.t('controller:TinyG.machineState.ready'),
                [TINYG_MACHINE_STATE_ALARM]: i18n.t('controller:TinyG.machineState.alarm'),
                [TINYG_MACHINE_STATE_STOP]: i18n.t('controller:TinyG.machineState.stop'),
                [TINYG_MACHINE_STATE_END]: i18n.t('controller:TinyG.machineState.end'),
                [TINYG_MACHINE_STATE_RUN]: i18n.t('controller:TinyG.machineState.run'),
                [TINYG_MACHINE_STATE_HOLD]: i18n.t('controller:TinyG.machineState.hold'),
                [TINYG_MACHINE_STATE_PROBE]: i18n.t('controller:TinyG.machineState.probe'),
                [TINYG_MACHINE_STATE_CYCLE]: i18n.t('controller:TinyG.machineState.cycle'),
                [TINYG_MACHINE_STATE_HOMING]: i18n.t('controller:TinyG.machineState.homing'),
                [TINYG_MACHINE_STATE_JOG]: i18n.t('controller:TinyG.machineState.jog'),
                [TINYG_MACHINE_STATE_INTERLOCK]: i18n.t('controller:TinyG.machineState.interlock'),
                [TINYG_MACHINE_STATE_SHUTDOWN]: i18n.t('controller:TinyG.machineState.shutdown'),
                [TINYG_MACHINE_STATE_PANIC]: i18n.t('controller:TinyG.machineState.panic')
            }[machineState];
        }

        return (
            <div
                className={classNames(
                    styles.controllerState,
                    styles[stateStyle]
                )}
            >
                {stateText}
            </div>
        );
    }
    getWorkCoordinateSystem() {
        const { state } = this.props;
        const controllerType = state.controller.type;
        const controllerState = state.controller.state;
        const defaultWCS = 'G54';

        if (controllerType === GRBL) {
            return _.get(controllerState, 'parserstate.modal.coordinate') || defaultWCS;
        }

        if (controllerType === SMOOTHIE) {
            return _.get(controllerState, 'parserstate.modal.coordinate') || defaultWCS;
        }

        if (controllerType === TINYG) {
            return _.get(controllerState, 'sr.modal.coordinate') || defaultWCS;
        }

        return defaultWCS;
    }
    render() {
        const { state, actions } = this.props;
        const { disabled, gcode, projection, objects } = state;
        const controllerType = this.renderControllerType();
        const controllerState = this.renderControllerState();
        const canToggleOptions = Detector.webgl && !disabled;

        return (
            <div>
                {controllerType}
                {controllerState}
                <div className={styles.dropdownGroup}>

                    <Dropdown
                        bsSize="xs"
                        id="visualizer-dropdown"
                        pullRight
                    >
                        <button
                            type="button"
                            className="btn btn-default"
                            title={(!Detector.webgl || disabled)
                                ? i18n._('Enable 3D View')
                                : i18n._('Disable 3D View')
                            }
                            onClick={actions.toggle3DView}
                        >
                            {(!Detector.webgl || disabled)
                                ? <i className="fa fa-toggle-off" />
                                : <i className="fa fa-toggle-on" />
                            }
                            <span className="space" />
                            {i18n._('3D View')}
                        </button>
                        <Dropdown.Toggle
                            bsStyle="default"
                            noCaret
                        >
                            <i className="fa fa-caret-down" />
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <MenuItem
                                style={{ color: '#222' }}
                                header
                            >
                                <Interpolate
                                    format={'WebGL: {{status}}'}
                                    replacement={{
                                        status: Detector.webgl
                                            ? (<span style={{ color: colornames('royalblue') }}>{i18n._('Enabled')}</span>)
                                            : (<span style={{ color: colornames('crimson') }}>{i18n._('Disabled')}</span>)
                                    }}
                                />
                            </MenuItem>
                            <MenuItem divider />
                            <MenuItem header>
                                {i18n._('Projection')}
                            </MenuItem>
                            <MenuItem
                                disabled={!canToggleOptions}
                                onSelect={actions.toPerspectiveProjection}
                            >
                                <i className={classNames('fa', 'fa-fw', { 'fa-check': projection !== 'orthographic' })} />
                                <span className="space space-sm" />
                                {i18n._('Perspective Projection')}
                            </MenuItem>
                            <MenuItem
                                disabled={!canToggleOptions}
                                onSelect={actions.toOrthographicProjection}
                            >
                                <i className={classNames('fa', 'fa-fw', { 'fa-check': projection === 'orthographic' })} />
                                <span className="space space-sm" />
                                {i18n._('Orthographic Projection')}
                            </MenuItem>
                            <MenuItem divider />
                            <MenuItem header>
                                {i18n._('Scene Objects')}
                            </MenuItem>
                            <MenuItem
                                disabled={!canToggleOptions}
                                onSelect={actions.toggleGCodeFilename}
                            >
                                {gcode.displayName
                                    ? <i className="fa fa-toggle-on fa-fw" />
                                    : <i className="fa fa-toggle-off fa-fw" />
                                }
                                <span className="space space-sm" />
                                {i18n._('Display G-code Filename')}
                            </MenuItem>
                            <MenuItem
                                disabled={!canToggleOptions}
                                onSelect={actions.toggleCoordinateSystemVisibility}
                            >
                                {objects.coordinateSystem.visible
                                    ? <i className="fa fa-toggle-on fa-fw" />
                                    : <i className="fa fa-toggle-off fa-fw" />
                                }
                                <span className="space space-sm" />
                                {objects.coordinateSystem.visible
                                    ? i18n._('Hide Coordinate System')
                                    : i18n._('Show Coordinate System')
                                }
                            </MenuItem>
                            <MenuItem
                                disabled={!canToggleOptions}
                                onSelect={actions.toggleToolheadVisibility}
                            >
                                {objects.toolhead.visible
                                    ? <i className="fa fa-toggle-on fa-fw" />
                                    : <i className="fa fa-toggle-off fa-fw" />
                                }
                                <span className="space space-sm" />
                                {objects.toolhead.visible
                                    ? i18n._('Hide Toolhead')
                                    : i18n._('Show Toolhead')
                                }
                            </MenuItem>
                        </Dropdown.Menu>
                    </Dropdown>
                </div>
            </div>
        );
    }
}

export default PrimaryToolbar;
