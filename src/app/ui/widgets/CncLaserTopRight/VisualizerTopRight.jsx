import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import i18n from '../../../lib/i18n';
import { HEAD_CNC, DISPLAYED_TYPE_TOOLPATH } from '../../../constants';
import { actions as editorActions } from '../../../flux/editor';
import styles from './styles.styl';

class VisualizerTopRight extends PureComponent {
    static propTypes = {
        simulationNeedToPreview: PropTypes.bool,
        canGenerateGcode: PropTypes.bool.isRequired,
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
                if (this.props.simulationNeedToPreview) {
                    this.props.commitGenerateViewPath();
                } else {
                    this.props.showSimulationInPreview(!this.props.showSimulation);
                }
            }
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
                <div className={styles['visualizer-top-right']}>
                    {/*<div>*/}
                    {/*    <button*/}
                    {/*        type="button"*/}
                    {/*        className="sm-btn-small sm-btn-primary"*/}
                    {/*        style={{*/}
                    {/*            float: 'left',*/}
                    {/*            height: '40px',*/}
                    {/*            width: '184px'*/}
                    {/*        }}*/}
                    {/*        title={i18n._('Back To Object View')}*/}
                    {/*        onClick={() => this.actions.switchToEditPage()}*/}
                    {/*    >*/}
                    {/*        <div className={styles.topRightDiv11} />*/}
                    {/*        <Space width={8} />*/}
                    {/*        <div className={styles.topRightDiv12}>*/}
                    {/*            {i18n._('Back To Object View')}*/}
                    {/*        </div>*/}
                    {/*    </button>*/}
                    {/*</div>*/}
                    {this.props.headType === HEAD_CNC && (
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
                        </div>
                    )}
                </div>
            </React.Fragment>
        );
    }
}
const mapStateToProps = (state, ownProps) => {
    const headType = ownProps.headType;
    const { displayedType, showToolPath, showSimulation, toolPathGroup, simulationNeedToPreview } = state[headType];
    const canGenerateGcode = toolPathGroup.canGenerateGcode();

    return {
        simulationNeedToPreview,
        canGenerateGcode,
        headType,
        displayedType,
        showToolPath,
        showSimulation
    };
};
const mapDispatchToProps = (dispatch, ownProps) => ({
    showToolPathGroupObject: () => dispatch(editorActions.showToolPathGroupObject(ownProps.headType)),
    showModelGroupObject: () => dispatch(editorActions.showModelGroupObject(ownProps.headType)),
    showToolpathInPreview: (show) => dispatch(editorActions.showToolpathInPreview(ownProps.headType, show)),
    showSimulationInPreview: (show) => dispatch(editorActions.showSimulationInPreview(ownProps.headType, show)),
    commitGenerateViewPath: () => dispatch(editorActions.commitGenerateViewPath(ownProps.headType))
});

export default connect(mapStateToProps, mapDispatchToProps)(VisualizerTopRight);
