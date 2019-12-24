import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import { actions as machineActions } from '../../flux/machine';


class WorkSpeed extends PureComponent {
    static propTypes = {
        executePrintingGcode: PropTypes.func.isRequired
    };


    state = {
        workSpeed: 100,
        workSpeedValue: 100
    };

    actions = {
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
            this.props.executePrintingGcode(`M220 S${workSpeedValue}`);
        }
    };

    render() {
        const { workSpeed, workSpeedValue } = this.state;
        const actions = this.actions;
        return (

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
        );
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        executePrintingGcode: (gcode) => dispatch(machineActions.executePrintingGcode(gcode))
    };
};

export default connect(null, mapDispatchToProps)(WorkSpeed);
