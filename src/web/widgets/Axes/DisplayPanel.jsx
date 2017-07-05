import classNames from 'classnames';
import includes from 'lodash/includes';
import React, { Component, PropTypes } from 'react';
import shallowCompare from 'react-addons-shallow-compare';
import { DropdownButton, MenuItem } from 'react-bootstrap';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
import {
    METRIC_UNITS
} from '../../constants';
import styles from './index.styl';

class DisplayPanel extends Component {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    state = {
        showXPositionInput: false,
        showYPositionInput: false,
        showZPositionInput: false,
        showAPositionInput: false
    };

    shouldComponentUpdate(nextProps, nextState) {
        return shallowCompare(this, nextProps, nextState);
    }
    handleSelect(eventKey) {
        const data = eventKey;
        if (data) {
            controller.command('gcode', data);
        }
    }
    render() {
        const { state, actions } = this.props;
        const { units, canClick, axes, workPosition } = state;
        const lengthUnits = (units === METRIC_UNITS) ? i18n._('mm') : i18n._('in');
        const degreeUnits = i18n._('deg');
        const {
            showXPositionInput,
            showYPositionInput,
            showZPositionInput,
            showAPositionInput
        } = this.state;
        const hideXPositionInput = !showXPositionInput;
        const hideYPositionInput = !showYPositionInput;
        const hideZPositionInput = !showZPositionInput;
        const hideAPositionInput = !showAPositionInput;

        return (
            <div className={styles.displayPanel}>
                <table className="table-bordered">
                    <thead>
                        <tr>
                            <th className="nowrap" title={i18n._('Axis')}>{i18n._('Axis')}</th>
                            <th title={i18n._('Work Position')}>{i18n._('Work Position')}</th>
                            <th className="nowrap" title={i18n._('Action')}>{i18n._('Action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {includes(axes, 'x') &&
                        <tr>
                            <td className={styles.coordinate}>X</td>
                            <td className={styles.workPosition}>
                                <span className={styles.dimensionUnits}>{lengthUnits}</span>

                                {hideXPositionInput && canClick &&
                                <Anchor
                                    style={{ color: 'inherit' }}
                                    title={i18n._('Edit')}
                                    onClick={() => {
                                        this.setState({ showXPositionInput: true });
                                    }}
                                >
                                    <span className={styles.integerPart}>{workPosition.x.split('.')[0]}</span>
                                    <span className={styles.decimalPoint}>.</span>
                                    <span className={styles.fractionalPart}>{workPosition.x.split('.')[1]}</span>
                                </Anchor>
                                }
                                {hideXPositionInput && !canClick &&
                                <div>
                                    <span className={styles.integerPart}>{workPosition.x.split('.')[0]}</span>
                                    <span className={styles.decimalPoint}>.</span>
                                    <span className={styles.fractionalPart}>{workPosition.x.split('.')[1]}</span>
                                </div>
                                }
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
                                        onSelect={::this.handleSelect}
                                        disabled={!canClick}
                                    >
                                        {i18n._('Go To Work Zero On X Axis (G0 X0)')}
                                    </MenuItem>
                                    <MenuItem
                                        eventKey="G92 X0"
                                        onSelect={::this.handleSelect}
                                        disabled={!canClick}
                                    >
                                        {i18n._('Zero Out Temporary X Axis (G92 X0)')}
                                    </MenuItem>
                                </DropdownButton>
                            </td>
                        </tr>
                        }
                        {includes(axes, 'y') &&
                        <tr>
                            <td className={styles.coordinate}>Y</td>
                            <td className={styles.workPosition}>
                                <span className={styles.dimensionUnits}>{lengthUnits}</span>
                                {hideYPositionInput && canClick &&
                                <Anchor
                                    style={{ color: 'inherit' }}
                                    title={i18n._('Edit')}
                                    onClick={() => {
                                        this.setState({ showYPositionInput: true });
                                    }}
                                >
                                    <span className={styles.integerPart}>{workPosition.y.split('.')[0]}</span>
                                    <span className={styles.decimalPoint}>.</span>
                                    <span className={styles.fractionalPart}>{workPosition.y.split('.')[1]}</span>
                                </Anchor>
                                }
                                {hideYPositionInput && !canClick &&
                                <div>
                                    <span className={styles.integerPart}>{workPosition.y.split('.')[0]}</span>
                                    <span className={styles.decimalPoint}>.</span>
                                    <span className={styles.fractionalPart}>{workPosition.y.split('.')[1]}</span>
                                </div>
                                }
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
                                        onSelect={::this.handleSelect}
                                        disabled={!canClick}
                                    >
                                        {i18n._('Go To Work Zero On Y Axis (G0 Y0)')}
                                    </MenuItem>
                                    <MenuItem
                                        eventKey="G92 Y0"
                                        onSelect={::this.handleSelect}
                                        disabled={!canClick}
                                    >
                                        {i18n._('Zero Out Temporary Y Axis (G92 Y0)')}
                                    </MenuItem>
                                </DropdownButton>
                            </td>
                        </tr>
                        }
                        {includes(axes, 'z') &&
                        <tr>
                            <td className={styles.coordinate}>Z</td>
                            <td className={styles.workPosition}>
                                <span className={styles.dimensionUnits}>{lengthUnits}</span>

                                {hideZPositionInput && canClick &&
                                <Anchor
                                    style={{ color: 'inherit' }}
                                    title={i18n._('Edit')}
                                    onClick={() => {
                                        if (canClick) {
                                            this.setState({ showZPositionInput: true });
                                        }
                                    }}
                                >
                                    <span className={styles.integerPart}>{workPosition.z.split('.')[0]}</span>
                                    <span className={styles.decimalPoint}>.</span>
                                    <span className={styles.fractionalPart}>{workPosition.z.split('.')[1]}</span>
                                </Anchor>
                                }
                                {hideZPositionInput && !canClick &&
                                <div>
                                    <span className={styles.integerPart}>{workPosition.z.split('.')[0]}</span>
                                    <span className={styles.decimalPoint}>.</span>
                                    <span className={styles.fractionalPart}>{workPosition.z.split('.')[1]}</span>
                                </div>
                                }
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
                                        onSelect={::this.handleSelect}
                                        disabled={!canClick}
                                    >
                                        {i18n._('Go To Work Zero On Z Axis (G0 Z0)')}
                                    </MenuItem>
                                    <MenuItem
                                        eventKey="G92 Z0"
                                        onSelect={::this.handleSelect}
                                        disabled={!canClick}
                                    >
                                        {i18n._('Zero Out Temporary Z Axis (G92 Z0)')}
                                    </MenuItem>
                                </DropdownButton>
                            </td>
                        </tr>
                        }
                        {includes(axes, 'a') &&
                        <tr>
                            <td className={classNames(styles.coordinate, styles.top)}>
                                <div>A</div>
                                <Anchor
                                    className={styles.moveBackward}
                                    onClick={() => {
                                        const distance = actions.getJogDistance();
                                        actions.jog({ A: -distance });
                                    }}
                                >
                                    <i className="fa fa-fw fa-minus" />
                                </Anchor>
                                <Anchor
                                    className={styles.moveForward}
                                    onClick={() => {
                                        const distance = actions.getJogDistance();
                                        actions.jog({ A: distance });
                                    }}
                                >
                                    <i className="fa fa-fw fa-plus" />
                                </Anchor>
                            </td>
                            <td className={styles.workPosition}>
                                <span className={styles.dimensionUnits}>{degreeUnits}</span>
                                {hideAPositionInput && canClick &&
                                <Anchor
                                    style={{ color: 'inherit' }}
                                    title={i18n._('Edit')}
                                    onClick={() => {
                                        if (canClick) {
                                            this.setState({ showAPositionInput: true });
                                        }
                                    }}
                                >
                                    <span className={styles.integerPart}>{workPosition.a.split('.')[0]}</span>
                                    <span className={styles.decimalPoint}>.</span>
                                    <span className={styles.fractionalPart}>{workPosition.a.split('.')[1]}</span>
                                </Anchor>
                                }
                                {hideAPositionInput && !canClick &&
                                <div>
                                    <span className={styles.integerPart}>{workPosition.a.split('.')[0]}</span>
                                    <span className={styles.decimalPoint}>.</span>
                                    <span className={styles.fractionalPart}>{workPosition.a.split('.')[1]}</span>
                                </div>
                                }
                            </td>
                            <td className={styles.action}>
                                <DropdownButton
                                    bsSize="xs"
                                    bsStyle="default"
                                    title="A"
                                    id="axis-a-dropdown"
                                    pullRight
                                    disabled={!canClick}
                                >

                                    <MenuItem
                                        eventKey="G0 A0"
                                        onSelect={::this.handleSelect}
                                        disabled={!canClick}
                                    >
                                        {i18n._('Go To Work Zero On A Axis (G0 A0)')}
                                    </MenuItem>


                                    <MenuItem
                                        eventKey="G92 A0"
                                        onSelect={::this.handleSelect}
                                        disabled={!canClick}
                                    >
                                        {i18n._('Zero Out Temporary A Axis (G92 A0)')}
                                    </MenuItem>
                                </DropdownButton>
                            </td>
                        </tr>
                        }
                    </tbody>
                </table>
            </div>
        );
    }
}

export default DisplayPanel;
