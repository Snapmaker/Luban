import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from 'rc-slider/es/Slider';
import _ from 'lodash';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import { actions as machineActions } from '../../flux/machine';
import WorkSpeed from './WorkSpeed';
import { CONNECTION_TYPE_WIFI, WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_RUNNING } from '../../constants';

class Printing extends PureComponent {
    static propTypes = {
        headStatus: PropTypes.bool,
        laserPower: PropTypes.number,
        isLaserPrintAutoMode: PropTypes.bool,
        materialThickness: PropTypes.number,
        laserFocalLength: PropTypes.number,
        workflowStatus: PropTypes.string,
        connectionType: PropTypes.string,
        server: PropTypes.object,
        size: PropTypes.object,

        executeGcode: PropTypes.func.isRequired,
        updateState: PropTypes.func.isRequired
    };


    state = {
        laserPowerOpen: this.props.headStatus,
        laserPower: this.props.laserPower || 5,
        laserPowerMarks: {
            0: 0,
            5: 5,
            20: 20,
            40: 40,
            60: 60,
            80: 80,
            100: 100
        }
    };

    actions = {
        isWifiPrinting: () => {
            const { workflowStatus, connectionType } = this.props;
            return _.includes([WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED], workflowStatus)
                && connectionType === CONNECTION_TYPE_WIFI;
        },
        onChangeLaserPower: (value) => {
            this.setState({
                laserPower: value
            });
        },
        onClickLaserPower: () => {
            if (this.actions.isWifiPrinting()) {
                return;
            }
            if (this.state.laserPowerOpen) {
                this.props.executeGcode('M5');
            } else {
                this.props.executeGcode(`M3 P${this.state.laserPower} S${this.state.laserPower * 255 / 100}`);
            }
            this.setState({
                laserPowerOpen: !this.state.laserPowerOpen
            });
        },
        onSaveLaserPower: () => {
            if (this.actions.isWifiPrinting()) {
                this.props.server.updateLaserPower(this.state.laserPower);
            } else {
                if (this.state.laserPowerOpen) {
                    this.props.executeGcode(`M3 P${this.state.laserPower} S${this.state.laserPower * 255 / 100}`);
                } else {
                    this.props.executeGcode(`M3 P${this.state.laserPower} S${this.state.laserPower * 255 / 100}`);
                    this.props.executeGcode('M5');
                }
                this.props.executeGcode('M500');
            }
        },
        onChangeLaserPrintMode: () => {
            this.props.updateState({
                isLaserPrintAutoMode: !this.props.isLaserPrintAutoMode
            });
        },
        onChangeMaterialThickness: (value) => {
            this.props.updateState({
                materialThickness: value
            });
        }
    };

    render() {
        const { size, isLaserPrintAutoMode, materialThickness, laserFocalLength, connectionType } = this.props;
        const { laserPowerOpen, laserPowerMarks, laserPower } = this.state;
        const actions = this.actions;
        const isWifiPrinting = this.actions.isWifiPrinting();

        return (
            <div>
                <div className="sm-parameter-container">
                    <div>
                        {connectionType === CONNECTION_TYPE_WIFI && (
                            <div>
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label-lg">{i18n._('Printing Auto Mode')}</span>
                                    <span>
                                        <input
                                            className="sm-parameter-row__input2-check"
                                            style={{
                                                margin: '0 0'
                                            }}
                                            type="checkbox"
                                            checked={isLaserPrintAutoMode}
                                            onChange={actions.onChangeLaserPrintMode}
                                        />
                                    </span>
                                </div>
                                {isLaserPrintAutoMode && (
                                    <div>
                                        <div className="sm-parameter-row">
                                            <span className="sm-parameter-row__label-lg">{i18n._('Material Thickness')}</span>
                                            <span>
                                                <Input
                                                    className="sm-parameter-row__input"
                                                    value={materialThickness}
                                                    max={size.z - 40}
                                                    min={0}
                                                    onChange={actions.onChangeMaterialThickness}
                                                />
                                            </span>
                                            <span className="sm-parameter-row__input-unit">mm</span>
                                        </div>
                                    </div>
                                )}
                                {isLaserPrintAutoMode && laserFocalLength && (
                                    <div>
                                        <div className="sm-parameter-row">
                                            <span className="sm-parameter-row__label-lg">{i18n._('Laser Focus')}</span>
                                            <span
                                                className="sm-parameter-row__input"
                                                style={{
                                                    paddingLeft: '44px'
                                                }}
                                            >
                                                {laserFocalLength}
                                            </span>
                                            <span className="sm-parameter-row__input-unit">mm</span>
                                        </div>
                                        <div className="sm-parameter-row">
                                            <span className="sm-parameter-row__label-lg">{i18n._('Z Offset')}</span>
                                            <span
                                                className="sm-parameter-row__input"
                                                style={{
                                                    paddingLeft: '44px'
                                                }}
                                            >
                                                {laserFocalLength + materialThickness}
                                            </span>
                                            <span className="sm-parameter-row__input-unit">mm</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <WorkSpeed />
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label-lg">{i18n._('Laser Power')}</span>
                            <button
                                type="button"
                                className={!laserPowerOpen ? 'sm-btn-small sm-btn-primary' : 'sm-btn-small sm-btn-danger'}
                                style={{
                                    float: 'right'
                                }}
                                onClick={this.actions.onClickLaserPower}
                                disabled={isWifiPrinting}
                            >
                                {laserPowerOpen && <i className="fa fa-toggle-off" />}
                                {!laserPowerOpen && <i className="fa fa-toggle-on" />}
                                <span className="space" />
                                {!laserPowerOpen ? i18n._('Open') : i18n._('Close')}
                            </button>
                        </div>
                        <div className="sm-parameter-row">
                            <Slider
                                className="sm-parameter-row__slider2"
                                max={100}
                                min={0}
                                marks={laserPowerMarks}
                                value={laserPower}
                                onChange={actions.onChangeLaserPower}
                            />
                            <span className="sm-parameter-row__input2-text">{this.props.laserPower}/</span>
                            <Input
                                className="sm-parameter-row__input2"
                                value={laserPower}
                                max={100}
                                min={0}
                                onChange={actions.onChangeLaserPower}
                            />
                            <span className="sm-parameter-row__input2-unit">%</span>
                            <Anchor
                                className="sm-parameter-row__input2-check fa fa-chevron-circle-right"
                                onClick={actions.onSaveLaserPower}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { size, workflowStatus, connectionType, server, laserPower, headStatus, isLaserPrintAutoMode, materialThickness, laserFocalLength } = machine;

    return {
        size,
        workflowStatus,
        connectionType,
        server,
        laserPower,
        headStatus,
        isLaserPrintAutoMode,
        materialThickness,
        laserFocalLength
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(gcode, context)),
        updateState: (state) => dispatch(machineActions.updateState(state))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Printing);
