import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';
import styles from './styles.styl';
import { HEAD_CNC, HEAD_LASER } from '../../constants';
import i18n from '../../lib/i18n';
import { actions as editorActions } from '../../flux/editor';
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
        updateGcodeConfig: (option) => {
            const nToolPath = {
                ...this.state.toolPath,
                gcodeConfig: {
                    ...this.state.toolPath.gcodeConfig,
                    ...option
                }
            };
            console.log('updateGcodeConfig', this.state.toolPath, nToolPath, option);
            this.setState({
                toolPath: nToolPath
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
            this.setState({
                toolPath: _.cloneDeep(nextProps.updatingToolPath)
            });
            console.log('componentWillReceiveProps', nextProps.updatingToolPath, _.cloneDeep(nextProps.updatingToolPath));
        }
    }

    render() {
        console.log(this.props.headType === HEAD_LASER, this.state.toolPath);
        if (!this.state.toolPath) {
            return null;
        }

        return (
            <React.Fragment>
                <Modal
                    className={classNames(styles['manager-body'])}
                    style={{ width: '360px', height: '614px' }}
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
                        height: '500px'
                    }}
                    >
                        {this.props.headType === HEAD_CNC && (
                            <CncParameters
                                toolPath={this.state.toolPath}
                                toolDefinitions={this.props.toolDefinitions}
                                activeToolDefinition={this.state.activeToolDefinition}
                                updateToolPath={this.actions.updateToolPath}
                                updateToolConfig={this.actions.updateToolConfig}
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
        saveToolPath: (toolPath) => dispatch(editorActions.saveToolPath(ownProps.headType, toolPath))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ToolPathConfigurations);
