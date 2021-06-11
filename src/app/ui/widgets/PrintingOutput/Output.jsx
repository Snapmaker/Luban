import React, { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import path from 'path';
import PropTypes from 'prop-types';
import FileSaver from 'file-saver';
import Select from '../../components/Select';

// import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
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
        widgetActions: PropTypes.object.isRequired,
        minimized: PropTypes.bool.isRequired,

        modelGroup: PropTypes.object.isRequired,
        isGcodeOverstepped: PropTypes.bool.isRequired,
        workflowState: PropTypes.string.isRequired,
        gcodeLine: PropTypes.object,
        gcodeFile: PropTypes.object,
        hasModel: PropTypes.bool.isRequired,
        hasAnyModelVisible: PropTypes.bool.isRequired,
        stage: PropTypes.number.isRequired,
        isAnyModelOverstepped: PropTypes.bool.isRequired,
        generateGcode: PropTypes.func.isRequired,
        exportFile: PropTypes.func.isRequired,
        renderGcodeFile: PropTypes.func.isRequired
    };

    state = {
        exportModelFormatInfo: 'stl_binary'
    };

    thumbnail = React.createRef();

    actions = {
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

            this.props.history.push('/workspace');
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

    constructor(props) {
        super(props);
        this.props.widgetActions.setTitle(i18n._('Actions'));
    }

    renderWorkspace() {
        const onClose = () => this.setState({ showWorkspace: false });
        return this.state.showWorkspace && renderPopup({
            onClose,
            component: Workspace
        });
    }

    render() {
        const state = this.state;
        const actions = this.actions;
        const { workflowState, stage, gcodeLine, hasModel, hasAnyModelVisible } = this.props;

        const isSlicing = stage === PRINTING_STAGE.SLICING;
        const { isAnyModelOverstepped } = this.props;

        return (
            <div>
                <div>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-default"
                        onClick={actions.onClickGenerateGcode}
                        disabled={!hasModel || !hasAnyModelVisible || isSlicing || isAnyModelOverstepped}
                        style={{ display: 'block', width: '100%' }}
                    >
                        {i18n._('Generate G-code')}
                    </button>
                    <table style={{ width: '100%', marginTop: '10px' }}>
                        <tbody>
                            <tr>
                                <td style={{ paddingLeft: '0px', width: '60%' }}>
                                    <Select
                                        clearable={false}
                                        options={[{
                                            value: 'stl_binary',
                                            label: i18n._('STL File (Binary) (*.stl)')
                                        }, {
                                            value: 'stl_ascii',
                                            label: i18n._('STL File (ASCII) (*.stl)')
                                        }, {
                                            value: 'obj',
                                            label: i18n._('OBJ File (*.obj)')
                                        }]}
                                        value={state.exportModelFormatInfo}
                                        searchable={false}
                                        onChange={actions.onChangeExportModelFormat}
                                    />
                                </td>
                                <td style={{ paddingRight: '0px', width: '40%' }}>
                                    <button
                                        type="button"
                                        className="sm-btn-large sm-btn-default"
                                        style={{ width: '100%', lineHeight: '95%' }}
                                        disabled={!hasModel}
                                        onClick={actions.onClickExportModel}
                                    >
                                        {i18n._('Export Models')}
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-default"
                        onClick={actions.onClickLoadGcode}
                        disabled={workflowState === 'running' || !gcodeLine}
                        style={{ display: 'block', width: '100%', marginTop: '10px' }}
                    >
                        {i18n._('Load G-code to Workspace')}
                    </button>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-default"
                        onClick={actions.onClickExportGcode}
                        disabled={!gcodeLine}
                        style={{ display: 'block', width: '100%', marginTop: '10px' }}
                    >
                        {i18n._('Export G-code to File')}
                    </button>
                </div>
                <Thumbnail
                    ref={this.thumbnail}
                    modelGroup={this.props.modelGroup}
                    minimized={this.props.minimized}
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
        isGcodeOverstepped, gcodeLine, gcodeFile
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
        gcodeFile
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        generateGcode: (thumbnail) => dispatch(printingActions.generateGcode(thumbnail)),
        renderGcodeFile: (file) => dispatch(workspaceActions.renderGcodeFile(file)),
        exportFile: (targetFile) => dispatch(projectActions.exportFile(targetFile))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(Output));
