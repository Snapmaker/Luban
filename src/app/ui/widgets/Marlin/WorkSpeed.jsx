import React, { PureComponent } from 'react';
import SvgIcon from '../../components/SvgIcon';
import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import {
    CONNECTION_WORKSPEED_FACTOR } from '../../../constants';
// CONNECTION_GET_WORKSPEED_FACTOR,
import { controller } from '../../../lib/controller';


class WorkSpeed extends PureComponent {
    static propTypes = {
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
            controller.emitEvent(CONNECTION_WORKSPEED_FACTOR, {
                workSpeedValue,
                // toolHead: this.props.toolHead, // DUAL_EXTRUDER_TOOLHEAD_FOR_SM2
            });
        }
    };

    componentDidMount() {
        // controller.emitEvent(CONNECTION_GET_WORKSPEED_FACTOR).on(CONNECTION_GET_WORKSPEED_FACTOR, (res) => {
        //     const { data } = res;
        //     console.log('data', data);
        // });
    }

    componentWillUnmount() {
        // controller.emitEvent(CONNECTION_WORKSPEED_FACTOR, {
        //     workSpeedValue: value,
        //     toolHead: this.props.toolHead, // DUAL_EXTRUDER_TOOLHEAD_FOR_SM2
        // });
    }

    render() {
        const { workSpeed, workSpeedValue } = this.state;
        const actions = this.actions;
        return (
            <div className="sm-flex justify-space-between margin-vertical-8">
                <span className="height-32">{i18n._('key-unused-Work Speed')}</span>
                <div className="sm-flex-auto">
                    <span className="height-32">{workSpeed}/</span>
                    <Input
                        suffix="%"
                        size="small"
                        value={workSpeedValue}
                        max={500}
                        min={0}
                        onChange={actions.onChangeWorkSpeedValue}
                    />
                    <SvgIcon
                        name="Reset"
                        size={24}
                        className="border-default-black-5 margin-left-4 border-radius-8"
                        onClick={actions.onClickWorkSpeed}
                        borderRadius={8}
                    />
                </div>
            </div>
        );
    }
}

export default WorkSpeed;
