import React, { PureComponent } from 'react';
import pubsub from 'pubsub-js';
import { ACTION_CHANGE_TOOL } from '../../constants';
import { InputWithValidation as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import styles from './styles.styl';


class ToolParameters extends PureComponent {
    state = {
        toolDiameter: 3.175, // tool diameter (mm)
        toolAngle: 30 // tool angle (in degree, defaults to 30° for V-Bit)
    };
    actions = {
        onChangeToolDiameter: (toolDiameter) => {
            this.setState({ toolDiameter });
            pubsub.publish(ACTION_CHANGE_TOOL, { toolDiameter });
            return true;
        },
        onChangeToolAngle: (toolAngle) => {
            this.setState({ toolAngle });
            pubsub.publish(ACTION_CHANGE_TOOL, { toolAngle });
            return true;
        }
    };

    render() {
        const state = this.state;
        const actions = this.actions;

        return (
            <React.Fragment>
                <table className={styles.parameterTable}>
                    <tbody>
                        <tr>
                            <td>
                                Cutting Diameter
                            </td>
                            <td>
                                <TipTrigger
                                    title="Cutting Diameter"
                                    content={(
                                        <div>
                                            <p>Enter the diameter of the widest part of the blade. Please note that it is not
                                               the shank diameter.
                                            </p>
                                            <p>For the carving bits that we provide, please enter the following value:</p>
                                            <ul>
                                                <li><b>Carving V-Bit</b>: 3.175 mm</li>
                                                <li><b>Ball End Mill</b>: 3.175 mm</li>
                                                <li><b>Flat End Mill</b>: 3.175 mm</li>
                                            </ul>
                                        </div>
                                    )}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            value={state.toolDiameter}
                                            min={0.1}
                                            max={10}
                                            step={0.1}
                                            onChange={actions.onChangeToolDiameter}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Point Angle
                            </td>
                            <td>
                                <TipTrigger
                                    title="Point Angle"
                                    content={(
                                        <div>
                                            <p>Enter the angle of the blade.</p>
                                            <p>For the carving bits that we provide, please enter the following value:</p>
                                            <ul>
                                                <li><b>Carving V-Bit</b>: 30°</li>
                                                <li><b>Ball End Mill</b>: 180°</li>
                                                <li><b>Flat End Mill</b>: 180°</li>
                                            </ul>
                                        </div>
                                    )}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            value={state.toolAngle}
                                            min={1}
                                            max={180}
                                            step={1}
                                            onChange={actions.onChangeToolAngle}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>°</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </React.Fragment>
        );
    }
}

export default ToolParameters;
