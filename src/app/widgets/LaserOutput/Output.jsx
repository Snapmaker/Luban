import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import FileSaver from 'file-saver';
import { connect } from 'react-redux';
import { actions as workspaceActions } from '../../flux/workspace';
import { actions as sharedActions } from '../../flux/cncLaserShared';
import { LASER_GCODE_SUFFIX } from '../../constants';
import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import Thumbnail from '../CncLaserShared/Thumbnail';
import TipTrigger from '../../components/TipTrigger';


class Output extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        minimized: PropTypes.bool.isRequired,

        modelGroup: PropTypes.object.isRequired,
        previewFailed: PropTypes.bool.isRequired,
        autoPreviewEnabled: PropTypes.bool.isRequired,
        isAllModelsPreviewed: PropTypes.bool.isRequired,
        isGcodeGenerated: PropTypes.bool.isRequired,
        workflowState: PropTypes.string.isRequired,
        gcodeBeans: PropTypes.array.isRequired,
        generateGcode: PropTypes.func.isRequired,
        addGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired,
        manualPreview: PropTypes.func.isRequired,
        setAutoPreview: PropTypes.func.isRequired
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
            const { gcodeBeans } = this.props;
            if (gcodeBeans.length === 0) {
                return;
            }

            this.props.clearGcode();
            for (let i = 0; i < gcodeBeans.length; i++) {
                const { gcode, modelInfo } = gcodeBeans[i];
                const renderMethod = (modelInfo.mode === 'greyscale' && modelInfo.config.movementMode === 'greyscale-dot' ? 'point' : 'line');
                this.props.addGcode('laser engrave object(s)', gcode, renderMethod);
            }

            document.location.href = '/#/workspace';
            window.scrollTo(0, 0);
        },
        onExport: () => {
            const { gcodeBeans } = this.props;
            if (gcodeBeans.length === 0) {
                return;
            }

            const gcodeArr = [];
            for (let i = 0; i < gcodeBeans.length; i++) {
                const { gcode } = gcodeBeans[i];
                gcodeArr.push(gcode);
            }
            const gcodeStr = gcodeArr.join('\n');
            const blob = new Blob([gcodeStr], { type: 'text/plain;charset=utf-8' });
            const fileName = pathWithRandomSuffix(`${gcodeBeans[0].modelInfo.originalName}.${LASER_GCODE_SUFFIX}`);
            FileSaver.saveAs(blob, fileName, true);
        },
        onToggleAutoPreview: (event) => {
            this.props.setAutoPreview(event.target.checked);
        }
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Output'));
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
        const { workflowState, isGcodeGenerated, manualPreview, autoPreviewEnabled } = this.props;

        return (
            <div>
                <div>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-default"
                        disabled={autoPreviewEnabled}
                        onClick={manualPreview}
                        style={{ display: 'block', width: '100%' }}
                    >
                        {i18n._('Preview')}
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
                                checked={autoPreviewEnabled}
                                onChange={actions.onToggleAutoPreview}
                            />
                        </div>
                    </TipTrigger>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-default"
                        onClick={actions.onGenerateGcode}
                        style={{ display: 'block', width: '100%', marginTop: '10px' }}
                    >
                        {i18n._('Generate G-code')}
                    </button>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-default"
                        onClick={actions.onLoadGcode}
                        disabled={workflowState === 'running' || !isGcodeGenerated}
                        style={{ display: 'block', width: '100%', marginTop: '10px' }}
                    >
                        {i18n._('Load G-code to Workspace')}
                    </button>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-default"
                        onClick={actions.onExport}
                        disabled={workflowState === 'running' || !isGcodeGenerated}
                        style={{ display: 'block', width: '100%', marginTop: '10px' }}
                    >
                        {i18n._('Export G-code to file')}
                    </button>
                </div>
                <Thumbnail
                    ref={this.thumbnail}
                    modelGroup={this.props.modelGroup}
                    minimized={this.props.minimized}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { workflowState } = state.machine;
    const { isGcodeGenerated, gcodeBeans, isAllModelsPreviewed, previewFailed, autoPreviewEnabled, modelGroup } = state.laser;
    return {
        modelGroup,
        isGcodeGenerated,
        workflowState,
        gcodeBeans,
        isAllModelsPreviewed,
        previewFailed,
        autoPreviewEnabled
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        generateGcode: (thumbnail) => dispatch(sharedActions.generateGcode('laser', thumbnail)),
        addGcode: (name, gcode, renderMethod) => dispatch(workspaceActions.addGcode(name, gcode, renderMethod)),
        clearGcode: () => dispatch(workspaceActions.clearGcode()),
        manualPreview: () => dispatch(sharedActions.manualPreview('laser', true)),
        setAutoPreview: (value) => dispatch(sharedActions.setAutoPreview('laser', value))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Output);
