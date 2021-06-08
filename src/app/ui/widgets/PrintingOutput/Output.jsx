import React, { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import path from 'path';
import { noop } from 'lodash';
import PropTypes from 'prop-types';
import FileSaver from 'file-saver';

// import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import UniApi from '../../../lib/uni-api';
import { actions as printingActions, PRINTING_STAGE } from '../../../flux/printing';
import { actions as workspaceActions } from '../../../flux/workspace';
import { actions as projectActions } from '../../../flux/project';
import Thumbnail from './Thumbnail';
import ModelExporter from '../PrintingVisualizer/ModelExporter';

import { renderPopup } from '../../utils';

import Workspace from '../../Pages/Workspace';

class Output extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes,

        displayGcode: PropTypes.func.isRequired,
        displayModel: PropTypes.func.isRequired,

        modelGroup: PropTypes.object.isRequired,
        isGcodeOverstepped: PropTypes.bool.isRequired,
        workflowState: PropTypes.string.isRequired,
        gcodeLine: PropTypes.object,
        displayedType: PropTypes.string,
        gcodeFile: PropTypes.object,
        hasModel: PropTypes.bool.isRequired,
        hasAnyModelVisible: PropTypes.bool.isRequired,
        stage: PropTypes.number.isRequired,
        isAnyModelOverstepped: PropTypes.bool.isRequired,
        inProgress: PropTypes.bool.isRequired,
        generateGcode: PropTypes.func.isRequired,
        exportFile: PropTypes.func.isRequired,
        renderGcodeFile: PropTypes.func.isRequired
    };

    state = {
        exportModelFormatInfo: 'stl_binary',
        showExportOptions: false
    };

    thumbnail = React.createRef();

    actions = {
        onToggleDisplayGcode: () => {
            if (this.props.displayedType === 'gcode') {
                this.props.displayModel();
            } else {
                this.props.displayGcode();
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
        },
        onClickGenerateGcode: () => {
            const thumbnail = this.thumbnail.current.getThumbnail();
            this.props.generateGcode(thumbnail);
        },
        onClickLoadGcode: () => {
            if (this.props.isGcodeOverstepped) {
                modal({
                    title: 'Warning',
                    body: 'Generated G-code overstepped out of the cube, please modify your model and re-generate G-code.'
                });
                return;
            }
            const { gcodeFile } = this.props;

            gcodeFile.thumbnail = this.thumbnail.current.getDataURL();

            this.props.renderGcodeFile(gcodeFile);
            this.setState({ showWorkspace: true });

            window.scrollTo(0, 0);
        },
        changeFilenameExt: (filename) => {
            if (path.extname(filename) && ['.stl', '.obj'].includes(path.extname(filename).toLowerCase())) {
                const extname = path.extname(filename);
                filename = `${filename.slice(0, filename.lastIndexOf(extname))}.gcode`;
            }
            return filename;
        },
        onClickExportGcode: () => {
            if (this.props.isGcodeOverstepped) {
                modal({
                    title: 'Warning',
                    body: 'Generated G-code overstepped out of the cube, please modify your model and re-generate G-code.'
                });
                return;
            }

            const { gcodeFile } = this.props;
            const filename = path.basename(gcodeFile.name);
            this.props.exportFile(filename);
        },
        onChangeExportModelFormat: (option) => {
            this.setState({
                exportModelFormatInfo: option.value
            });
        },
        onClickExportModel: () => {
            const infos = this.state.exportModelFormatInfo.split('_');
            const format = infos[0];
            const isBinary = (infos.length > 1) ? (infos[1] === 'binary') : false;
            // const output = new ModelExporter().parse(this.props.modelGroup, format, isBinary);
            const output = new ModelExporter().parse(this.props.modelGroup.object, format, isBinary);
            if (!output) {
                // export error
                return;
            }
            const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
            let fileName = 'export';
            if (format === 'stl') {
                if (isBinary === true) {
                    fileName += '_binary';
                } else {
                    fileName += '_ascii';
                }
            }
            fileName += `.${format}`;
            FileSaver.saveAs(blob, fileName, true);
        }
    };

    componentDidMount() {
        UniApi.Event.on('appbar-menu:printing.export-gcode', this.actions.onClickExportGcode);
        UniApi.Event.on('appbar-menu:printing.export-model', this.actions.onClickExportModel);
    }

    componentWillUnmount() {
        UniApi.Event.off('appbar-menu:printing.export-gcode', this.actions.onClickExportGcode);
        UniApi.Event.off('appbar-menu:printing.export-model', this.actions.onClickExportModel);
    }

    renderWorkspace() {
        const onClose = () => this.setState({ showWorkspace: false });
        return this.state.showWorkspace && renderPopup({
            onClose,
            component: Workspace
        });
    }

    render() {
        // const state = this.state;
        const actions = this.actions;
        const { workflowState, stage, gcodeLine, hasModel, hasAnyModelVisible, displayedType, inProgress } = this.props;

        const isSlicing = stage === PRINTING_STAGE.SLICING;
        const { isAnyModelOverstepped } = this.props;

        return (
            <div style={{ position: 'fixed', bottom: '10px', backgroundColor: '#fff', width: '360px' }}>
                <div>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-default"
                        onClick={actions.onClickGenerateGcode}
                        disabled={!hasModel || !hasAnyModelVisible || isSlicing || isAnyModelOverstepped || inProgress}
                        style={{ display: gcodeLine ? 'none' : 'block', width: '100%' }}
                    >
                        {i18n._('Generate G-code')}
                    </button>
                    {gcodeLine && (
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-default"
                            onClick={actions.onToggleDisplayGcode}
                            style={{ position: 'absolute', bottom: '46px', width: '100%' }}
                            disabled={inProgress}
                        >
                            {displayedType === 'gcode' ? i18n._('Close preview') : i18n._('Preview ')}
                        </button>
                    )}
                    <div
                        onKeyDown={noop}
                        role="button"
                        tabIndex={0}
                        onMouseEnter={actions.handleMouseOver}
                        onMouseLeave={actions.handleMouseOut}
                    >
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-default"
                            style={{ display: gcodeLine ? 'block' : 'none', position: 'absolute', bottom: '0', width: '100%', marginTop: '10px' }}
                            disabled={inProgress}
                        >
                            {i18n._('Export')}
                        </button>
                        {this.state.showExportOptions && (
                            <div style={{ position: 'relative', bottom: '46px', backgroundColor: '#fff', width: '360px' }}>
                                <button
                                    type="button"
                                    className="sm-btn-large sm-btn-default"
                                    onClick={actions.onClickLoadGcode}
                                    disabled={workflowState === 'running' || !gcodeLine || inProgress}
                                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                                >
                                    {i18n._('Load G-code to Workspace')}
                                </button>
                                <button
                                    type="button"
                                    className="sm-btn-large sm-btn-default"
                                    onClick={actions.onClickExportGcode}
                                    disabled={!gcodeLine || inProgress}
                                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                                >
                                    {i18n._('Export G-code to File')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <Thumbnail
                    ref={this.thumbnail}
                    modelGroup={this.props.modelGroup}
                />
                {this.renderWorkspace()}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const printing = state.printing;
    const { workflowState } = state.machine;
    const {
        stage,
        modelGroup, hasModel, isAnyModelOverstepped,
        isGcodeOverstepped, gcodeLine, gcodeFile, displayedType, inProgress
    } = printing;

    return {
        workflowState,
        stage,
        modelGroup,
        hasAnyModelVisible: modelGroup.hasAnyModelVisible(),
        hasModel,
        isAnyModelOverstepped,
        isGcodeOverstepped,
        gcodeLine,
        displayedType,
        gcodeFile,
        inProgress
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        generateGcode: (thumbnail) => dispatch(printingActions.generateGcode(thumbnail)),
        renderGcodeFile: (file) => dispatch(workspaceActions.renderGcodeFile(file)),
        displayGcode: () => dispatch(printingActions.displayGcode()),
        displayModel: () => dispatch(printingActions.displayModel()),
        exportFile: (targetFile) => dispatch(projectActions.exportFile(targetFile))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(Output));
