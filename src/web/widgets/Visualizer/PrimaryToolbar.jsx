import classNames from 'classnames';
import colornames from 'colornames';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, MenuItem } from 'react-bootstrap';
import Detector from 'three/examples/js/Detector';
import Interpolate from '../../components/Interpolate';
import i18n from '../../lib/i18n';
import styles from './primary-toolbar.styl';

class PrimaryToolbar extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    render() {
        const { state, actions } = this.props;
        const { coordinateVisible, toolheadVisible, gcodeFilenameVisible, cameraProjection } = state;
        return (
            <div>
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
                                onSelect={actions.setCameraToPerspective}
                            >
                                <i className={classNames('fa', 'fa-fw', { 'fa-check': cameraProjection === 'perspective' })} />
                                <span className="space space-sm" />
                                {i18n._('Perspective Projection')}
                            </MenuItem>
                            <MenuItem
                                onSelect={actions.setCameraToOrthographic}
                            >
                                <i className={classNames('fa', 'fa-fw', { 'fa-check': cameraProjection === 'orthographic' })} />
                                <span className="space space-sm" />
                                {i18n._('Orthographic Projection')}
                            </MenuItem>
                            <MenuItem divider />
                            <MenuItem header>
                                {i18n._('Scene Objects')}
                            </MenuItem>
                            <MenuItem
                                onSelect={actions.switchGCodeFilenameVisibility}
                            >
                                {gcodeFilenameVisible
                                    ? <i className="fa fa-toggle-on fa-fw" />
                                    : <i className="fa fa-toggle-off fa-fw" />
                                }
                                <span className="space space-sm" />
                                {i18n._('Display G-code Filename')}
                            </MenuItem>
                            <MenuItem
                                onSelect={actions.switchCoordinateVisibility}
                            >
                                {coordinateVisible
                                    ? <i className="fa fa-toggle-on fa-fw" />
                                    : <i className="fa fa-toggle-off fa-fw" />
                                }
                                <span className="space space-sm" />
                                {coordinateVisible
                                    ? i18n._('Hide Coordinate System')
                                    : i18n._('Show Coordinate System')
                                }
                            </MenuItem>
                            <MenuItem
                                onSelect={actions.switchToolheadVisibility}
                            >
                                {toolheadVisible
                                    ? <i className="fa fa-toggle-on fa-fw" />
                                    : <i className="fa fa-toggle-off fa-fw" />
                                }
                                <span className="space space-sm" />
                                {toolheadVisible
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
