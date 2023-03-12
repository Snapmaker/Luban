import ensureArray from 'ensure-array';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import TipTrigger from '../../components/TipTrigger';
import SvgIcon from '../../components/SvgIcon';
import {
    MODAL_RUN_MACRO,
    MODAL_EDIT_MACRO,
} from '../../../constants';
import api from '../../../api';
// import { Button } from '../../components/Buttons';
// import Space from '../../components/Space';
import i18n from '../../../lib/i18n';
import { actions as workspaceActions } from '../../../flux/workspace';

import styles from './index.styl';

const STATUS_IDLE = 'idle';

const Macro = (({ updateModal, openModal, macros }) => {
    const { isConnected } = useSelector(state => state.workspace);

    const { workflowStatus } = useSelector(state => state.workspace);

    const [macrosState, setMacrosState] = useState([]);
    const dispatch = useDispatch();

    const actions = {
        executeGcode: (gcode) => {
            gcode = gcode.trim();
            dispatch(workspaceActions.executeGcode(gcode));
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

            if (workflowStatus !== STATUS_IDLE) {
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
    const canClick = actions.canClick();
    return (
        <div className="padding-horizontal-16 height-176 padding-vertical-4
            overflow-y-auto border-default-grey-1 border-radius-8"
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
                        className={classNames('sm-flex')}
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
                        <span className="text-overflow-ellipsis">{macro.name}</span>
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
});
Macro.propTypes = {
    macros: PropTypes.array,
    updateModal: PropTypes.func.isRequired,
    openModal: PropTypes.func.isRequired,
    // widgetActions: PropTypes.object.isRequired
};

export default Macro;
