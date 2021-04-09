import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import i18n from '../../lib/i18n';
import { HEAD_CNC, DISPLAYED_TYPE_TOOLPATH } from '../../constants';
import { actions as editorActions } from '../../flux/editor';
import styles from './styles.styl';
import Space from '../../components/Space';

class VisualizerTopRight extends PureComponent {
    static propTypes = {
        canGenerateGcode: PropTypes.bool.isRequired,
        hasSimulation: PropTypes.bool.isRequired,
        headType: PropTypes.string.isRequired,
        displayedType: PropTypes.string.isRequired,
        showToolPath: PropTypes.bool.isRequired,
        showSimulation: PropTypes.bool.isRequired,
        showToolPathGroupObject: PropTypes.func.isRequired,
        showModelGroupObject: PropTypes.func.isRequired,
        showToolpathInPreview: PropTypes.func.isRequired,
        showSimulationInPreview: PropTypes.func.isRequired,

        commitGenerateViewPath: PropTypes.func.isRequired
    };

    actions = {
        switchToEditPage: () => {
            if (this.props.displayedType === DISPLAYED_TYPE_TOOLPATH) {
                this.props.showModelGroupObject();
            } else {
                this.props.showToolPathGroupObject();
            }
        },
        switchShowToolPath: () => {
            this.props.showToolpathInPreview(!this.props.showToolPath);
        },
        switchShowSimulation: () => {
            if (this.props.showSimulation) {
                this.props.showSimulationInPreview(!this.props.showSimulation);
                return;
            }
            if (this.props.canGenerateGcode) {
                this.props.commitGenerateViewPath();
            }
            console.log('has', this.props.hasSimulation);
        }
    };

    componentWillReceiveProps(nextProps) {
        if (nextProps.canGenerateGcode === false) {
            this.props.showSimulationInPreview(false);
        }
    }

    render() {
        return (
            <React.Fragment>
                <div>
                    <button
                        type="button"
                        className="sm-btn-small sm-btn-primary"
                        style={{
                            float: 'left',
                            height: '40px',
                            width: '184px'
                        }}
                        title={i18n._('Back To Object View')}
                        onClick={() => this.actions.switchToEditPage()}
                    >
                        <div className={styles.topRightDiv11} />
                        <Space width={8} />
                        <div className={styles.topRightDiv12}>
                            {i18n._('Back To Object View')}
                        </div>
                    </button>
                </div>
                <div
                    className={styles['top-right-div2']}
                >
                    <div className={styles.title}>
                        {i18n._('Preview Type')}
                    </div>
                    <div className={styles.content}>
                        <input
                            type="checkbox"
                            onChange={this.actions.switchShowToolPath}
                            checked={this.props.showToolPath}
                        />
                        <span>
                            {i18n._('Toolpath')}
                        </span>
                    </div>
                    {this.props.headType === HEAD_CNC && (
                        <div className={styles.content}>
                            <input
                                type="checkbox"
                                onChange={this.actions.switchShowSimulation}
                                checked={this.props.showSimulation}
                            />
                            <span>
                                {i18n._('Simulation')}
                            </span>
                        </div>
                    )}
                </div>
            </React.Fragment>
        );
    }
}
const mapStateToProps = (state) => {
    const { displayedType, showToolPath, showSimulation, toolPathGroup } = state.cnc;
    const canGenerateGcode = toolPathGroup.canGenerateGcode();
    const hasSimulation = (toolPathGroup.simulationObject !== undefined);
    return {
        canGenerateGcode,
        hasSimulation,
        headType: 'cnc',
        displayedType,
        showToolPath,
        showSimulation
    };
};
const mapDispatchToProps = (dispatch) => ({
    showToolPathGroupObject: () => dispatch(editorActions.showToolPathGroupObject('cnc')),
    showModelGroupObject: () => dispatch(editorActions.showModelGroupObject('cnc')),
    showToolpathInPreview: (show) => dispatch(editorActions.showToolpathInPreview('cnc', show)),
    showSimulationInPreview: (show) => dispatch(editorActions.showSimulationInPreview('cnc', show)),
    commitGenerateViewPath: () => dispatch(editorActions.commitGenerateViewPath('cnc'))
});

export default connect(mapStateToProps, mapDispatchToProps)(VisualizerTopRight);
