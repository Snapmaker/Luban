import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import FileSaver from 'file-saver';
import { connect } from 'react-redux';
import { actions as workspaceActions } from '../../reducers/workspace';
import { actions as sharedActions } from '../../reducers/cncLaserShared';
import { CNC_GCODE_SUFFIX } from '../../constants';
import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import styles from '../styles.styl';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import TipTrigger from '../../components/TipTrigger';
import Space from '../../components/Space';


class Output extends PureComponent {
    static propTypes = {
        previewFailed: PropTypes.bool.isRequired,
        autoPreviewEnabled: PropTypes.bool.isRequired,
        isAllModelsPreviewed: PropTypes.bool.isRequired,
        isGcodeGenerated: PropTypes.bool.isRequired,
        workState: PropTypes.string.isRequired,
        gcodeBeans: PropTypes.array.isRequired,
        generateGcode: PropTypes.func.isRequired,
        addGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired,
        manualPreview: PropTypes.func.isRequired,
        setAutoPreview: PropTypes.func.isRequired
    };

    actions = {
        onGenerateGcode: () => {
            if (!this.props.isAllModelsPreviewed) {
                modal({
                    title: i18n._('Warning'),
                    body: i18n._('Please wait for automatic preview to complete.')
                });
                return;
            }
            this.props.generateGcode();
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
                this.props.addGcode('CNC carving object(s)', gcode, renderMethod);
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
            const fileName = pathWithRandomSuffix(`${gcodeBeans[0].modelInfo.name}.${CNC_GCODE_SUFFIX}`);
            FileSaver.saveAs(blob, fileName, true);
        },
        onToggleAutoPreview: (event) => {
            this.props.setAutoPreview(event.target.checked);
        }
    };

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
        const { workState, isGcodeGenerated, manualPreview, autoPreviewEnabled } = this.props;

        return (
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
                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td>
                                <TipTrigger
                                    title={i18n._('Auto Preview')}
                                    content={i18n._('When enabled, the software will show the preview automatically after the settings are changed. You can disable it if Auto Preview takes too much time.')}
                                >
                                    <input
                                        type="checkbox"
                                        checked={autoPreviewEnabled}
                                        onChange={actions.onToggleAutoPreview}
                                    />
                                    <Space width={4} />
                                    <span>{i18n._('Auto Preview')}</span>
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
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
                    disabled={workState === 'running' || !isGcodeGenerated}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Load G-code to Workspace')}
                </button>
                <button
                    type="button"
                    className="sm-btn-large sm-btn-default"
                    onClick={actions.onExport}
                    disabled={workState === 'running' || !isGcodeGenerated}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Export G-code to file')}
                </button>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { workState } = state.machine;
    const { isGcodeGenerated, gcodeBeans, isAllModelsPreviewed, previewFailed, autoPreviewEnabled } = state.cnc;
    return {
        isGcodeGenerated,
        workState,
        gcodeBeans,
        isAllModelsPreviewed,
        previewFailed,
        autoPreviewEnabled
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        generateGcode: () => dispatch(sharedActions.generateGcode('cnc')),
        addGcode: (name, gcode, renderMethod) => dispatch(workspaceActions.addGcode(name, gcode, renderMethod)),
        clearGcode: () => dispatch(workspaceActions.clearGcode()),
        manualPreview: () => dispatch(sharedActions.manualPreview('cnc')),
        setAutoPreview: (value) => dispatch(sharedActions.setAutoPreview('cnc', value))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Output);
