import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import FileSaver from 'file-saver';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { actions as workspaceActions } from '../../reducers/workspace';
import { actions as sharedActions } from '../../reducers/cncLaserShared';
import { LASER_GCODE_SUFFIX } from '../../constants';
import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import styles from '../styles.styl';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';


class Output extends PureComponent {
    static propTypes = {
        isAllModelsPreviewed: PropTypes.bool.isRequired,
        isGcodeGenerated: PropTypes.bool.isRequired,
        workState: PropTypes.string.isRequired,
        gcodeBeans: PropTypes.array.isRequired,
        initModelsPreviewChecker: PropTypes.func.isRequired,
        generateGcode: PropTypes.func.isRequired,
        addGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired,
        manualPreview: PropTypes.func.isRequired
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
            const fileName = pathWithRandomSuffix(`${gcodeBeans[0].modelInfo.name}.${LASER_GCODE_SUFFIX}`);
            FileSaver.saveAs(blob, fileName, true);
        }
    };

    componentDidMount() {
        this.props.initModelsPreviewChecker();
    }

    render() {
        const { workState, isGcodeGenerated, manualPreview } = this.props;

        return (
            <div>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={manualPreview}
                    style={{ display: 'block', width: '100%' }}
                >
                    {i18n._('Preview')}
                </button>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={this.actions.onGenerateGcode}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Generate G-code')}
                </button>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={this.actions.onLoadGcode}
                    disabled={workState === 'running' || !isGcodeGenerated}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Load G-code to Workspace')}
                </button>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={this.actions.onExport}
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
    const { isGcodeGenerated, gcodeBeans, isAllModelsPreviewed } = state.laser;
    return {
        isGcodeGenerated,
        workState,
        gcodeBeans,
        isAllModelsPreviewed
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        initModelsPreviewChecker: () => dispatch(sharedActions.initModelsPreviewChecker('laser')),
        generateGcode: () => dispatch(sharedActions.generateGcode('laser')),
        addGcode: (name, gcode, renderMethod) => dispatch(workspaceActions.addGcode(name, gcode, renderMethod)),
        clearGcode: () => dispatch(workspaceActions.clearGcode()),
        manualPreview: () => dispatch(sharedActions.manualPreview('laser'))

    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Output);
