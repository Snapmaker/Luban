import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import api from '../../../api';
import i18n from '../../../lib/i18n';
// import log from '../../lib/log';
import Macro from './Macro';
import AddMacro from './AddMacro';
import EditMacro from './EditMacro';
import {
    MODAL_NONE,
    MODAL_ADD_MACRO,
    MODAL_EDIT_MACRO
} from '../../../constants';


class MacroWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        widgetActions: PropTypes.object.isRequired
    };

    state = {
        modalName: MODAL_NONE,
        modalParams: {},
        macros: []
    };

    actions = {
        openModal: (name = MODAL_NONE, params = {}) => {
            this.setState({
                modalName: name,
                modalParams: params
            });
        },
        closeModal: () => {
            this.setState({
                modalName: MODAL_NONE,
                modalParams: {}
            });
        },
        updateModal: (modal) => {
            this.setState({
                ...this.state.modal,
                modalName: modal.name,
                modalParams: modal.params
            });
        },
        addMacro: async ({ name, content, repeat }) => {
            try {
                await api.macros.create({ name, content, repeat });
                const res = await api.macros.fetch();
                const { records: macros } = res.body;
                this.setState({ macros: macros });
            } catch (err) {
                // Ignore error
            }
        },
        deleteMacro: async (id) => {
            try {
                let res;
                res = await api.macros.delete(id);
                res = await api.macros.fetch();
                const { records: macros } = res.body;
                this.setState({ macros: macros });
            } catch (err) {
                // Ignore error
            }
        },
        updateMacro: async (id, { name, content, repeat }) => {
            try {
                let res;
                res = await api.macros.update(id, { name, content, repeat });
                res = await api.macros.fetch();
                const { records: macros } = res.body;
                this.setState({ macros: macros });
            } catch (err) {
                // Ignore error
            }
        },
        openAddMacroModal: () => {
            this.actions.openModal(MODAL_ADD_MACRO);
        }
    };

    constructor(props) {
        super(props);
        this.props.widgetActions.setTitle(i18n._('Macro'));
        this.props.widgetActions.setControlButtons(
            [
                {
                    title: 'New Macro',
                    onClick: this.actions.openAddMacroModal,
                    className: 'fa fa-plus'
                },
                'SMMinimize',
                'SMDropdown'
            ]
        );
    }

    componentDidMount() {
        this.fetchMacros();
    }


    fetchMacros = async () => {
        try {
            const res = await api.macros.fetch();
            const { records: macros } = res.body;
            this.setState({ macros: macros });
        } catch (err) {
            // Ignore error
        }
    };

    render() {
        const { macros } = this.state;
        const modalName = this.state.modalName;

        return (
            <div>
                {modalName === MODAL_ADD_MACRO && (
                    <AddMacro
                        modalParams={this.state.modalParams}
                        addMacro={this.actions.addMacro}
                        closeModal={this.actions.closeModal}
                    />
                )}
                {modalName === MODAL_EDIT_MACRO && (
                    <EditMacro
                        modalParams={this.state.modalParams}
                        updateMacro={this.actions.updateMacro}
                        deleteMacro={this.actions.deleteMacro}
                        closeModal={this.actions.closeModal}
                    />
                )}
                <Macro
                    widgetId={this.props.widgetId}
                    macros={macros}
                    openModal={this.actions.openModal}
                    updateModal={this.actions.updateModal}
                />
            </div>
        );
    }
}

export default (MacroWidget);
