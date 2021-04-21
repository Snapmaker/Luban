import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';
import modal from '../../lib/modal';
import styles from './styles.styl';
import { HEAD_CNC, HEAD_LASER } from '../../constants';
import i18n from '../../lib/i18n';
import { actions as editorActions } from '../../flux/editor';
import { actions as cncActions } from '../../flux/cnc';
import Modal from '../../components/Modal';
import CncParameters from './cnc/CncParameters';
import { toHump } from '../../../shared/lib/utils';
import LaserParameters from './laser/LaserParameters';

class ToolPathConfigurations extends PureComponent {
    static propTypes = {
        headType: PropTypes.string.isRequired,

        toolDefinitions: PropTypes.array,
        activeToolListDefinition: PropTypes.object,

        updatingToolPath: PropTypes.object,

        duplicateToolListDefinition: PropTypes.func.isRequired,
        changeActiveToolListDefinition: PropTypes.func.isRequired,
        cancelUpdateToolPath: PropTypes.func.isRequired,
        saveToolPath: PropTypes.func.isRequired
    };

    state = {
        activeToolDefinition: null,
        toolPath: null
    };

    actions = {
        cancelUpdateToolPath: () => {
            this.props.cancelUpdateToolPath();
        },
        saveToolPath: () => {
            const toolParams = {};
            const gcodeConfig = {
                ...this.state.toolPath.gcodeConfig
            };

            if (this.state.activeToolDefinition) {
                toolParams.definitionId = this.props.activeToolListDefinition.definitionId;
                toolParams.definitionName = this.props.activeToolListDefinition.name;
                toolParams.toolDiameter = this.state.activeToolDefinition.config.diameter.default_value;
                toolParams.toolAngle = this.state.activeToolDefinition.config.angle.default_value;
                toolParams.toolShaftDiameter = this.state.activeToolDefinition.config.shaft_diameter.default_value;

                for (const key of Object.keys(this.state.activeToolDefinition.config)) {
                    if (['diameter', 'angle', 'shaft_diameter'].includes(key)) {
                        continue;
                    }
                    gcodeConfig[toHump(key)] = this.state.activeToolDefinition.config[key].default_value;
                }
            }

            const toolPath = {
                ...this.state.toolPath,
                gcodeConfig,
                toolParams
            };

            this.props.saveToolPath(toolPath);
        },

        updateToolPath: (option) => {
            this.setState({
                toolPath: {
                    ...this.state.toolPath,
                    ...option
                }
            });
        },
        updateToolConfig: (key, value) => {
            const newDefinition = _.cloneDeep(this.state.activeToolDefinition);
            newDefinition.config[key].default_value = value;
            this.setState({
                activeToolDefinition: newDefinition
            });
        },
        onDuplicateToolNameDefinition: async (inputValue) => {
            const activeToolCategory = this.props.toolDefinitions.find(d => d.definitionId === this.state.activeToolDefinition.definitionId) || this.props.toolDefinitions.find(d => d.definitionId === 'Default');
            const newToolDefinition = {
                ...this.state.activeToolDefinition,
                name: inputValue
            };
            await this.props.duplicateToolListDefinition(activeToolCategory, newToolDefinition);
            await this.props.changeActiveToolListDefinition(newToolDefinition.definitionId, newToolDefinition.name);
        },
        setCurrentValueAsProfile: () => {
            const activeToolDefinition = this.state.activeToolDefinition;
            const activeToolCategoryDefinition = this.props.toolDefinitions.find(d => d.definitionId === activeToolDefinition.definitionId);

            // make sure name is not repeated
            while (activeToolCategoryDefinition.toolList.find(d => d.name === activeToolDefinition.name)) {
                activeToolDefinition.name = `#${activeToolDefinition.name}`;
            }

            const popupActions = modal({
                title: i18n._('Create Profile'),
                body: (
                    <React.Fragment>
                        <p>{i18n._('Enter Tool Name')}</p>
                    </React.Fragment>

                ),
                defaultInputValue: activeToolDefinition.name,
                footer: (
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={async () => {
                            await this.actions.onDuplicateToolNameDefinition(popupActions.getInputValue());
                            popupActions.close();
                        }}
                    >
                        {i18n._('OK')}
                    </button>
                )
            });
        },
        updateGcodeConfig: (option) => {
            const nToolPath = {
                ...this.state.toolPath,
                gcodeConfig: {
                    ...this.state.toolPath.gcodeConfig,
                    ...option
                }
            };
            this.setState({
                toolPath: nToolPath
            });
        },
        updateCncActiveToolDefinition: async (updatingToolPath) => {
            const { toolParams } = updatingToolPath;
            const activeToolDefinition = this.props.activeToolListDefinition;
            await this.props.changeActiveToolListDefinition(toolParams.definitionId, toolParams.definitionName);
            this.setState({
                activeToolDefinition
            });
        }
    };

    componentWillMount() {
        this.state.activeToolDefinition = _.cloneDeep(this.props.activeToolListDefinition);
        this.state.toolPath = _.cloneDeep(this.props.updatingToolPath);
    }


    componentWillReceiveProps(nextProps) {
        if (nextProps.activeToolListDefinition !== this.props.activeToolListDefinition) {
            this.setState({
                activeToolDefinition: _.cloneDeep(nextProps.activeToolListDefinition)
            });
        }
        if (nextProps.updatingToolPath !== this.props.updatingToolPath) {
            const newToolPath = _.cloneDeep(nextProps.updatingToolPath);
            this.setState({
                toolPath: newToolPath
            });
            if (!_.isNull(nextProps.updatingToolPath) && nextProps.headType === HEAD_CNC) {
                this.actions.updateCncActiveToolDefinition(newToolPath);
            }
        }
    }

    checkIfDefinitionModified() {
        if (this.props.headType === HEAD_CNC) {
            const { activeToolDefinition } = this.state;
            const currentToolDefinition = this.props.activeToolListDefinition;
            return !Object.entries(currentToolDefinition.config).every(([key, setting]) => {
                return activeToolDefinition.config[key].default_value === setting.default_value;
            });
        } else {
            return false;
        }
    }

    render() {
        if (!this.state.toolPath) {
            return null;
        }
        // check if the definition in manager is modified
        const isModifiedDefinition = this.checkIfDefinitionModified();

        return (
            <React.Fragment>
                <Modal
                    className={classNames(styles['manager-body'])}
                    style={{ width: '468px', height: '660px', paddingBottom: '0px' }}
                    size="lg"
                    onClose={this.actions.cancelUpdateToolPath}
                >
                    <Modal.Header>
                        <Modal.Title>
                            {i18n._('Configurations')}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body style={{
                        overflowY: 'auto',
                        height: '546px'
                    }}
                    >
                        {this.props.headType === HEAD_CNC && (
                            <CncParameters
                                toolPath={this.state.toolPath}
                                toolDefinitions={this.props.toolDefinitions}
                                isModifiedDefinition={isModifiedDefinition}
                                activeToolDefinition={this.state.activeToolDefinition}
                                updateToolPath={this.actions.updateToolPath}
                                updateToolConfig={this.actions.updateToolConfig}
                                setCurrentValueAsProfile={this.actions.setCurrentValueAsProfile}
                                updateGcodeConfig={this.actions.updateGcodeConfig}
                            />
                        )}
                        {this.props.headType === HEAD_LASER && (
                            <LaserParameters
                                toolPath={this.state.toolPath}
                                updateToolPath={this.actions.updateToolPath}
                                updateGcodeConfig={this.actions.updateGcodeConfig}
                            />
                        )}
                    </Modal.Body>
                    <Modal.Footer style={{
                        bottom: '0px',
                        position: 'absolute',
                        width: '100%'
                    }}
                    >
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-default"
                            onClick={this.actions.cancelUpdateToolPath}
                        >
                            {i18n._('Cancel')}
                        </button>
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-primary"
                            onClick={this.actions.saveToolPath}
                        >
                            {i18n._('Save')}
                        </button>
                    </Modal.Footer>
                </Modal>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { page, toolDefinitions, activeToolListDefinition, updatingToolPath } = state[ownProps.headType];

    return {
        page,
        toolDefinitions,
        activeToolListDefinition,
        updatingToolPath
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        cancelUpdateToolPath: () => dispatch(editorActions.cancelUpdateToolPath(ownProps.headType)),
        duplicateToolListDefinition: (activeToolCategory, activeToolListDefinition) => dispatch(cncActions.duplicateToolListDefinition(activeToolCategory, activeToolListDefinition)),
        changeActiveToolListDefinition: (definitionId, name) => dispatch(cncActions.changeActiveToolListDefinition(definitionId, name)),
        saveToolPath: (toolPath) => dispatch(editorActions.saveToolPath(ownProps.headType, toolPath))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ToolPathConfigurations);
