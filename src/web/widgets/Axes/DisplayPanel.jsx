import includes from 'lodash/includes';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { DropdownButton, MenuItem } from 'react-bootstrap';
import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
import {
    METRIC_UNITS
} from '../../constants';
import styles from './index.styl';

class DisplayPanel extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    handleSelect = (eventKey) => {
        const data = eventKey;
        if (data) {
            controller.command('gcode', data);
        }
    };

    render() {
        const { state } = this.props;
        const { units, canClick, axes, workPosition } = state;
        const lengthUnits = (units === METRIC_UNITS) ? i18n._('mm') : i18n._('in');

        return (
            <div className={styles['display-panel']}>
                <table className="table-bordered">
                    <thead>
                        <tr>
                            <th className="nowrap" title={i18n._('Axis')}>{i18n._('Axis')}</th>
                            <th title={i18n._('Work Position')}>{i18n._('Work Position')}</th>
                            <th className="nowrap" title={i18n._('Action')}>{i18n._('Action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {includes(axes, 'x') && (
                            <tr>
                                <td className={styles.coordinate}>X</td>
                                <td className={styles.workPosition}>
                                    <span className={styles.dimensionUnits}>{lengthUnits}</span>

                                    <div>
                                        <span className={styles.integerPart}>{workPosition.x.split('.')[0]}</span>
                                        <span className={styles.decimalPoint}>.</span>
                                        <span className={styles.fractionalPart}>{workPosition.x.split('.')[1]}</span>
                                    </div>
                                </td>
                                <td className={styles.action}>
                                    <DropdownButton
                                        bsSize="xs"
                                        bsStyle="default"
                                        title="X"
                                        id="axis-x-dropdown"
                                        pullRight
                                        disabled={!canClick}
                                    >
                                        <MenuItem
                                            eventKey="G0 X0"
                                            onSelect={this.handleSelect}
                                            disabled={!canClick}
                                        >
                                            {i18n._('Go To Work Zero On X Axis (G0 X0)')}
                                        </MenuItem>
                                        <MenuItem
                                            eventKey="G92 X0"
                                            onSelect={this.handleSelect}
                                            disabled={!canClick}
                                        >
                                            {i18n._('Zero Out Temporary X Axis (G92 X0)')}
                                        </MenuItem>
                                    </DropdownButton>
                                </td>
                            </tr>
                        )}
                        {includes(axes, 'y') && (
                            <tr>
                                <td className={styles.coordinate}>Y</td>
                                <td className={styles.workPosition}>
                                    <span className={styles.dimensionUnits}>{lengthUnits}</span>
                                    <div>
                                        <span className={styles.integerPart}>{workPosition.y.split('.')[0]}</span>
                                        <span className={styles.decimalPoint}>.</span>
                                        <span className={styles.fractionalPart}>{workPosition.y.split('.')[1]}</span>
                                    </div>
                                </td>
                                <td className={styles.action}>
                                    <DropdownButton
                                        bsSize="xs"
                                        bsStyle="default"
                                        title="Y"
                                        id="axis-y-dropdown"
                                        pullRight
                                        disabled={!canClick}
                                    >
                                        <MenuItem
                                            eventKey="G0 Y0"
                                            onSelect={this.handleSelect}
                                            disabled={!canClick}
                                        >
                                            {i18n._('Go To Work Zero On Y Axis (G0 Y0)')}
                                        </MenuItem>
                                        <MenuItem
                                            eventKey="G92 Y0"
                                            onSelect={this.handleSelect}
                                            disabled={!canClick}
                                        >
                                            {i18n._('Zero Out Temporary Y Axis (G92 Y0)')}
                                        </MenuItem>
                                    </DropdownButton>
                                </td>
                            </tr>
                        )}
                        {includes(axes, 'z') && (
                            <tr>
                                <td className={styles.coordinate}>Z</td>
                                <td className={styles.workPosition}>
                                    <span className={styles.dimensionUnits}>{lengthUnits}</span>

                                    <div>
                                        <span className={styles.integerPart}>{workPosition.z.split('.')[0]}</span>
                                        <span className={styles.decimalPoint}>.</span>
                                        <span className={styles.fractionalPart}>{workPosition.z.split('.')[1]}</span>
                                    </div>
                                </td>
                                <td className={styles.action}>
                                    <DropdownButton
                                        bsSize="xs"
                                        bsStyle="default"
                                        title="Z"
                                        id="axis-z-dropdown"
                                        pullRight
                                        disabled={!canClick}
                                    >
                                        <MenuItem
                                            eventKey="G0 Z0"
                                            onSelect={this.handleSelect}
                                            disabled={!canClick}
                                        >
                                            {i18n._('Go To Work Zero On Z Axis (G0 Z0)')}
                                        </MenuItem>
                                        <MenuItem
                                            eventKey="G92 Z0"
                                            onSelect={this.handleSelect}
                                            disabled={!canClick}
                                        >
                                            {i18n._('Zero Out Temporary Z Axis (G92 Z0)')}
                                        </MenuItem>
                                    </DropdownButton>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        );
    }
}

export default DisplayPanel;
