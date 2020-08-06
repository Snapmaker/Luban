/* eslint-disable */
import includes from 'lodash/includes';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownButton } from 'react-bootstrap';
import i18n from '../../lib/i18n';
import {
    MACHINE_HEAD_TYPE,
    METRIC_UNITS
} from '../../constants';
import styles from './index.styl';

class DisplayPanel extends PureComponent {
    static propTypes = {
        executeGcode: PropTypes.func.isRequired,
        workPosition: PropTypes.object.isRequired,
        headType: PropTypes.string,
        originOffset: PropTypes.object.isRequired,
        state: PropTypes.object
    };

    actions = {
        onSelect: (eventKey) => {
            const data = eventKey;
            if (data) {
                this.props.executeGcode(data);
            }
        }
    };

    render() {
        const { state, workPosition, originOffset, headType } = this.props;
        const { x, y, z } = originOffset;
        const { units, canClick, axes } = state;
        const lengthUnits = (units === METRIC_UNITS) ? i18n._('mm') : i18n._('in');
        let machinePositionX = (Math.round((parseFloat(workPosition.x) - x) * 1000) / 1000).toFixed(3);
        let machinePositionY = (Math.round((parseFloat(workPosition.y) - y) * 1000) / 1000).toFixed(3);
        let machinePositionZ = (Math.round((parseFloat(workPosition.z) - z) * 1000) / 1000).toFixed(3);
        let machinePositionB = (Math.round(parseFloat(workPosition.b)* 1000) / 1000).toFixed(3);
        if (headType === MACHINE_HEAD_TYPE['3DP'].value) {
            machinePositionX = workPosition.x;
            machinePositionY = workPosition.y;
            machinePositionZ = workPosition.z;
        }

        return (
            <div className={styles['coordinate-panel']}>
                <table className="table table-bordered">
                    <thead>
                        <tr>
                            <th>{i18n._('Axis')}</th>
                            <th>{i18n._('Machine Coordinates')}</th>
                            <th>{i18n._('Work Coordinates')}</th>
                            <th>{i18n._('Action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {includes(axes, 'x') && (
                            <tr>
                                <td className={styles['field-axis']}>X</td>
                                <td className={styles['field-position']}>
                                    <div>
                                        <span className={styles['integer-part']}>{machinePositionX}</span>
                                    </div>
                                    <span className={styles.unit}>{lengthUnits}</span>
                                </td>
                                <td className={styles['field-position']}>
                                    <div>
                                        <span className={styles['integer-part']}>{workPosition.x.split('.')[0]}</span>
                                        <span className={styles['decimal-point']}>.</span>
                                        <span className={styles['fractional-part']}>{workPosition.x.split('.')[1]}</span>
                                    </div>
                                    <span className={styles.unit}>{lengthUnits}</span>
                                </td>
                                <td className={styles.action}>
                                    <DropdownButton
                                        id="axis-x-dropdown"
                                        title="X"
                                        variant="outline-secondary"
                                        alignRight
                                        disabled={!canClick}
                                    >
                                        <Dropdown.Item
                                            eventKey="G0 X0"
                                            onSelect={this.actions.onSelect}
                                            disabled={!canClick}
                                        >
                                            {i18n._('Go To Work Zero On X Axis (G0 X0)')}
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            eventKey="G92 X0"
                                            onSelect={this.actions.onSelect}
                                            disabled={!canClick}
                                        >
                                            {i18n._('Zero Out Temporary X Axis (G92 X0)')}
                                        </Dropdown.Item>
                                    </DropdownButton>
                                </td>
                            </tr>
                        )}
                        {includes(axes, 'y') && (
                            <tr>
                                <td className={styles['field-axis']}>Y</td>
                                <td className={styles['field-position']}>
                                    <div>
                                        <span className={styles['integer-part']}>{machinePositionY}</span>
                                    </div>
                                    <span className={styles.unit}>{lengthUnits}</span>
                                </td>
                                <td className={styles['field-position']}>
                                    <span className={styles.unit}>{lengthUnits}</span>
                                    <div>
                                        <span className={styles['integer-part']}>{workPosition.y.split('.')[0]}</span>
                                        <span className={styles['decimal-point']}>.</span>
                                        <span className={styles['fractional-part']}>{workPosition.y.split('.')[1]}</span>
                                    </div>
                                </td>
                                <td className={styles.action}>
                                    <DropdownButton
                                        id="axis-y-dropdown"
                                        title="Y"
                                        variant="outline-secondary"
                                        alignRight
                                        disabled={!canClick}
                                    >
                                        <Dropdown.Item
                                            eventKey="G0 Y0"
                                            onSelect={this.actions.onSelect}
                                            disabled={!canClick}
                                        >
                                            {i18n._('Go To Work Zero On Y Axis (G0 Y0)')}
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            eventKey="G92 Y0"
                                            onSelect={this.actions.onSelect}
                                            disabled={!canClick}
                                        >
                                            {i18n._('Zero Out Temporary Y Axis (G92 Y0)')}
                                        </Dropdown.Item>
                                    </DropdownButton>
                                </td>
                            </tr>
                        )}
                        {includes(axes, 'z') && (
                            <tr>
                                <td className={styles['field-axis']}>Z</td>
                                <td className={styles['field-position']}>
                                    <div>
                                        <span className={styles['integer-part']}>{machinePositionZ}</span>
                                    </div>
                                    <span className={styles.unit}>{lengthUnits}</span>
                                </td>
                                <td className={styles['field-position']}>
                                    <div>
                                        <span className={styles['integer-part']}>{workPosition.z.split('.')[0]}</span>
                                        <span className={styles['decimal-point']}>.</span>
                                        <span className={styles['fractional-part']}>{workPosition.z.split('.')[1]}</span>
                                    </div>
                                    <span className={styles.unit}>{lengthUnits}</span>
                                </td>
                                <td className={styles.action}>
                                    <DropdownButton
                                        id="axis-z-dropdown"
                                        title="Z"
                                        variant="outline-secondary"
                                        alignRight
                                        disabled={!canClick}
                                    >
                                        <Dropdown.Item
                                            eventKey="G0 Z0"
                                            onSelect={this.actions.onSelect}
                                            disabled={!canClick}
                                        >
                                            {i18n._('Go To Work Zero On Z Axis (G0 Z0)')}
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            eventKey="G92 Z0"
                                            onSelect={this.actions.onSelect}
                                            disabled={!canClick}
                                        >
                                            {i18n._('Zero Out Temporary Z Axis (G92 Z0)')}
                                        </Dropdown.Item>
                                    </DropdownButton>
                                </td>
                            </tr>
                        )}
                        {workPosition.isFourAxis && (
                            <tr>
                                <td className={styles['field-axis']}>B</td>
                                <td className={styles['field-position']}>
                                    <div>
                                        <span className={styles['integer-part']}>{machinePositionB}</span>
                                    </div>
                                    <span className={styles.unit}>{lengthUnits}</span>
                                </td>
                                <td className={styles['field-position']}>
                                    <div>
                                        <span className={styles['integer-part']}>{machinePositionB.split('.')[0]}</span>
                                        <span className={styles['decimal-point']}>.</span>
                                        <span className={styles['fractional-part']}>{machinePositionB.split('.')[1]}</span>
                                    </div>
                                    <span className={styles.unit}>{lengthUnits}</span>
                                </td>
                                <td className={styles.action}>
                                    <DropdownButton
                                        id="axis-z-dropdown"
                                        title="B"
                                        variant="outline-secondary"
                                        alignRight
                                        disabled={!canClick}
                                    >
                                        <Dropdown.Item
                                            eventKey="G0 B0"
                                            onSelect={this.actions.onSelect}
                                            disabled={!canClick}
                                        >
                                            {i18n._('Go To Work Zero On B Axis (G0 B0)')}
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            eventKey="G92 B0"
                                            onSelect={this.actions.onSelect}
                                            disabled={!canClick}
                                        >
                                            {i18n._('Zero Out Temporary B Axis (G92 B0)')}
                                        </Dropdown.Item>
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
