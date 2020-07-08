import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import FileSaver from 'file-saver';
import request from 'superagent';
import { connect } from 'react-redux';
import { actions as workspaceActions } from '../../flux/workspace';
import { actions as editorActions } from '../../flux/editor';
import { DATA_PREFIX, PAGE_EDITOR, PAGE_PROCESS } from '../../constants';

import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import Thumbnail from '../CncLaserShared/Thumbnail';
import TipTrigger from '../../components/TipTrigger';
import { actions as widgetActions } from '../../flux/widget';


class Output extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        minimized: PropTypes.bool.isRequired,

        page: PropTypes.string.isRequired,

        modelGroup: PropTypes.object.isRequired,
        hasModel: PropTypes.bool,
        toolPathModelGroup: PropTypes.object.isRequired,
        previewFailed: PropTypes.bool.isRequired,
        autoPreviewEnabled: PropTypes.bool.isRequired,
        autoPreview: PropTypes.bool,
        isAllModelsPreviewed: PropTypes.bool.isRequired,
        isGcodeGenerating: PropTypes.bool.isRequired,
        workflowState: PropTypes.string.isRequired,
        gcodeFile: PropTypes.object,
        generateGcode: PropTypes.func.isRequired,
        renderGcodeFile: PropTypes.func.isRequired,
        manualPreview: PropTypes.func.isRequired,
        setAutoPreview: PropTypes.func.isRequired,
        updateWidgetState: PropTypes.func.isRequired,
        togglePage: PropTypes.func.isRequired
    };

    thumbnail = React.createRef();

    actions = {
        onGenerateGcode: () => {
            if (!this.props.isAllModelsPreviewed) {
                modal({
                    title: i18n._('Warning'),
                    body: i18n._('Please wait for automatic preview to complete.')
                });
                return;
            }
            const thumbnail = this.thumbnail.current.getThumbnail();
            this.props.generateGcode(thumbnail);
        },
        onLoadGcode: () => {
            const { gcodeFile } = this.props;
            if (gcodeFile === null) {
                return;
            }
            this.props.renderGcodeFile(gcodeFile);

            document.location.href = '/#/workspace';
            window.scrollTo(0, 0);
        },
        onExport: () => {
            const { gcodeFile } = this.props;
            if (gcodeFile === null) {
                return;
            }

            const gcodePath = `${DATA_PREFIX}/${gcodeFile.uploadName}`;
            request.get(gcodePath).end((err, res) => {
                const gcodeStr = res.text;
                const blob = new Blob([gcodeStr], { type: 'text/plain;charset=utf-8' });
                FileSaver.saveAs(blob, gcodeFile.name, true);
            });
        },
        onToggleAutoPreview: (value) => {
            this.props.setAutoPreview(value);
            this.props.updateWidgetState({
                autoPreview: value
            });
        },
        onProcess: () => {
            if (this.props.page === PAGE_EDITOR) {
                this.props.togglePage(PAGE_PROCESS);
            } else {
                this.props.manualPreview();
            }
        }
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Actions'));
    }

    componentDidMount() {
        this.props.setAutoPreview(this.props.autoPreview === true);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.previewFailed && !this.props.previewFailed) {
            modal({
                title: i18n._('Failed to preview'),
                body: i18n._('Failed to preview, please modify parameters and try again.')
            });
        }
    }

    render() {
        const actions = this.actions;
        const { page, workflowState, isAllModelsPreviewed, isGcodeGenerating, autoPreviewEnabled, gcodeFile, hasModel } = this.props;
        const isEditor = page === PAGE_EDITOR;
        const isProcess = page === PAGE_PROCESS;

        return (
            <div>
                <div>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-default"
                        disabled={isProcess && autoPreviewEnabled}
                        onClick={this.actions.onProcess}
                        style={{ display: 'block', width: '100%' }}
                    >
                        {isProcess ? i18n._('Preview') : i18n._('Process')}
                    </button>
                    {isProcess && (
                        <div>
                            <TipTrigger
                                title={i18n._('Auto Preview')}
                                content={i18n._('When enabled, the software will show the preview automatically after the settings are changed. You can disable it if Auto Preview takes too much time.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Auto Preview')}</span>
                                    <input
                                        type="checkbox"
                                        className="sm-parameter-row__checkbox"
                                        disabled={isEditor}
                                        checked={autoPreviewEnabled}
                                        onChange={(event) => { actions.onToggleAutoPreview(event.target.checked); }}
                                    />
                                </div>
                            </TipTrigger>
                            <button
                                type="button"
                                className="sm-btn-large sm-btn-default"
                                onClick={actions.onGenerateGcode}
                                disabled={!hasModel || !isAllModelsPreviewed || isGcodeGenerating}
                                style={{ display: 'block', width: '100%', marginTop: '10px' }}
                            >
                                {i18n._('Generate G-code')}
                            </button>
                            <button
                                type="button"
                                className="sm-btn-large sm-btn-default"
                                onClick={actions.onLoadGcode}
                                disabled={!hasModel || workflowState === 'running' || isGcodeGenerating || gcodeFile === null}
                                style={{ display: 'block', width: '100%', marginTop: '10px' }}
                            >
                                {i18n._('Load G-code to Workspace')}
                            </button>
                            <button
                                type="button"
                                className="sm-btn-large sm-btn-default"
                                onClick={actions.onExport}
                                disabled={!hasModel || workflowState === 'running' || isGcodeGenerating || gcodeFile === null}
                                style={{ display: 'block', width: '100%', marginTop: '10px' }}
                            >
                                {i18n._('Export G-code to file')}
                            </button>
                        </div>
                    )}
                </div>
                <Thumbnail
                    ref={this.thumbnail}
                    modelGroup={this.props.modelGroup}
                    toolPathModelGroup={this.props.toolPathModelGroup}
                    minimized={this.props.minimized}
                />
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { workflowState } = state.machine;
    const { widgets } = state.widget;
    const { widgetId, headType } = ownProps;
    const { page, isGcodeGenerating, isAllModelsPreviewed,
        previewFailed, autoPreviewEnabled, modelGroup, toolPathModelGroup, gcodeFile } = state[headType];

    return {
        page,
        modelGroup,
        hasModel: modelGroup.hasModel(),
        toolPathModelGroup,
        isGcodeGenerating,
        workflowState,
        isAllModelsPreviewed,
        previewFailed,
        autoPreviewEnabled,
        gcodeFile,
        autoPreview: widgets[widgetId].autoPreview
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    const { widgetId, headType } = ownProps;
    return {
        togglePage: (page) => dispatch(editorActions.togglePage(headType, page)),
        generateGcode: (thumbnail) => dispatch(editorActions.generateGcode(headType, thumbnail)),
        renderGcodeFile: (fileName) => dispatch(workspaceActions.renderGcodeFile(fileName)),
        manualPreview: () => dispatch(editorActions.manualPreview(headType, true)),
        setAutoPreview: (value) => dispatch(editorActions.setAutoPreview(headType, value)),
        updateWidgetState: (state) => dispatch(widgetActions.updateWidgetState(widgetId, '', state))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Output);
