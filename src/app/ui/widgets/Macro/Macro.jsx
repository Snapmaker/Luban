import ensureArray from 'ensure-array';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import TipTrigger from '../../components/TipTrigger';
import SvgIcon from '../../components/SvgIcon';
import {
    CONNECTION_TYPE_WIFI,
    MODAL_RUN_MACRO,
    MODAL_EDIT_MACRO,
    WORKFLOW_STATE_IDLE, PROTOCOL_SCREEN
} from '../../../constants';
import api from '../../../api';
// import { Button } from '../../components/Buttons';
// import Space from '../../components/Space';
import { limitStringLength } from '../../../lib/normalize-range';
import i18n from '../../../lib/i18n';
import { actions as machineActions } from '../../../flux/machine';
import { actions as developToolsActions } from '../../../flux/develop-tools';

import styles from './index.styl';

const STATUS_IDLE = 'idle';

class Macro extends PureComponent {
    static propTypes = {
        macros: PropTypes.array,
        updateModal: PropTypes.func.isRequired,
        openModal: PropTypes.func.isRequired,
        dataSource: PropTypes.string.isRequired,

        // redux
        connectionType: PropTypes.string.isRequired,
        isConnected: PropTypes.bool.isRequired,
        workflowState: PropTypes.string.isRequired,
        workflowStatus: PropTypes.string.isRequired,
        executeGcode: PropTypes.func.isRequired,
        developToolsExecuteGcode: PropTypes.func.isRequired
    };

    state = {
        macros: []
    }

    actions = {
        executeGcode: (gcode) => {
            gcode = gcode.trim();
            if (this.props.dataSource === PROTOCOL_SCREEN) {
                this.props.developToolsExecuteGcode(gcode);
            } else {
                this.props.executeGcode(gcode);
            }
        },
        runMacro: (macro) => {
            api.macros.read(macro.id)
                .then((res) => {
                    const { id, name, content, repeat } = res.body;
                    const modal = {
                        name: MODAL_RUN_MACRO,
                        params: { id, name, content, repeat }
                    };
                    this.props.updateModal(modal);
                });
            let gcode = '';
            for (let i = 0; i < macro.repeat; i++) {
                gcode = gcode.concat(macro.content, '\n');
            }
            this.actions.executeGcode(gcode);
        },
        openEditMacroModal: (id) => {
            api.macros.read(id)
                .then((res) => {
                    const { name, content, repeat, isDefault } = res.body;
                    this.props.openModal(MODAL_EDIT_MACRO, { id: res.body.id, name, content, repeat, isDefault });
                });
        },
        canClick: () => {
            const { workflowState, workflowStatus, isConnected } = this.props;
            if (!isConnected) {
                return false;
            }

            if (workflowState !== WORKFLOW_STATE_IDLE && workflowStatus !== STATUS_IDLE) {
                return false;
            }
            return true;
        }
    };

    componentWillReceiveProps(nextProps) {
        if (nextProps.macros && Array.isArray(nextProps.macros)) {
            this.setState({
                macros: nextProps.macros
            });
        }
        // When connecting to wifi, some gcode is not implemented. Temporarily hide the default macro
        if (nextProps.connectionType === CONNECTION_TYPE_WIFI) {
            const macros = nextProps.macros.filter((item) => {
                return item.isDefault !== true;
            });
            this.setState({
                macros: macros
            });
        }
    }

    render() {
        const canClick = this.actions.canClick();
        const { macros } = this.state;

        return (
            <div className="padding-horizontal-16 height-176 padding-vertical-4
                overflow-y-auto border-default-grey-1 border-radius-8
                margin-bottom-16"
            >
                {macros.length === 0 && (
                    <div className={styles.emptyResult}>
                        {i18n._('No macros.')}
                    </div>
                )}
                {ensureArray(macros).map((macro) => (
                    <div
                        key={macro.id}
                        className={classNames(
                            'sm-flex',
                            'justify-space-between',
                            'height-24',
                            'margin-vertical-4'
                        )}
                    >
                        <TipTrigger
                            key={macro.id}
                            title={i18n._('Macro')}
                            content={macro.name}
                        >
                            <SvgIcon
                                name="StartPlay"
                                className="margin-right-4"
                                title={i18n._('Run Macro')}
                                disabled={!canClick}
                                onClick={() => {
                                    this.actions.runMacro(macro);
                                }}
                            />
                            {limitStringLength(macro.name, 30)}
                        </TipTrigger>
                        <SvgIcon
                            name="Edit"
                            onClick={() => {
                                this.actions.openEditMacroModal(macro.id);
                            }}
                        />
                    </div>
                ))}
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { workflowState, workflowStatus, isConnected, connectionType } = state.machine;
    const { dataSource } = state.widget.widgets[ownProps.widgetId];

    return {
        isConnected,
        connectionType,
        workflowState,
        workflowStatus,
        dataSource
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode)),
        developToolsExecuteGcode: (gcode) => dispatch(developToolsActions.executeGcode(gcode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Macro);
