/* eslint-disable */
import classNames from 'classnames';
import includes from 'lodash/includes';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { HEAD_PRINTING, METRIC_UNITS } from '../../../constants';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import Dropdown from '../../components/Dropdown';
import Menu from '../../components/Menu';
import SvgIcon from '../../components/SvgIcon';
import styles from './styles.styl';

const OperationDropdown = (
    {
        menus,
        title,
        onClick,
        disabled
    }
) => {
    return <Dropdown
        overlay={(
            <Menu>
                {
                    menus.map((menu) => (
                        <Menu.Item
                            onClick={e => onClick(e, menu.isSetOrigin)}
                            key={menu.key}
                            disabled={disabled || menu.disabled}
                        >
                            <div className={classNames('align-c', 'padding-vertical-4')}>
                                {menu.title}
                            </div>
                        </Menu.Item>
                    ))
                }
            </Menu>
        )}
        placement="bottomLeft"
        trigger="click"
        disabled={disabled}
    >
        <Button>
            <div className={classNames(styles['operation-dropdown-icon'])}>
                {title}
                <SvgIcon
                    name="DropdownLine"
                    size={16}
                    type={['static']}
                />
            </div>
        </Button>
    </Dropdown>
};

class DisplayPanel extends PureComponent {
    static propTypes = {
        executeGcode: PropTypes.func.isRequired,
        workPosition: PropTypes.object.isRequired,
        headType: PropTypes.string,
        originOffset: PropTypes.object.isRequired,
        state: PropTypes.object
    };

    actions = {
        onClick: (event, isSetOrigin = false) => {
            const data = event.key;
            if (this.props.headType === HEAD_PRINTING) {
                if (isSetOrigin) return;
                else {
                    if (data) {
                        this.props.executeGcode(data);
                    }
                }
            } else {
                if (data) {
                    this.props.executeGcode(data);
                }
            }
        }
    };

    render() {
        const { state, workPosition, originOffset, headType } = this.props;
        const { x, y, z, b } = originOffset;
        const { units, canClick, axes } = state;
        const lengthUnits = (units === METRIC_UNITS) ? i18n._('key-Workspace/Control/DisplayPanel-mm') : i18n._('key-Workspace/Control/DisplayPanel-in');
        let machinePositionX = (Math.round((parseFloat(workPosition.x) - x) * 1000) / 1000).toFixed(3);
        let machinePositionY = (Math.round((parseFloat(workPosition.y) - y) * 1000) / 1000).toFixed(3);
        let machinePositionZ = (Math.round((parseFloat(workPosition.z) - z) * 1000) / 1000).toFixed(3);
        let machinePositionB = (Math.round((parseFloat(workPosition.b) - b) * 1000) / 1000).toFixed(3);
        if (headType === HEAD_PRINTING) {
            machinePositionX = workPosition.x;
            machinePositionY = workPosition.y;
            machinePositionZ = workPosition.z;
        }
        return (
            <div className={classNames(styles['coordinate-panel'], 'margin-bottom-16')}>
                <table className="table table-bordered " style={{
                    borderCollapse: 'separate', borderRadius: '8px',
                    borderSpacing: 0
                }}>
                    <thead>
                        <tr>
                            <th>{i18n._('key-Workspace/Control/DisplayPanel-Axis')}</th>
                            <th>{i18n._('key-Workspace/Control/DisplayPanel-Machine Coordinates')}</th>
                            <th>{i18n._('key-Workspace/Control/DisplayPanel-Work Coordinates')}</th>
                            <th>{i18n._('key-Workspace/Control/DisplayPanel-Action')}</th>
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
                                    <OperationDropdown
                                        onClick={this.actions.onClick}
                                        title={'X'}
                                        disabled={!canClick}
                                        menus={[
                                            { key: 'G0 X0', title: i18n._('key-Workspace/Control/DisplayPanel-Go To Work Zero On X Axis (G0 X0)') },
                                            {
                                                key: 'G92 X0',
                                                title: i18n._('key-Workspace/Control/DisplayPanel-Zero Out Temporary X Axis (G92 X0)'),
                                                isSetOrigin: true
                                            }
                                        ]} />
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
                                    <OperationDropdown
                                        onClick={this.actions.onClick}
                                        title={'Y'}
                                        disabled={!canClick}
                                        menus={[
                                            { key: 'G0 Y0', title: i18n._('key-Workspace/Control/DisplayPanel-Go To Work Zero On Y Axis (G0 Y0)') },
                                            {
                                                key: 'G92 Y0',
                                                title: i18n._('key-Workspace/Control/DisplayPanel-Zero Out Temporary Y Axis (G92 Y0)'),
                                                isSetOrigin: true
                                            }
                                        ]} />
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
                                    <OperationDropdown
                                        onClick={this.actions.onClick}
                                        title={'Z'}
                                        disabled={!canClick}
                                        menus={[
                                            { key: 'G0 Z0', title: i18n._('key-Workspace/Control/DisplayPanel-Go To Work Zero On Z Axis (G0 Z0)') },
                                            {
                                                key: 'G92 Z0',
                                                title: i18n._('key-Workspace/Control/DisplayPanel-Zero Out Temporary Z Axis (G92 Z0)'),
                                                isSetOrigin: true
                                            }
                                        ]} />
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
                                    <span className={styles.unit}>°</span>
                                </td>
                                <td className={styles['field-position']}>
                                    <div>
                                        <span className={styles['integer-part']}>{(workPosition.b || '').split('.')[0]}</span>
                                        <span className={styles['decimal-point']}>.</span>
                                        <span className={styles['fractional-part']}>{(workPosition.b || '').split('.')[1]}</span>
                                    </div>
                                    <span className={styles.unit}>°</span>
                                </td>
                                <td className={styles.action}>
                                    <OperationDropdown
                                        onClick={this.actions.onClick}
                                        title={'B'}
                                        disabled={!canClick}
                                        menus={[
                                            { key: 'G0 B0', title: i18n._('key-Workspace/Control/DisplayPanel-Go To Work Zero On B Axis (G0 B0)') },
                                            {
                                                key: 'G92 B0',
                                                title: i18n._('key-Workspace/Control/DisplayPanel-Zero Out Temporary B Axis (G92 B0)'),
                                                isSetOrigin: true
                                            }
                                        ]} />
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
