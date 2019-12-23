import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Slider from 'rc-slider/es/Slider';
import Anchor from '../../../components/Anchor';
import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import { actions as machineActions } from '../../../flux/machine';


class Printing extends PureComponent {
    static propTypes = {
        printingExpanded: PropTypes.bool,
        laserPower: PropTypes.number,

        executePrintingGcode: PropTypes.func.isRequired,
        updateWidgetState: PropTypes.func
    };


    state = {
        workSpeed: 100,
        workSpeedValue: 100,
        laserPowerOpen: false,
        laserPower: this.props.laserPower || 0,
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
        togglePrinting: () => {
            this.props.updateWidgetState({
                printingExpanded: !this.props.printingExpanded
            });
        },
        onChangeLaserPower: (value) => {
            this.setState({
                laserPower: value
            });
        },
        onClickLaserPower: () => {
            if (this.state.laserPowerOpen) {
                this.props.executePrintingGcode('M5');
            } else {
                this.props.executePrintingGcode(`M3 P${this.state.headPower} S${this.state.headPower * 255 / 100}`);
            }
            this.setState({
                laserPowerOpen: !this.state.laserPowerOpen
            });
        },
        onChangeWorkSpeedValue: (value) => {
            this.setState({
                workSpeedValue: value
            });
        },
        onClickWorkSpeed: () => {
            const workSpeedValue = this.state.workSpeedValue;
            this.setState({
                workSpeed: workSpeedValue
            });
            this.props.executePrintingGcode(`M221 S${workSpeedValue}`);
        }
    };

    render() {
        const { printingExpanded } = this.props;
        const { laserPowerOpen, laserPowerMarks, laserPower, workSpeed, workSpeedValue } = this.state;
        const actions = this.actions;
        return (
            <div>
                <div className="sm-parameter-container">
                    <Anchor className="sm-parameter-header" onClick={actions.togglePrinting}>
                        <span className="fa fa-gear sm-parameter-header__indicator" />
                        <span className="sm-parameter-header__title">{i18n._('Laser')}</span>
                        <span className={classNames(
                            'fa',
                            printingExpanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                            'sm-parameter-header__indicator',
                            'pull-right',
                        )}
                        />
                    </Anchor>
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label-lg">{i18n._('Work Speed')}</span>
                        <span className="sm-parameter-row__input2-text">{workSpeed}/</span>
                        <Input
                            className="sm-parameter-row__input2"
                            value={workSpeedValue}
                            max={500}
                            min={0}
                            onChange={actions.onChangeWorkSpeedValue}
                        />
                        <span className="sm-parameter-row__input2-unit">%</span>
                        <Anchor
                            className="sm-parameter-row__input2-check fa fa-chevron-circle-right"
                            onClick={actions.onClickWorkSpeed}
                        />
                    </div>
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label-lg">{i18n._('Laser Power')}</span>
                        <button
                            type="button"
                            className={!laserPowerOpen ? 'sm-btn-small sm-btn-primary' : 'sm-btn-small sm-btn-danger'}
                            style={{
                                float: 'right'
                            }}
                            onClick={this.actions.onClickLaserPower}
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
                            onChange={actions.onChangeLaserPower}
                        />
                        <Input
                            className="sm-parameter-row__slider2-input"
                            value={laserPower}
                            max={100}
                            min={0}
                            onChange={actions.onChangeLaserPower}
                        />
                        <span className="sm-parameter-row__input-unit">%</span>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { laserPower } = machine;

    return {
        laserPower
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executePrintingGcode: (gcode) => dispatch(machineActions.executePrintingGcode(gcode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Printing);
