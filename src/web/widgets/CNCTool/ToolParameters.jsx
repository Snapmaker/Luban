import _ from 'lodash';
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import {
    CNC_TOOL_SNAP_V_BIT,
    CNC_TOOL_SNAP_V_BIT_CONFIG,
    CNC_TOOL_SNAP_FLAT_END_MILL,
    CNC_TOOL_SNAP_FLAT_END_MILL_CONFIG,
    CNC_TOOL_SNAP_BALL_END_MILL,
    CNC_TOOL_SNAP_BALL_END_MILL_CONFIG,
    CNC_TOOL_CUSTOM,
    CNC_TOOL_CUSTOM_CONFIG,
    ACTION_CHANGE_TOOL
} from '../../constants';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import Anchor from '../../components/Anchor';
import TipTrigger from '../../components/TipTrigger';
import OptionalDropdown from '../../components/OptionalDropdown';
import styles from './styles.styl';


class ToolParameters extends PureComponent {
    state = {
        tool: CNC_TOOL_SNAP_V_BIT,
        toolDiameter: 3.175, // tool diameter (mm)
        toolAngle: 30 // tool angle (in degree, defaults to 30° for V-Bit)
    };
    actions = {
        onChangeTool: (tool) => {
            if (!_.includes([CNC_TOOL_SNAP_V_BIT, CNC_TOOL_SNAP_FLAT_END_MILL, CNC_TOOL_SNAP_BALL_END_MILL, CNC_TOOL_CUSTOM], tool)) {
                return;
            }
            const map = {
                [CNC_TOOL_SNAP_V_BIT]: CNC_TOOL_SNAP_V_BIT_CONFIG,
                [CNC_TOOL_SNAP_FLAT_END_MILL]: CNC_TOOL_SNAP_FLAT_END_MILL_CONFIG,
                [CNC_TOOL_SNAP_BALL_END_MILL]: CNC_TOOL_SNAP_BALL_END_MILL_CONFIG,
                [CNC_TOOL_CUSTOM]: CNC_TOOL_CUSTOM_CONFIG
            };
            const config = map[tool];
            this.update({
                tool,
                toolDiameter: config.diameter,
                toolAngle: config.angle
            });
        },
        onChangeToolDiameter: (toolDiameter) => {
            this.update({ toolDiameter });
        },
        onChangeToolAngle: (toolAngle) => {
            this.setState({ toolAngle });
            pubsub.publish(ACTION_CHANGE_TOOL, { toolAngle });
        }
    };

    update(state) {
        this.setState(state);
        pubsub.publish(ACTION_CHANGE_TOOL, state);
    }

    render() {
        const state = this.state;
        const actions = this.actions;

        return (
            <React.Fragment>
                <div>
                    <div className={styles.selectTool}>
                        <Anchor
                            className={classNames(styles.selectToolBtn, { [styles.selected]: state.tool === CNC_TOOL_SNAP_V_BIT })}
                            onClick={() => actions.onChangeTool(CNC_TOOL_SNAP_V_BIT)}
                        >
                            <img
                                src="images/cnc/cnc-tool-v-bit-88x88.png"
                                role="presentation"
                                alt="V-Bit"
                            />
                        </Anchor>
                        <span className={styles.selectToolText}>Carving V-Bit</span>
                    </div>
                    <div className={styles.selectTool}>
                        <Anchor
                            className={classNames(styles.selectToolBtn, { [styles.selected]: state.tool === CNC_TOOL_SNAP_FLAT_END_MILL })}
                            onClick={() => actions.onChangeTool(CNC_TOOL_SNAP_FLAT_END_MILL)}
                        >
                            <img
                                src="images/cnc/cnc-tool-flat-end-mill-88x88.png"
                                role="presentation"
                                alt="Flat End Mill"
                            />
                        </Anchor>
                        <span className={styles.selectToolText}>Flat End Mill</span>
                    </div>
                    <div className={styles.selectTool} style={{ marginRight: '0' }}>
                        <Anchor
                            className={classNames(styles.selectToolBtn, { [styles.selected]: state.tool === CNC_TOOL_SNAP_BALL_END_MILL })}
                            onClick={() => actions.onChangeTool(CNC_TOOL_SNAP_BALL_END_MILL)}
                        >
                            <img
                                src="images/cnc/cnc-tool-ball-end-mill-88x88.png"
                                role="presentation"
                                alt="Ball End Mill"
                            />
                        </Anchor>
                        <span className={styles.selectToolText}>Ball End Mill</span>
                    </div>
                </div>
                <OptionalDropdown
                    title="Use Other Bit"
                    titleWidth="110px"
                    onClick={() => actions.onChangeTool(CNC_TOOL_CUSTOM)}
                    hidden={state.tool !== CNC_TOOL_CUSTOM}
                >
                    <table className={styles.parameterTable}>
                        <tbody>
                            <tr>
                                <td>
                                    Cutting Diameter
                                </td>
                                <td>
                                    <TipTrigger
                                        title={i18n._('Cutting Diameter')}
                                        content={(
                                            <div>
                                                <p>{i18n._('Enter the diameter of the widest part of the blade. Please note that it is not the shank diameter.')}
                                                </p>
                                                <p>{i18n._('For the carving bits that we provide, please enter the following value:')}</p>
                                                <ul>
                                                    <li><b>{i18n._('Carving V-Bit')}</b>: 3.175 mm</li>
                                                    <li><b>{i18n._('Ball End Mill')}</b>: 3.175 mm</li>
                                                    <li><b>{i18n._('Flat End Mill')}</b>: 3.175 mm</li>
                                                </ul>
                                            </div>
                                        )}
                                    >
                                        <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                            <Input
                                                style={{ width: '45%' }}
                                                value={state.toolDiameter}
                                                min={0.1}
                                                max={10}
                                                step={0.1}
                                                onChange={actions.onChangeToolDiameter}
                                            />
                                            <span className={styles.descriptionText} style={{ margin: '8px 0 6px 4px' }}>mm</span>
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
                                        title={i18n._('Point Angle')}
                                        content={(
                                            <div>
                                                <p>{i18n._('Enter the angle of the blade.')}</p>
                                                <p>{i18n._('For the carving bits that we provide, please enter the following value:')}</p>
                                                <ul>
                                                    <li><b>{i18n._('Carving V-Bit')}</b>: 30°</li>
                                                    <li><b>{i18n._('Ball End Mill')}</b>: 180°</li>
                                                    <li><b>{i18n._('Flat End Mill')}</b>: 180°</li>
                                                </ul>
                                            </div>
                                        )}
                                    >
                                        <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                            <Input
                                                style={{ width: '45%' }}
                                                value={state.toolAngle}
                                                min={1}
                                                max={180}
                                                step={0.1}
                                                onChange={actions.onChangeToolAngle}
                                            />
                                            <span className={styles.descriptionText} style={{ margin: '8px 0 6px 4px' }}>°</span>
                                        </div>
                                    </TipTrigger>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </OptionalDropdown>
            </React.Fragment>
        );
    }
}

export default ToolParameters;
