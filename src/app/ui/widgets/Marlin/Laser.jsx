import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import _ from 'lodash';
import Slider from '../../components/Slider';
import Switch from '../../components/Switch';
import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import Checkbox from '../../components/Checkbox';
import SvgIcon from '../../components/SvgIcon';
import { actions as machineActions } from '../../../flux/machine';
import WorkSpeed from './WorkSpeed';
import { CONNECTION_TYPE_WIFI, WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_RUNNING } from '../../../constants';

class Laser extends PureComponent {
    static propTypes = {
        headStatus: PropTypes.bool,
        laserPower: PropTypes.number,
        workPosition: PropTypes.object.isRequired,
        isLaserPrintAutoMode: PropTypes.bool,
        materialThickness: PropTypes.number,
        laserFocalLength: PropTypes.number,
        workflowStatus: PropTypes.string,
        connectionType: PropTypes.string,
        server: PropTypes.object,
        size: PropTypes.object,

        executeGcode: PropTypes.func.isRequired,
        updateIsLaserPrintAutoMode: PropTypes.func.isRequired,
        updateMaterialThickness: PropTypes.func.isRequired
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
            this.props.updateIsLaserPrintAutoMode(!this.props.isLaserPrintAutoMode);
        },
        onChangeMaterialThickness: (value) => {
            this.props.updateMaterialThickness(value);
        },
        onChangeFourAxisMaterialThickness: (value) => {
            this.props.updateMaterialThickness(value / 2);
        }
    };

    render() {
        const { size, isLaserPrintAutoMode, materialThickness, laserFocalLength, workPosition, connectionType } = this.props;
        const { laserPowerOpen, laserPowerMarks, laserPower } = this.state;
        const actions = this.actions;
        const isWifiPrinting = this.actions.isWifiPrinting();

        return (
            <div>
                {connectionType === CONNECTION_TYPE_WIFI && (
                    <div>
                        <div className="sm-flex height-32 justify-space-between margin-vertical-8">
                            <span>{i18n._('key_ui/widgets/Marlin/Laser_Auto Mode')}</span>
                            <Checkbox
                                className="sm-flex-auto"
                                checked={isLaserPrintAutoMode}
                                onChange={actions.onChangeLaserPrintMode}
                            />
                        </div>
                        {isLaserPrintAutoMode && !workPosition.isFourAxis && (
                            <div className="sm-flex height-32 justify-space-between margin-vertical-8">
                                <span className="">{i18n._('key_ui/widgets/Marlin/Laser_Material Thickness')}</span>
                                <Input
                                    suffix="mm"
                                    className="sm-flex-auto"
                                    size="small"
                                    value={materialThickness}
                                    max={size.z - 40}
                                    min={0}
                                    onChange={actions.onChangeMaterialThickness}
                                />
                            </div>
                        )}
                        {isLaserPrintAutoMode && workPosition.isFourAxis && (
                            <div className="sm-flex height-32 justify-space-between margin-vertical-8">
                                <span className="">{i18n._('key_ui/widgets/Marlin/Laser_Material Diameter')}</span>
                                <Input
                                    suffix="mm"
                                    className="sm-flex-auto"
                                    size="small"
                                    value={materialThickness * 2}
                                    max={size.z - 40}
                                    min={0}
                                    onChange={actions.onChangeFourAxisMaterialThickness}
                                />
                            </div>
                        )}
                        {isLaserPrintAutoMode && laserFocalLength && (
                            <div>
                                <div className="sm-flex height-32 justify-space-between margin-vertical-8">
                                    <span>{i18n._('key_ui/widgets/Marlin/Laser_Laser Height')}</span>
                                    <Input
                                        suffix="mm"
                                        className="sm-flex-auto"
                                        size="small"
                                        disabled
                                        value={laserFocalLength.toFixed(2)}
                                    />
                                </div>
                                <div className="sm-flex height-32 justify-space-between margin-vertical-8">
                                    <span>{i18n._('key_ui/widgets/Marlin/Laser_Z Offset')}</span>
                                    <Input
                                        suffix="mm"
                                        className="sm-flex-auto"
                                        size="small"
                                        disabled
                                        value={(laserFocalLength + materialThickness).toFixed(2)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <WorkSpeed />
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key_ui/widgets/Marlin/Laser_Laser Power')}</span>
                    <Switch
                        className="sm-flex-auto"
                        onClick={this.actions.onClickLaserPower}
                        disabled={isWifiPrinting}
                        checked={Boolean(laserPowerOpen)}
                    />
                </div>
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <Slider
                        max={100}
                        min={0}
                        size="middle"
                        className="height-56"
                        marks={laserPowerMarks}
                        value={laserPower}
                        onChange={actions.onChangeLaserPower}
                    />
                    <div className="">
                        <span>{this.props.laserPower}/</span>
                        <Input
                            suffix="%"
                            value={laserPower}
                            max={100}
                            min={0}
                            size="small"
                            onChange={actions.onChangeLaserPower}
                        />
                        <SvgIcon
                            name="Reset"
                            size={24}
                            className="border-default-black-5 margin-left-4 border-radius-8"
                            onClick={actions.onSaveLaserPower}
                            borderRadius={8}
                        />
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { size, workflowStatus, connectionType, server, laserPower, headStatus, isLaserPrintAutoMode, materialThickness, workPosition, laserFocalLength } = machine;

    return {
        size,
        workflowStatus,
        connectionType,
        server,
        workPosition,
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
        updateIsLaserPrintAutoMode: (isLaserPrintAutoMode) => dispatch(machineActions.updateIsLaserPrintAutoMode(isLaserPrintAutoMode)),
        updateMaterialThickness: (materialThickness) => dispatch(machineActions.updateMaterialThickness(materialThickness))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Laser);
