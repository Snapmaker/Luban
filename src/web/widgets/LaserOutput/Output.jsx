import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import FileSaver from 'file-saver';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { actions } from '../../reducers/modules/laser';
import { actions as workspaceActions } from '../../reducers/modules/workspace';
import { LASER_GCODE_SUFFIX } from '../../constants';
import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import styles from '../styles.styl';


class Output extends PureComponent {
    static propTypes = {
        isGcodeGenerated: PropTypes.bool.isRequired,
        workState: PropTypes.string.isRequired,
        gcodeBeans: PropTypes.array.isRequired,
        updateIsAllModelsPreviewed: PropTypes.func.isRequired,
        generateGcode: PropTypes.func.isRequired,
        addGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired
    };

    actions = {
        onGenerateGcode: () => {
            if (!this.props.updateIsAllModelsPreviewed()) {
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
            if (gcodeBeans.length === 1) {
                const { gcode, modelInfo } = gcodeBeans[0];
                const renderMethod = (modelInfo.processMode === 'greyscale' ? 'point' : 'line');

                this.props.clearGcode();
                this.props.addGcode('laser engrave object', gcode, renderMethod);
            } else {
                this.props.clearGcode();
                for (let i = 0; i < gcodeBeans.length; i++) {
                    const { gcode, modelInfo } = gcodeBeans[i];
                    const renderMethod = (modelInfo.processMode === 'greyscale' ? 'point' : 'line');
                    this.props.addGcode('laser engrave objects (multi-model)', gcode, renderMethod);
                }
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
            const fileName = `laser${LASER_GCODE_SUFFIX}`;
            FileSaver.saveAs(blob, fileName, true);
        }
    };

    render() {
        const { workState, isGcodeGenerated } = this.props;

        return (
            <div>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={this.actions.onGenerateGcode}
                    style={{ display: 'block', width: '100%' }}
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
    const laser = state.laser;
    return {
        isGcodeGenerated: laser.isGcodeGenerated,
        workState: laser.workState,
        gcodeBeans: laser.gcodeBeans
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateIsAllModelsPreviewed: () => dispatch(actions.updateIsAllModelsPreviewed()),
        generateGcode: () => dispatch(actions.generateGcode()),
        addGcode: (name, gcode, renderMethod) => dispatch(workspaceActions.addGcode(name, gcode, renderMethod)),
        clearGcode: () => dispatch(workspaceActions.clearGcode())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Output);
