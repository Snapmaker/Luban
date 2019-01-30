import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import FileSaver from 'file-saver';
import i18n from '../../lib/i18n';
import { STAGE_GENERATED, CNC_GCODE_SUFFIX, STAGE_PREVIEWED } from '../../constants';
import { actions as workspaceActions } from '../../reducers/workspace';
import { actions } from '../../reducers/cnc';
import styles from '../styles.styl';
import { getTimestamp } from '../../lib/utils';

const getGcodeFileName = () => {
    return `cnc_${getTimestamp()}${CNC_GCODE_SUFFIX}`;
};

class Output extends PureComponent {
    static propTypes = {
        stage: PropTypes.number.isRequired,
        workState: PropTypes.string.isRequired,
        gcodeStr: PropTypes.string.isRequired,
        addGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired,
        generateGcode: PropTypes.func.isRequired
    };

    actions = {
        onGenerateGcode: () => {
            this.props.generateGcode();
        },
        onLoadGcode: () => {
            const { gcodeStr } = this.props;
            document.location.href = '/#/workspace';
            window.scrollTo(0, 0);

            const fileName = getGcodeFileName();
            this.props.clearGcode();
            this.props.addGcode(fileName, gcodeStr);
        },
        onExport: () => {
            const { gcodeStr } = this.props;
            const blob = new Blob([gcodeStr], { type: 'text/plain;charset=utf-8' });
            const fileName = getGcodeFileName();
            FileSaver.saveAs(blob, fileName, true);
        }
    };

    render() {
        const canOperateGcode = (this.props.workState !== 'running' && this.props.stage === STAGE_GENERATED);
        const canGenerateGcode = (this.props.workState !== 'running' && this.props.stage === STAGE_PREVIEWED);
        return (
            <div>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={this.actions.onGenerateGcode}
                    disabled={!canGenerateGcode}
                    style={{ display: 'block', width: '100%' }}
                >
                    {i18n._('Generate G-code')}
                </button>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={this.actions.onLoadGcode}
                    disabled={!canOperateGcode}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Load G-code to Workspace')}
                </button>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={this.actions.onExport}
                    disabled={!canOperateGcode}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Export G-code to file')}
                </button>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { stage, workState, gcodeStr } = state.cnc;
    return {
        stage: stage,
        workState: workState,
        gcodeStr: gcodeStr
    };
};

const mapDispatchToProps = (dispatch) => ({
    generateGcode: () => dispatch(actions.generateGcode()),
    addGcode: (name, gcode, renderMethod) => dispatch(workspaceActions.addGcode(name, gcode, renderMethod)),
    clearGcode: () => dispatch(workspaceActions.clearGcode())
});

export default connect(mapStateToProps, mapDispatchToProps)(Output);

