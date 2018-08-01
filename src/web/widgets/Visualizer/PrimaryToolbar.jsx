import classNames from 'classnames';
import colornames from 'colornames';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, MenuItem } from 'react-bootstrap';
import Detector from 'three/examples/js/Detector';
import Interpolate from '../../components/Interpolate';
import i18n from '../../lib/i18n';
import { WORKFLOW_STATE_IDLE } from '../../constants';
import styles from './primary-toolbar.styl';

class PrimaryToolbar extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

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
        let stateStyle = '';
        let stateText = '';

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
        const defaultWCS = 'G54';

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
