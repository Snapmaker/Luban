import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
// import classNames from 'classnames';
import { useSelector } from 'react-redux';
import api from '../../../api';
import i18n from '../../../lib/i18n';
import Macro from './Macro';
import AddMacro from './AddMacro';
import EditMacro from './EditMacro';
import {
    MODAL_NONE,
    MODAL_ADD_MACRO,
    MODAL_EDIT_MACRO
} from '../../../constants';
import useMountedState from '../../utils/useMountedState';


function MacroWidget({ widgetId, widgetActions }) {
    const [modalName, setModalName] = useState(MODAL_NONE);
    const [modalParams, setModalParams] = useState({});
    const [macros, setMacros] = useState([]);
    const isMounted = useMountedState();

    const { workflowStatus } = useSelector(state => state.workspace);

    const actions = {
        openModal: (name = MODAL_NONE, params = {}) => {
            setModalName(name);
            setModalParams(params);
        },
        closeModal: useCallback(() => {
            setModalName(MODAL_NONE);
            setModalParams({});
        }, []),
        updateModal: (modal) => {
            setModalName(modal.name);
            setModalParams(modal.params);
        },
        addMacro: useCallback(async ({ name, content, repeat }) => {
            try {
                await api.macros.create({ name, content, repeat });
                const res = await api.macros.fetch();
                setMacros(res.body.records);
            } catch (err) {
                // Ignore error
            }
        }, []),
        deleteMacro: useCallback(async (id) => {
            try {
                let res;
                res = await api.macros.delete(id);
                res = await api.macros.fetch();
                setMacros(res.body.records);
            } catch (err) {
                // Ignore error
            }
        }, []),
        updateMacro: useCallback(async (id, { name, content, repeat }) => {
            try {
                let res;
                res = await api.macros.update(id, { name, content, repeat });
                res = await api.macros.fetch();
                setMacros(res.body.records);
            } catch (err) {
                // Ignore error
            }
        }, []),
        openAddMacroModal: () => {
            actions.openModal(MODAL_ADD_MACRO);
        }
    };

    const fetchMacros = async () => {
        try {
            const res = await api.macros.fetch();
            if (isMounted()) {
                setMacros(res.body.records);
            }
        } catch (err) {
            // Ignore error
        }
    };

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/Macro-Macro'));
        widgetActions.setControlButtons(
            [
                {
                    title: 'New Macro',
                    onClick: actions.openAddMacroModal,
                    name: 'Increase',
                    type: ['static']
                },
                'SMMinimize',
                'SMDropdown'
            ]
        );
        fetchMacros();
    }, []);

    useEffect(() => {
        if (workflowStatus === 'running') {
            widgetActions.setDisplay(false);
        } else {
            widgetActions.setDisplay(true);
        }
    }, [widgetActions, workflowStatus]);

    return (
        <div>
            <Macro
                widgetId={widgetId}
                macros={macros}
                openModal={actions.openModal}
                updateModal={actions.updateModal}
            />
            {
                modalName === MODAL_ADD_MACRO && (
                    <AddMacro
                        modalParams={modalParams}
                        addMacro={actions.addMacro}
                        closeModal={actions.closeModal}
                    />
                )
            }
            {
                modalName === MODAL_EDIT_MACRO && (
                    <EditMacro
                        modalParams={modalParams}
                        updateMacro={actions.updateMacro}
                        deleteMacro={actions.deleteMacro}
                        closeModal={actions.closeModal}
                    />
                )
            }
        </div>
    );
}

MacroWidget.propTypes = {
    widgetId: PropTypes.string.isRequired,
    widgetActions: PropTypes.object.isRequired
};

export default (MacroWidget);
