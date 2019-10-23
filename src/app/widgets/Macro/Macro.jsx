import ensureArray from 'ensure-array';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import _ from 'lodash';
import api from '../../api';
import { Button } from '../../components/Buttons';
import Space from '../../components/Space';
import i18n from '../../lib/i18n';
import { actions as machineActions } from '../../flux/machine';
import {
    MODAL_RUN_MACRO,
    MODAL_EDIT_MACRO,
    WORKFLOW_STATE_IDLE
} from '../../constants';
import styles from './index.styl';

const STATUS_IDLE = 'idle';

class Macro extends PureComponent {
    static propTypes = {
        macros: PropTypes.array,
        updateModal: PropTypes.func.isRequired,
        openModal: PropTypes.func.isRequired,
        dataSource: PropTypes.string.isRequired,

        // redux
        port: PropTypes.string.isRequired,
        server: PropTypes.object.isRequired,
        workState: PropTypes.string.isRequired,
        serverStatus: PropTypes.string.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    actions = {
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
            this.props.executeGcode(this.props.dataSource, gcode);
        },
        openEditMacroModal: (id) => {
            api.macros.read(id)
                .then((res) => {
                    const { name, content, repeat } = res.body;
                    this.props.openModal(MODAL_EDIT_MACRO, { id: res.body.id, name, content, repeat });
                });
        },
        canClick: () => {
            const { port, server, workState, serverStatus } = this.props;
            if (!port && _.isEmpty(server)) {
                return false;
            }

            if (workState !== WORKFLOW_STATE_IDLE && serverStatus !== STATUS_IDLE) {
                return false;
            }
            return true;
        }
    };


    render() {
        const { macros } = this.props;
        const canClick = this.actions.canClick();

        return (
            <div>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <tbody>
                            {macros.length === 0 && (
                                <tr>
                                    <td colSpan="2">
                                        <div className={styles.emptyResult}>
                                            {i18n._('No macros')}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {ensureArray(macros).map((macro) => (
                                <tr key={macro.id}>
                                    <td style={{ padding: '6px 0px' }}>
                                        <Button
                                            compact
                                            btnSize="xs"
                                            btnStyle="flat"
                                            disabled={!canClick}
                                            onClick={() => {
                                                this.actions.runMacro(macro);
                                            }}
                                            title={i18n._('Run Macro')}
                                        >
                                            <i className="fa fa-play" />
                                        </Button>
                                        <Space width="8" />
                                        {macro.name}
                                    </td>
                                    <td style={{ width: '1%' }}>
                                        <div className="nowrap">
                                            <Button
                                                compact
                                                btnSize="xs"
                                                btnStyle="flat"
                                                onClick={() => {
                                                    this.actions.openEditMacroModal(macro.id);
                                                }}
                                            >
                                                <i className="fa fa-edit" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { port, server, workState, serverStatus } = state.machine;
    const { widgets } = state.widget;
    const { widgetId } = ownProps;
    const dataSource = widgets[widgetId].dataSource;

    return {
        port,
        server,
        workState,
        serverStatus,
        dataSource
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (dataSource, gcode) => dispatch(machineActions.executeGcode(dataSource, gcode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Macro);
