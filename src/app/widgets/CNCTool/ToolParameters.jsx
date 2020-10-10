import _ from 'lodash';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import {
    CNC_TOOL_SNAP_V_BIT,
    CNC_TOOL_SNAP_V_BIT_CONFIG,
    CNC_TOOL_SNAP_FLAT_END_MILL,
    CNC_TOOL_SNAP_FLAT_END_MILL_CONFIG,
    CNC_TOOL_SNAP_BALL_END_MILL,
    CNC_TOOL_SNAP_BALL_END_MILL_CONFIG,
    CNC_TOOL_CUSTOM,
    CNC_TOOL_CUSTOM_CONFIG, PAGE_PROCESS
} from '../../constants';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import Anchor from '../../components/Anchor';
import TipTrigger from '../../components/TipTrigger';
import OptionalDropdown from '../../components/OptionalDropdown';
import { actions as cncActions } from '../../flux/cnc';
import { actions as editorActions } from '../../flux/editor';
import styles from './styles.styl';

class ToolParameters extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        // eslint-disable-next-line react/no-unused-prop-types
        setDisplay: PropTypes.func.isRequired,
        page: PropTypes.string.isRequired,

        toolSnap: PropTypes.string.isRequired,
        toolParams: PropTypes.object.isRequired,
        changeToolParams: PropTypes.func.isRequired,
        updateToolSnap: PropTypes.func.isRequired
    };

    state = {
        tool: CNC_TOOL_SNAP_V_BIT
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
            this.setState({ tool: tool });
            this.props.changeToolParams({
                toolDiameter: config.diameter,
                toolAngle: config.angle,
                toolShaftDiameter: config.shaftDiameter
            });
            this.props.updateToolSnap(tool);
        },
        onChangeToolDiameter: (toolDiameter) => {
            this.props.changeToolParams({ toolDiameter: toolDiameter });
        },
        onChangeToolAngle: (toolAngle) => {
            this.props.changeToolParams({ toolAngle: toolAngle });
        },
        onChangeToolShaftDiameter: (toolShaftDiameter) => {
            this.props.changeToolParams({ toolShaftDiameter });
        }
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Carving Tool'));
        this.props.setDisplay(props.page === PAGE_PROCESS);
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.toolSnap !== nextProps.toolSnap) {
            this.actions.onChangeTool(nextProps.toolSnap);
        }
        this.props.setDisplay(nextProps.page === PAGE_PROCESS);
    }

    render() {
        const state = { ...this.state, ...this.props.toolParams };
        const actions = this.actions;

        return (
            <React.Fragment>
                <div className={styles['select-tools']}>
                    <div className={styles['select-tool']}>
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
                        <span className={styles.selectToolText}>{i18n._('Carving V-Bit')}</span>
                    </div>
                    <div className={styles['select-tool']}>
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
                        <span className={styles.selectToolText}>{i18n._('Flat End Mill')}</span>
                    </div>
                    <div className={styles['select-tool']}>
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
                        <span className={styles['select-tool-text']}>{i18n._('Ball End Mill')}</span>
                    </div>
                </div>
                <OptionalDropdown
                    title={i18n._('Use Other Bit')}
                    onClick={() => actions.onChangeTool(CNC_TOOL_CUSTOM)}
                    hidden={state.tool !== CNC_TOOL_CUSTOM}
                >

                    <TipTrigger
                        title={i18n._('Cutting Diameter')}
                        content={(
                            <div>
                                <p>{i18n._('Enter the diameter of the widest part of the blade. Please note that it is not the shank diameter.')}
                                </p>
                                <p>{i18n._('For the carving bits that we provide, please enter the following value:')}</p>
                                <ul>
                                    <li><b>{i18n._('Carving V-Bit')}</b>: 0.1 mm</li>
                                    <li><b>{i18n._('Ball End Mill')}</b>: 3.175 mm</li>
                                    <li><b>{i18n._('Flat End Mill')}</b>: 1.5 mm</li>
                                </ul>
                            </div>
                        )}
                    >
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Cutting Diameter')}</span>
                            <Input
                                className="sm-parameter-row__input"
                                value={state.toolDiameter}
                                min={0.1}
                                max={10}
                                step={0.1}
                                onChange={actions.onChangeToolDiameter}
                            />
                            <span className="sm-parameter-row__input-unit">mm</span>
                        </div>
                    </TipTrigger>
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
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Point Angle')}</span>
                            <Input
                                className="sm-parameter-row__input"
                                value={state.toolAngle}
                                min={1}
                                max={180}
                                step={0.1}
                                onChange={actions.onChangeToolAngle}
                            />
                            <span className="sm-parameter-row__input-unit">°</span>
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('Shaft Diameter')}
                        content={(
                            <div>
                                <p>{i18n._('Enter the diameter of the widest part of the shank.')}
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
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Shaft Diameter')}</span>
                            <Input
                                className="sm-parameter-row__input"
                                value={state.toolShaftDiameter}
                                min={0.1}
                                max={10}
                                step={0.1}
                                onChange={actions.onChangeToolShaftDiameter}
                            />
                            <span className="sm-parameter-row__input-unit">mm</span>
                        </div>
                    </TipTrigger>
                </OptionalDropdown>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        page: state.cnc.page,
        toolParams: state.cnc.toolParams,
        toolSnap: state.cnc.toolSnap
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        changeToolParams: (params) => {
            dispatch(cncActions.changeToolParams(params));
            dispatch(editorActions.updateAllModelGcodeConfig('cnc', params));
        },
        updateToolSnap: (toolSnap) => {
            dispatch(editorActions.updateState('cnc', { toolSnap: toolSnap }));
        }
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ToolParameters);
