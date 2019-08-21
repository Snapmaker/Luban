import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import api from '../../api';
import Space from '../../components/Space';
import Widget from '../../components/Widget';
import i18n from '../../lib/i18n';
// import log from '../../lib/log';
import { WidgetConfig } from '../../components/SMWidget';
import Macro from './Macro';
import AddMacro from './AddMacro';
import EditMacro from './EditMacro';
import {
    MODAL_NONE,
    MODAL_ADD_MACRO,
    MODAL_EDIT_MACRO
} from '../../constants';
import styles from './index.styl';


class MacroWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        sortable: PropTypes.object
    };

    config = new WidgetConfig(this.props.widgetId);

    state = {
        minimized: this.config.get('minimized', false),
        isFullscreen: false,
        modalName: MODAL_NONE,
        modalParams: {},
        macros: []
    };

    actions = {
        toggleFullscreen: () => {
            const { minimized, isFullscreen } = this.state;
            this.setState({
                minimized: isFullscreen ? minimized : false,
                isFullscreen: !isFullscreen
            });
        },
        toggleMinimized: () => {
            const { minimized } = this.state;
            this.setState({ minimized: !minimized });
        },
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
                let res;
                res = await api.macros.create({ name, content, repeat });
                res = await api.macros.fetch();
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

    componentDidMount() {
        this.fetchMacros();
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.minized !== this.state.minized) {
            const {
                minimized
            } = this.state;
            this.config.set('minimized', minimized);
        }
    }

    // Public methods
    expand = () => {
        this.setState({ minimized: false });
    };

    collapse = () => {
        this.setState({ minimized: true });
    };

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
        const { minimized, isFullscreen, macros } = this.state;
        const modalName = this.state.modalName;

        return (
            <Widget fullscreen={isFullscreen}>
                <Widget.Header>
                    <Widget.Title>
                        <Widget.Sortable className={this.props.sortable.handleClassName}>
                            <i className="fa fa-bars" />
                            <Space width="8" />
                        </Widget.Sortable>
                        {i18n._('Macro')}
                    </Widget.Title>
                    <Widget.Controls className={this.props.sortable.filterClassName}>
                        <Widget.Button
                            title={i18n._('New Macro')}
                            onClick={this.actions.openAddMacroModal}
                        >
                            <i className="fa fa-plus" />
                        </Widget.Button>
                        <Widget.Button
                            disabled={isFullscreen}
                            title={minimized ? i18n._('Expand') : i18n._('Collapse')}
                            onClick={this.actions.toggleMinimized}
                        >
                            <i
                                className={classNames(
                                    'fa',
                                    { 'fa-chevron-up': !minimized },
                                    { 'fa-chevron-down': minimized }
                                )}
                            />
                        </Widget.Button>
                        <Widget.DropdownButton
                            title={i18n._('More')}
                            toggle={<i className="fa fa-ellipsis-v" />}
                            onSelect={(eventKey) => {
                                if (eventKey === 'fullscreen') {
                                    this.actions.toggleFullscreen();
                                }
                            }}
                        >
                            <Widget.DropdownMenuItem eventKey="fullscreen">
                                <i
                                    className={classNames(
                                        'fa',
                                        'fa-fw',
                                        { 'fa-expand': !isFullscreen },
                                        { 'fa-compress': isFullscreen }
                                    )}
                                />
                                <Space width="4" />
                                {!isFullscreen ? i18n._('Enter Full Screen') : i18n._('Exit Full Screen')}
                            </Widget.DropdownMenuItem>
                        </Widget.DropdownButton>
                    </Widget.Controls>
                </Widget.Header>
                <Widget.Content
                    className={classNames(
                        styles['widget-content'],
                        { [styles.hidden]: minimized }
                    )}
                >
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
                        macros={macros}
                        openModal={this.actions.openModal}
                        updateModal={this.actions.updateModal}
                    />
                </Widget.Content>
            </Widget>
        );
    }
}

export default MacroWidget;
