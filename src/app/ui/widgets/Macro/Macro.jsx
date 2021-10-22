import ensureArray from 'ensure-array';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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

function Macro({ widgetId, updateModal, openModal, macros }) {
    const { workflowState, workflowStatus, isConnected, connectionType } = useSelector(state => state.machine);
    const { dataSource } = useSelector(state => state.widget.widgets[widgetId]);
    const [macrosState, setMacrosState] = useState([]);
    const dispatch = useDispatch();

    const actions = {
        executeGcode: (gcode) => {
            gcode = gcode.trim();
            if (dataSource === PROTOCOL_SCREEN) {
                dispatch(developToolsActions.executeGcode(gcode));
            } else {
                dispatch(machineActions.executeGcode(gcode));
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
                    updateModal(modal);
                });
            let gcode = '';
            for (let i = 0; i < macro.repeat; i++) {
                gcode = gcode.concat(macro.content, '\n');
            }
            actions.executeGcode(gcode);
        },
        openEditMacroModal: (id) => {
            api.macros.read(id)
                .then((res) => {
                    const { name, content, repeat, isDefault } = res.body;
                    openModal(MODAL_EDIT_MACRO, { id: res.body.id, name, content, repeat, isDefault });
                });
        },
        canClick: () => {
            if (!isConnected) {
                return false;
            }

            if (workflowState !== WORKFLOW_STATE_IDLE && workflowStatus !== STATUS_IDLE) {
                return false;
            }
            return true;
        }
    };

    useEffect(() => {
        if (macros && Array.isArray(macros)) {
            setMacrosState(macros);
        }
    }, [macros]);

    useEffect(() => {
        // When connecting to wifi, some gcode is not implemented. Temporarily hide the default macro
        if (connectionType === CONNECTION_TYPE_WIFI) {
            const _macros = macros.filter((item) => {
                return item.isDefault !== true;
            });
            setMacrosState(_macros);
        }
    }, [connectionType, macros]);

    const canClick = actions.canClick();
    return (
        <div className="padding-horizontal-16 height-176 padding-vertical-4
            overflow-y-auto border-default-grey-1 border-radius-8
            margin-bottom-16"
        >
            {macrosState.length === 0 && (
                <div className={styles.emptyResult}>
                    {i18n._('key-Workspace/Macro-No macros.')}
                </div>
            )}
            {ensureArray(macrosState).map((macro) => (
                <div
                    key={macro.id}
                    className={classNames(
                        'sm-flex',
                        'justify-space-between',
                        'height-32',
                        'margin-vertical-4'
                    )}
                >
                    <TipTrigger
                        key={macro.id}
                        title={i18n._('key-Workspace/Macro-Macro')}
                        content={macro.name}
                    >
                        <SvgIcon
                            name="StartPlay"
                            className="margin-right-4"
                            title={i18n._('key-Workspace/Macro-Run Macro')}
                            disabled={!canClick}
                            onClick={() => {
                                actions.runMacro(macro);
                            }}
                        />
                        {limitStringLength(macro.name, 30)}
                    </TipTrigger>
                    <SvgIcon
                        name="Edit"
                        onClick={() => {
                            actions.openEditMacroModal(macro.id);
                        }}
                    />
                </div>
            ))}
        </div>
    );
}
Macro.propTypes = {
    macros: PropTypes.array,
    updateModal: PropTypes.func.isRequired,
    openModal: PropTypes.func.isRequired,
    widgetId: PropTypes.string.isRequired
    // widgetActions: PropTypes.object.isRequired
};

export default Macro;
