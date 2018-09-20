import React, { PureComponent } from 'react';
import Select from 'react-select';
import pubsub from 'pubsub-js';
import i18n from '../../lib/i18n';
import { ACTION_LASER_MULTI_PASS_CHANGE } from '../../constants';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';


class MultiPass extends PureComponent {
    state = {
        enableMultiPass: false,
        passTimes: 2,
        stepDepth: 1
    };

    actions = {
        onChangeStepDepth: (value) => {
            this.setState(
                { stepDepth: value },
                () => {
                    this.publishChanges();
                }
            );
        },
        onChangePassTimes: (option) => {
            this.setState(
                { passTimes: option.value },
                () => {
                    this.publishChanges();
                }
            );
        },
        onChangeEnabledMultiPass: (event) => {
            this.setState(
                { enableMultiPass: event.target.checked },
                () => {
                    this.publishChanges();
                }
            );
        }
    };

    publishChanges() {
        pubsub.publish(
            ACTION_LASER_MULTI_PASS_CHANGE,
            {
                enableMultiPass: this.state.enableMultiPass,
                passTimes: this.state.passTimes,
                stepDepth: this.state.stepDepth
            }
        );
    }

    render() {
        const actions = this.actions;
        const state = this.state;
        return (
            <React.Fragment>
                <table>
                    <tbody>
                        <tr>
                            <td style={{ width: '100%' }}>
                                {i18n._('Enabled Multi Pass')}
                            </td>
                            <td>
                                <TipTrigger
                                    placement="right"
                                    title={i18n._('Enabled Multi Pass')}
                                    content={i18n._('Determines whether enabled multi pass.')}
                                >
                                    <input
                                        type="checkbox"
                                        checked={state.enableMultiPass}
                                        onChange={actions.onChangeEnabledMultiPass}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                {state.enableMultiPass &&
                <table>
                    <tbody>
                        <tr>
                            <td style={{ width: '100%' }}>
                                {i18n._('Pass Times')}
                            </td>
                            <td>
                                <TipTrigger
                                    placement="right"
                                    title={i18n._('Pass Times')}
                                    content={i18n._('Determines the times of laser multi pass.')}
                                >
                                    <Select
                                        style={{ width: '50px' }}
                                        clearable={false}
                                        options={[{
                                            value: '2',
                                            label: '2'
                                        }, {
                                            value: '3',
                                            label: '3'
                                        }, {
                                            value: '4',
                                            label: '4'
                                        }, {
                                            value: '5',
                                            label: '5'
                                        }]}
                                        value={state.passTimes}
                                        searchable={false}
                                        onChange={actions.onChangePassTimes}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                }
                {state.enableMultiPass &&
                <table style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '100%' }}>
                                {i18n._('Step Depth (mm)')}
                            </td>
                            <td>
                                <TipTrigger
                                    placement="right"
                                    title={i18n._('Step Depth')}
                                    content={i18n._('Determines the depth of multi pass per time.')}
                                >
                                    <Input
                                        style={{ width: '50px', float: 'right' }}
                                        min={0}
                                        max={5}
                                        value={state.stepDepth}
                                        onChange={actions.onChangeStepDepth}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                }
            </React.Fragment>
        );
    }
}

export default MultiPass;
