import React, { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { noop } from 'lodash';
import { connect } from 'react-redux';
import { actions as workspaceActions } from '../../../flux/workspace';
import { actions as editorActions } from '../../../flux/editor';
import { actions as projectActions } from '../../../flux/project';
import {
    DISPLAYED_TYPE_TOOLPATH, PAGE_PROCESS
} from '../../../constants';

import modal from '../../../lib/modal';
import { Button } from '../../components/Buttons';
import Dropdown from '../../components/Dropdown';
import Menu from '../../components/Menu';
import { renderPopup } from '../../utils';
import styles from './styles.styl';
import Workspace from '../../pages/Workspace';
import i18n from '../../../lib/i18n';
import UniApi from '../../../lib/uni-api';
import Thumbnail from '../CncLaserShared/Thumbnail';


class Output extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes,
        // autoPreviewEnabled: PropTypes.bool.isRequired,

        // page: PropTypes.string.isRequired,
        inProgress: PropTypes.bool.isRequired,

        modelGroup: PropTypes.object.isRequired,
        toolPathGroup: PropTypes.object.isRequired,
        canGenerateGcode: PropTypes.bool.isRequired,
        hasModel: PropTypes.bool,
        hasToolPathModel: PropTypes.bool,
        displayedType: PropTypes.string.isRequired,
        previewFailed: PropTypes.bool.isRequired,
        isGcodeGenerating: PropTypes.bool.isRequired,
        workflowState: PropTypes.string.isRequired,
        gcodeFile: PropTypes.object,
        commitGenerateGcode: PropTypes.func.isRequired,
        commitGenerateViewPath: PropTypes.func.isRequired,
        renderGcodeFile: PropTypes.func.isRequired,
        createToolPath: PropTypes.func.isRequired,
        exportFile: PropTypes.func.isRequired,
        switchToPage: PropTypes.func.isRequired,
        showToolPathGroupObject: PropTypes.func.isRequired,
        showModelGroupObject: PropTypes.func.isRequired,
        setAutoPreview: PropTypes.func.isRequired,
        preview: PropTypes.func.isRequired
    };

    state= { showWorkspace: false, showExportOptions: false }

    thumbnail = React.createRef();

    actions = {
        switchToEditPage: () => {
            if (this.props.displayedType === DISPLAYED_TYPE_TOOLPATH) {
                this.props.showModelGroupObject();
            } else {
                this.props.showToolPathGroupObject();
            }
        },
        switchToProcess: () => {
            this.props.switchToPage(PAGE_PROCESS);
        },
        onGenerateGcode: () => {
            const thumbnail = this.thumbnail.current.getThumbnail();
            this.props.commitGenerateGcode(thumbnail);
        },
        onLoadGcode: async () => {
            const { gcodeFile } = this.props;
            if (gcodeFile === null) {
                return;
            }
            await this.props.renderGcodeFile(gcodeFile);
            this.setState({ showWorkspace: true });
            // this.props.pageActions.popupWorkspace();
            // this.props.history.push('/workspace');
            window.scrollTo(0, 0);
        },
        onExport: () => {
            const { gcodeFile } = this.props;
            if (gcodeFile === null) {
                return;
            }
            this.props.exportFile(gcodeFile.uploadName);
        },
        onProcess: () => {
            this.props.createToolPath();
        },
        onSimulation: () => {
            this.props.commitGenerateViewPath();
        },
        showToolPathObject: () => {
            this.props.showToolPathGroupObject();
        },
        preview: async () => {
            await this.props.preview();
            if (this.props.canGenerateGcode) {
                this.actions.onGenerateGcode();
            }
        },
        setAutoPreview: (enable) => {
            this.props.setAutoPreview(enable);
        },
        showAndHideToolPathObject: () => {
            if (this.props.displayedType === DISPLAYED_TYPE_TOOLPATH) {
                this.props.showModelGroupObject();
            } else {
                this.props.showToolPathGroupObject();
            }
        },
        handleMouseOver: () => {
            this.setState({
                showExportOptions: true
            });
        },
        handleMouseOut: () => {
            this.setState({
                showExportOptions: false
            });
        }
    };

    componentDidMount() {
        UniApi.Event.on('appbar-menu:cnc-laser.export-gcode', this.actions.onExport);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.previewFailed && !this.props.previewFailed) {
            modal({
                title: i18n._('Failed to preview'),
                body: i18n._('Failed to preview, please modify parameters and try again.')
            });
        }
    }

    componentWillUnmount() {
        UniApi.Event.off('appbar-menu:cnc-laser.export-gcode', this.actions.onExport);
    }

    renderWorkspace() {
        const onClose = () => this.setState({ showWorkspace: false });
        return this.state.showWorkspace && renderPopup({
            onClose,
            component: Workspace
        });
    }
    // {i18n._('Export G-code to File')}

    render() {
        const actions = this.actions;
        const { workflowState, isGcodeGenerating, gcodeFile, hasModel, hasToolPathModel, inProgress, displayedType } = this.props;
        const menu = (
            <Menu>
                <Menu.Item
                    onClick={actions.onLoadGcode}
                    disabled={inProgress || !hasModel || workflowState === 'running' || isGcodeGenerating || gcodeFile === null}
                >
                    <div className={classNames('align-c')}>
                        {i18n._('Load G-code to Workspace')}
                    </div>
                </Menu.Item>
                <Menu.Item
                    disabled={inProgress || !hasModel || workflowState === 'running' || isGcodeGenerating || gcodeFile === null}
                    onClick={actions.onExport}
                >
                    <div className={classNames('align-c')}>
                        {i18n._('Export G-code to file')}
                    </div>
                </Menu.Item>
            </Menu>
        );
        return (
            <div className={classNames('position-fixed', 'border-radius-bottom-8', 'bottom-8', 'background-color-white', styles['output-wrapper'])}>
                <div className={classNames('position-re', 'margin-horizontal-16', 'margin-vertical-16')}>
                    <Button
                        type="primary"
                        priority="level-one"
                        onClick={this.actions.preview}
                        style={{ display: displayedType !== DISPLAYED_TYPE_TOOLPATH ? 'block' : 'none' }}
                        disabled={inProgress || (!hasToolPathModel ?? false)}
                    >
                        {i18n._('Preview')}
                    </Button>
                    {displayedType === DISPLAYED_TYPE_TOOLPATH && !this.state.showExportOptions && (
                        <Button
                            type="primary"
                            priority="level-one"
                            onClick={() => {
                                this.actions.switchToEditPage();
                                this.actions.handleMouseOut();
                            }}
                            className={classNames('position-ab', 'bottom-64')}
                        >
                            {i18n._('Back to Object View')}
                        </Button>
                    )}
                    <div
                        onKeyDown={noop}
                        role="button"
                        tabIndex={0}
                        className={classNames('position-re')}
                        onMouseEnter={actions.handleMouseOver}
                        onMouseLeave={actions.handleMouseOut}
                    >
                        <Dropdown
                            overlay={menu}
                        >
                            <Button
                                type="primary"
                                priority="level-one"
                                disabled={inProgress || !hasModel || workflowState === 'running' || isGcodeGenerating || gcodeFile === null}
                                className={classNames(
                                    'position-ab',
                                    'bottom-16',
                                    'margin-top-10',
                                    displayedType === DISPLAYED_TYPE_TOOLPATH ? 'display-block' : 'display-none'
                                )}
                            >
                                {i18n._('Export')}
                            </Button>
                        </Dropdown>
                    </div>

                </div>
                <Thumbnail
                    ref={this.thumbnail}
                    modelGroup={this.props.modelGroup}
                    toolPathGroup={this.props.toolPathGroup}
                />
                {this.renderWorkspace()}
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { workflowState } = state.machine;
    const { widgets } = state.widget;
    const { headType } = ownProps;
    const { isGcodeGenerating, autoPreviewEnabled,
        previewFailed, modelGroup, toolPathGroup, displayedType, gcodeFile, inProgress, page } = state[headType];

    const canGenerateGcode = toolPathGroup.canGenerateGcode();
    const hasToolPathModel = (toolPathGroup.toolPaths.length > 0);
    const disablePreview = toolPathGroup.toolPaths.every(item => item.visible === false);

    return {
        page,
        disablePreview,
        headType,
        modelGroup,
        hasModel: modelGroup.hasModel(),
        hasToolPathModel,
        displayedType,
        toolPathGroup,
        canGenerateGcode,
        isGcodeGenerating,
        workflowState,
        previewFailed,
        gcodeFile,
        autoPreview: widgets[`${headType}-output`].autoPreview, // Todo
        autoPreviewEnabled,
        inProgress
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    const { headType } = ownProps;
    return {
        switchToPage: (page) => dispatch(editorActions.switchToPage(headType, page)),
        showToolPathGroupObject: () => dispatch(editorActions.showToolPathGroupObject(headType)),
        showModelGroupObject: () => dispatch(editorActions.showModelGroupObject(headType)),
        // togglePage: (page) => dispatch(editorActions.togglePage(headType, page)),
        commitGenerateGcode: (thumbnail) => dispatch(editorActions.commitGenerateGcode(headType, thumbnail)),
        renderGcodeFile: (fileName) => dispatch(workspaceActions.renderGcodeFile(fileName)),
        createToolPath: () => dispatch(editorActions.createToolPath(headType)),
        exportFile: (targetFile) => dispatch(projectActions.exportFile(targetFile)),
        commitGenerateViewPath: () => dispatch(editorActions.commitGenerateViewPath(headType)),
        setAutoPreview: (autoPreviewEnabled) => dispatch(editorActions.setAutoPreview(headType, autoPreviewEnabled)),
        preview: () => dispatch(editorActions.preview(headType))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(Output));
