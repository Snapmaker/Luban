import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import FileSaver from 'file-saver';
import request from 'superagent';
import { connect } from 'react-redux';
import { actions as workspaceActions } from '../../flux/workspace';
import { actions as sharedActions } from '../../flux/cncLaserShared';
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
        this.props.setTitle(i18n._('Output'));
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
        const { workflowState, isAllModelsPreviewed, isGcodeGenerating, autoPreviewEnabled, gcodeFile } = this.props;
        const isEditor = this.props.page === PAGE_EDITOR;
        const isPreview = this.props.page === PAGE_PROCESS;

        return (
            <div>
                <div>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-default"
                        disabled={isPreview && autoPreviewEnabled}
                        onClick={this.actions.onProcess}
                        style={{ display: 'block', width: '100%' }}
                    >
                        {isPreview ? i18n._('Preview') : i18n._('Process')}
                    </button>
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
                        disabled={!isAllModelsPreviewed || isGcodeGenerating}
                        style={{ display: 'block', width: '100%', marginTop: '10px' }}
                    >
                        {i18n._('Generate G-code')}
                    </button>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-default"
                        onClick={actions.onLoadGcode}
                        disabled={workflowState === 'running' || isGcodeGenerating || gcodeFile === null}
                        style={{ display: 'block', width: '100%', marginTop: '10px' }}
                    >
                        {i18n._('Load G-code to Workspace')}
                    </button>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-default"
                        onClick={actions.onExport}
                        disabled={workflowState === 'running' || isGcodeGenerating || gcodeFile === null}
                        style={{ display: 'block', width: '100%', marginTop: '10px' }}
                    >
                        {i18n._('Export G-code to file')}
                    </button>
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
    const { widgetId } = ownProps;
    const { page, isGcodeGenerating, isAllModelsPreviewed,
        previewFailed, autoPreviewEnabled, modelGroup, toolPathModelGroup, gcodeFile } = state.laser;

    return {
        page,
        modelGroup,
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
    return {
        togglePage: (page) => dispatch(sharedActions.togglePage('laser', page)),
        generateGcode: (thumbnail) => dispatch(sharedActions.generateGcode('laser', thumbnail)),
        renderGcodeFile: (fileName) => dispatch(workspaceActions.renderGcodeFile(fileName)),
        manualPreview: () => dispatch(sharedActions.manualPreview('laser', true)),
        setAutoPreview: (value) => dispatch(sharedActions.setAutoPreview('laser', value)),
        updateWidgetState: (state) => dispatch(widgetActions.updateWidgetState(ownProps.widgetId, '', state))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Output);
