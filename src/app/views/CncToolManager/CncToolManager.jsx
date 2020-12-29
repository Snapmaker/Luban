import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { includes } from 'lodash';
import Notifications from '../../components/Notifications';
import i18n from '../../lib/i18n';
import Modal from '../../components/Modal';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions as cncActions } from '../../flux/cnc';
import { actions as projectActions } from '../../flux/project';
import widgetStyles from '../../widgets/styles.styl';
import styles from './styles.styl';
import confirm from '../../lib/confirm';

const SUBCATEGORY = 'CncConfig';

function isOfficialListDefinition(activeToolList) {
    return includes(['Default'],
        activeToolList.definitionId)
            && includes(['snap.v-bit',
                'snap.flat-end-mill',
                'snap.ball-end-mill',
                'snap.straight-flute-sharp'],
            activeToolList.name);
}

function isOfficialCategoryDefinition(activeToolCategory) {
    return includes(['Default'],
        activeToolCategory.definitionId);
}
class PrintingManager extends PureComponent {
    static propTypes = {
        showCncToolManager: PropTypes.bool,
        toolDefinitions: PropTypes.array.isRequired,
        duplicateToolCategoryDefinition: PropTypes.func.isRequired,
        duplicateToolListDefinition: PropTypes.func.isRequired,

        updateToolListDefinition: PropTypes.func.isRequired,
        updateToolDefinitionName: PropTypes.func.isRequired,
        removeToolCategoryDefinition: PropTypes.func.isRequired,
        removeToolListDefinition: PropTypes.func.isRequired,
        onUploadToolDefinition: PropTypes.func.isRequired,

        exportConfigFile: PropTypes.func.isRequired,

        updateShowCncToolManager: PropTypes.func.isRequired
    };

    toolFileInput = React.createRef();

    state = {
        showCncToolManager: false,
        nameForToolList: 'snap.v-bit',

        activeToolListDefinition: null,
        activeToolCategory: null,

        isCategorySelected: false,
        notificationMessage: ''
    };

    actions = {
        hidePrintingManager: () => {
            this.props.updateShowCncToolManager(false);
        },
        showNotification: (msg) => {
            this.setState({
                notificationMessage: msg
            });
        },
        clearNotification: () => {
            this.setState({
                notificationMessage: ''
            });
        },
        onChangeToolCategoryName: (event) => {
            const { activeToolCategory } = this.state;
            this.setState({
                activeToolCategory: {
                    ...activeToolCategory,
                    category: event.target.value
                }
            });
        },
        onChangeToolListName: (event) => {
            this.setState({
                nameForToolList: event.target.value
            });
        },
        onChangeToolFileForManager: (event) => {
            const toolFile = event.target.files[0];
            this.props.onUploadToolDefinition(toolFile);
        },
        importFile: () => {
            this.toolFileInput.current.value = null;
            this.toolFileInput.current.click();
        },
        exportConfigFile: () => {
            const { activeToolCategory } = this.state;
            const definitionId = activeToolCategory.definitionId;
            const targetFile = `${definitionId}.def.json`;
            this.props.exportConfigFile(targetFile, SUBCATEGORY);
        },
        onChangeToolDefinition: (key, value) => {
            const { activeToolListDefinition } = this.state;
            const newActiveToolListDefinition = JSON.parse(JSON.stringify(activeToolListDefinition));
            newActiveToolListDefinition.config[key].default_value = value;

            this.setState({
                activeToolListDefinition: newActiveToolListDefinition
            });
        },
        onSaveToolCategory: async () => {
            const { activeToolCategory, isCategorySelected } = this.state;
            const definitionId = activeToolCategory.definitionId;
            const oldCategory = this.props.toolDefinitions.find(d => d.definitionId === definitionId);
            if (oldCategory.category !== activeToolCategory.category) { // unchanged
                try {
                    await this.props.updateToolDefinitionName(isCategorySelected, definitionId, oldCategory.category, activeToolCategory.category);
                } catch (err) {
                    this.actions.showNotification(err);
                }
            }
        },

        onSaveToolList: async () => {
            const { activeToolListDefinition, isCategorySelected, nameForToolList } = this.state;
            const definitionId = activeToolListDefinition.definitionId;
            const oldCategory = this.props.toolDefinitions.find(d => d.definitionId === definitionId);
            const oldToolList = oldCategory.toolList.find(d => d.name === activeToolListDefinition.name);
            await this.props.updateToolListDefinition(activeToolListDefinition);
            if (oldToolList.name !== nameForToolList) { // unchanged
                try {
                    await this.props.updateToolDefinitionName(isCategorySelected, definitionId, oldToolList.name, nameForToolList);
                } catch (err) {
                    this.actions.showNotification(err);
                }
            }
        },
        isNameSelectedNow: (definitionId, name) => {
            return this.state.activeToolListDefinition && this.state.activeToolListDefinition.name === name && this.state.activeToolListDefinition.definitionId === definitionId;
        },
        isCategorySelectedNow: (definitionId) => {
            return this.state.activeToolCategory && this.state.activeToolCategory.definitionId === definitionId;
        },
        onSelectToolCategory: (definitionId) => {
            const activeToolCategory = this.props.toolDefinitions.find(d => d.definitionId === definitionId);
            const name = this.state.activeToolListDefinition.name;
            const toolDefinitionForManager = activeToolCategory.toolList.find(k => k.name === name)
             || activeToolCategory.toolList.find(k => k.name === 'snap.v-bit');
            if (toolDefinitionForManager) {
                toolDefinitionForManager.definitionId = activeToolCategory.definitionId;
                this.setState({ activeToolListDefinition: toolDefinitionForManager });
            }
            this.setState({
                activeToolCategory: activeToolCategory,
                isCategorySelected: true
            });
        },
        onSelectToolName: (definitionId, name) => {
            const activeToolCategory = this.props.toolDefinitions.find(d => d.definitionId === definitionId);
            const toolDefinitionForManager = activeToolCategory.toolList.find(k => k.name === name);
            toolDefinitionForManager.definitionId = activeToolCategory.definitionId;
            if (toolDefinitionForManager) {
                this.setState({
                    activeToolListDefinition: toolDefinitionForManager,
                    activeToolCategory: activeToolCategory,
                    nameForToolList: toolDefinitionForManager.name,
                    isCategorySelected: false
                });
            }
        },
        onDuplicateToolCategoryDefinition: async () => {
            const newDefinition = await this.props.duplicateToolCategoryDefinition(this.state.activeToolCategory);
            this.actions.onSelectToolCategory(newDefinition.definitionId);
        },
        onDuplicateToolNameDefinition: async () => {
            const newToolName = await this.props.duplicateToolListDefinition(this.state.activeToolCategory, this.state.activeToolListDefinition);
            // need to change ,update activeToolListDefinition
            this.actions.onSelectToolName(this.state.activeToolCategory.definitionId, newToolName);
        },
        onRemoveToolDefinition: async () => {
            const { isCategorySelected, activeToolCategory } = this.state;
            if (isCategorySelected) {
                await confirm({
                    body: `Are you sure to remove category profile "${activeToolCategory.category}"?`
                });

                await this.props.removeToolCategoryDefinition(activeToolCategory.definitionId);
            } else {
                const activeToolListDefinition = this.state.activeToolListDefinition;

                await confirm({
                    body: `Are you sure to remove profile "${activeToolListDefinition.name}"?`
                });

                await this.props.removeToolListDefinition(activeToolCategory, activeToolListDefinition);
            }

            // After removal, select the first definition
            if (this.props.toolDefinitions.length) {
                if (activeToolCategory) {
                    this.actions.onSelectToolCategory(activeToolCategory.definitionId);
                } else {
                    this.actions.onSelectToolCategory(this.props.toolDefinitions[0].definitionId);
                }
            }
        }
    };

    componentWillReceiveProps(nextProps) {
        if (nextProps.showCncToolManager !== this.props.showCncToolManager) {
            this.setState({ showCncToolManager: nextProps.showCncToolManager });
        }
        // Load 'toolDefinitions' and compose the content of the manager
        if (nextProps.toolDefinitions !== this.props.toolDefinitions) {
            const newState = {};
            if (this.props.toolDefinitions.length === 0) {
                const activeToolCategory = nextProps.toolDefinitions.find(d => d.definitionId === 'Default');
                const activeToolListDefinition = activeToolCategory.toolList.find(k => k.name === 'snap.v-bit');
                activeToolListDefinition.definitionId = activeToolCategory && activeToolCategory.definitionId;
                Object.assign(newState, {
                    activeToolCategory,
                    activeToolListDefinition
                });
            } else {
                const activeToolCategory = nextProps.toolDefinitions.find(d => d.definitionId === this.state.activeToolListDefinition.definitionId) || nextProps.toolDefinitions.find(d => d.definitionId === 'Default');
                const activeToolListDefinition = activeToolCategory.toolList.find(k => k.name === this.state.activeToolListDefinition.name)
                || activeToolCategory.toolList.find(k => k.name === 'snap.v-bit');
                if (activeToolListDefinition) {
                    activeToolListDefinition.definitionId = activeToolCategory && activeToolCategory.definitionId;
                    Object.assign(newState, {
                        activeToolCategory,
                        activeToolListDefinition
                    });
                }
            }
            const toolDefinitionOptions = nextProps.toolDefinitions.map(d => {
                const checkboxAndSelectGroup = {};
                const category = d.category;
                const definitionId = d.definitionId;
                const nameArray = [];
                d.toolList.forEach((item) => {
                    nameArray.push(item.name);
                });
                checkboxAndSelectGroup.category = category;
                checkboxAndSelectGroup.definitionId = definitionId;
                checkboxAndSelectGroup.nameArray = nameArray;
                return checkboxAndSelectGroup;
            });
            Object.assign(newState, {
                toolDefinitionOptions: toolDefinitionOptions
            });
            this.setState(newState);
        }
    }

    render() {
        const state = this.state;
        const actions = this.actions;
        const { showCncToolManager,
            activeToolListDefinition, toolDefinitionOptions, isCategorySelected, activeToolCategory } = state;

        return (
            <React.Fragment>
                {showCncToolManager && (
                    <Modal
                        className={classNames(styles['manager-body'])}
                        style={{ width: '700px' }}
                        size="lg"
                        onClose={actions.hidePrintingManager}
                    >
                        <Modal.Body
                            style={{ margin: '0', padding: '20px 0 0', height: '100%', minHeight: '525px', textAlign: 'center' }}
                        >
                            <div className={classNames(styles['manager-type-wrapper'])}>
                                <div
                                    className={classNames(styles['manager-type'])}
                                >
                                    {i18n._('Tool')}
                                </div>
                            </div>
                            <div
                                className={classNames(styles['manager-content'])}
                            >
                                <div className={classNames(styles['manager-name'])}>
                                    <ul className={classNames(styles['manager-name-wrapper'])}>
                                        {(toolDefinitionOptions.map((option) => {
                                            return (
                                                <li key={`${option.definitionId}`}>
                                                    <Anchor
                                                        className={classNames(styles['manager-btn'], { [styles.selected]: isCategorySelected && this.actions.isCategorySelectedNow(option.definitionId) })}
                                                        onClick={() => this.actions.onSelectToolCategory(option.definitionId)}
                                                    >
                                                        {i18n._(option.category)}
                                                    </Anchor>
                                                    <ul style={{ listStyle: 'none' }}>
                                                        { option.nameArray.map(singleName => {
                                                            return (
                                                                <li key={`${singleName}`}>
                                                                    <Anchor
                                                                        className={classNames(styles['manager-btn'], { [styles.selected]: !isCategorySelected && this.actions.isNameSelectedNow(option.definitionId, singleName) })}
                                                                        onClick={() => this.actions.onSelectToolName(option.definitionId, singleName)}
                                                                    >
                                                                        {i18n._(singleName)}
                                                                    </Anchor>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </li>
                                            );
                                        }))}
                                    </ul>
                                    <input
                                        ref={this.toolFileInput}
                                        type="file"
                                        accept=".json"
                                        style={{ display: 'none' }}
                                        multiple={false}
                                        onChange={this.actions.onChangeToolFileForManager}
                                    />
                                    <div className="sm-tabs">
                                        <Anchor
                                            onClick={() => this.actions.importFile()}
                                            className={classNames(styles['manager-file'], 'sm-tab')}
                                        >
                                            {i18n._('Import')}
                                        </Anchor>
                                        <Anchor
                                            className={classNames(styles['manager-file'], 'sm-tab')}
                                            onClick={() => this.actions.exportConfigFile()}
                                        >
                                            {i18n._('Export')}
                                        </Anchor>
                                    </div>
                                </div>
                                <div className={classNames(styles['manager-details'])}>
                                    <div className="sm-parameter-container">
                                        <div className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])} />
                                        <div className="sm-parameter-row">
                                            <span className="sm-parameter-row__label-lg">{i18n._('Name')}</span>
                                            {!isCategorySelected && (
                                                <input
                                                    className="sm-parameter-row__input"
                                                    style={{ paddingLeft: '12px', height: '30px', width: '180px' }}
                                                    onChange={actions.onChangeToolListName}
                                                    disabled={isOfficialListDefinition(activeToolListDefinition)}
                                                    value={state.nameForToolList}
                                                />
                                            )}
                                            {isCategorySelected && (
                                                <input
                                                    className="sm-parameter-row__input"
                                                    onChange={actions.onChangeToolCategoryName}
                                                    disabled={isOfficialCategoryDefinition(activeToolCategory)}
                                                    style={{ paddingLeft: '12px', height: '30px', width: '180px' }}
                                                    value={activeToolCategory.category}
                                                />
                                            )}
                                        </div>
                                        {state.notificationMessage && (
                                            <Notifications bsStyle="danger" onDismiss={actions.clearNotification} className="Notifications">
                                                {state.notificationMessage}
                                            </Notifications>
                                        )}
                                        {!isCategorySelected && (Object.entries(activeToolListDefinition.config).map(([key, setting]) => {
                                            const defaultValue = setting.default_value;
                                            const label = setting.label;
                                            const unit = setting.unit;
                                            const min = setting.min || 0;
                                            const max = setting.max || 6000;

                                            return (
                                                <div key={key} className="sm-parameter-row">

                                                    <TipTrigger>
                                                        <span className="sm-parameter-row__label-lg">{i18n._(label)}</span>
                                                        <Input
                                                            className="sm-parameter-row__input"
                                                            value={defaultValue}
                                                            min={min}
                                                            max={max}
                                                            onChange={value => {
                                                                this.actions.onChangeToolDefinition(key, value);
                                                            }}
                                                            disabled={isOfficialListDefinition(activeToolListDefinition)}
                                                        />
                                                        <span className="sm-parameter-row__input-unit">{unit}</span>
                                                    </TipTrigger>
                                                </div>
                                            );
                                        }))}
                                    </div>
                                </div>
                            </div>
                            <div className={classNames(styles['manager-settings'], 'clearfix')}>
                                <div className={classNames(styles['manager-settings-operate'], styles['manager-settings-btn'])}>
                                    {isCategorySelected && (
                                        <Anchor
                                            className="sm-btn-large sm-btn-default"
                                            onClick={() => { actions.onDuplicateToolCategoryDefinition(); }}
                                            style={{ marginRight: '11px' }}
                                        >
                                            {i18n._('Copy Catalog')}
                                        </Anchor>
                                    )}
                                    {!isCategorySelected && (
                                        <Anchor
                                            className="sm-btn-large sm-btn-default"
                                            onClick={() => { actions.onDuplicateToolNameDefinition(); }}
                                            style={{ marginRight: '11px' }}
                                        >
                                            {i18n._('Copy Profile')}
                                        </Anchor>
                                    )}
                                    {isCategorySelected && (
                                        <Anchor
                                            className="sm-btn-large sm-btn-default"
                                            onClick={() => { actions.onRemoveToolDefinition(); }}
                                            disabled={isOfficialCategoryDefinition(activeToolCategory)}
                                        >
                                            {i18n._('Delete Catalog')}
                                        </Anchor>
                                    )}
                                    {!isCategorySelected && (
                                        <Anchor
                                            className="sm-btn-large sm-btn-default"
                                            onClick={() => { actions.onRemoveToolDefinition(); }}
                                            disabled={isOfficialListDefinition(activeToolListDefinition)}
                                        >
                                            {i18n._('Delete Profile')}
                                        </Anchor>
                                    )}
                                </div>
                                <div className={classNames(styles['manager-settings-save'], styles['manager-settings-btn'])}>
                                    <Anchor
                                        onClick={() => { actions.hidePrintingManager(); }}
                                        className="sm-btn-large sm-btn-default"
                                        style={{ marginRight: '11px' }}
                                    >
                                        {i18n._('Close')}
                                    </Anchor>
                                    {isCategorySelected && (
                                        <Anchor
                                            onClick={() => { actions.onSaveToolCategory(); }}
                                            className="sm-btn-large sm-btn-primary"
                                            disabled={isOfficialCategoryDefinition(activeToolCategory)}
                                        >
                                            {i18n._('Save')}
                                        </Anchor>
                                    )}
                                    {!isCategorySelected && (
                                        <Anchor
                                            onClick={() => { actions.onSaveToolList(); }}
                                            className="sm-btn-large sm-btn-primary"
                                            disabled={isOfficialListDefinition(activeToolListDefinition)}
                                        >
                                            {i18n._('Save')}
                                        </Anchor>
                                    )}
                                </div>
                            </div>
                        </Modal.Body>
                    </Modal>
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { showCncToolManager, toolDefinitions, activeToolListDefinition } = state.cnc;
    return {
        showCncToolManager,
        toolDefinitions,
        activeToolListDefinition
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateShowCncToolManager: (showCncToolManager) => dispatch(cncActions.updateShowCncToolManager(showCncToolManager)),
        duplicateToolCategoryDefinition: (activeToolCategory) => dispatch(cncActions.duplicateToolCategoryDefinition(activeToolCategory)),
        duplicateToolListDefinition: (activeToolCategory, activeToolListDefinition) => dispatch(cncActions.duplicateToolListDefinition(activeToolCategory, activeToolListDefinition)),
        removeToolCategoryDefinition: (definitionId) => dispatch(cncActions.removeToolCategoryDefinition(definitionId)),
        removeToolListDefinition: (activeToolCategory, activeToolList) => dispatch(cncActions.removeToolListDefinition(activeToolCategory, activeToolList)),
        exportConfigFile: (targetFile, subCategory) => dispatch(projectActions.exportConfigFile(targetFile, subCategory)),
        onUploadToolDefinition: (toolFile) => dispatch(cncActions.onUploadToolDefinition(toolFile)),
        onDownloadToolListDefinition: (activeToolCategory, activeToolList) => dispatch(cncActions.onDownloadToolListDefinition(activeToolCategory, activeToolList)),
        updateToolDefinitionName: (isCategorySelected, definitionId, oldName, newName) => dispatch(cncActions.updateToolDefinitionName(isCategorySelected, definitionId, oldName, newName)),
        updateToolListDefinition: (activeToolList) => dispatch(cncActions.updateToolListDefinition(activeToolList))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(PrintingManager);
