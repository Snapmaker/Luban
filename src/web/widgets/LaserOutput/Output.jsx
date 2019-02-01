import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import FileSaver from 'file-saver';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { actions } from '../../reducers/laser';
import { actions as workspaceActions } from '../../reducers/workspace';
import { LASER_GCODE_SUFFIX } from '../../constants';
import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import styles from '../styles.styl';
import { getTimestamp } from '../../lib/utils';

const getGcodeFileName = () => {
    return `laser_${getTimestamp()}${LASER_GCODE_SUFFIX}`;
};

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
            const fileName = getGcodeFileName();
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
    const { isGcodeGenerated, workState, gcodeBeans } = state.laser;
    return {
        isGcodeGenerated: isGcodeGenerated,
        workState: workState,
        gcodeBeans: gcodeBeans
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
