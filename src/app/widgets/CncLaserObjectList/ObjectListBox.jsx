import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
// import FileSaver from 'file-saver';
import { connect } from 'react-redux';
import classNames from 'classnames';
import styles from './styles.styl';
// import request from 'superagent';
import { actions as editorActions } from '../../flux/editor';
import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import Thumbnail from '../CncLaserShared/Thumbnail';
import { actions as widgetActions } from '../../flux/widget';
import TipTrigger from '../../components/TipTrigger';
// import { TextInput as Input } from '../../components/Input';

class ObjectListBox extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        selectModelByID: PropTypes.func.isRequired,
        minimized: PropTypes.bool.isRequired,
        hideSelectedModel: PropTypes.func.isRequired,
        showSelectedModel: PropTypes.func.isRequired,

        headType: PropTypes.string.isRequired,
        modelGroup: PropTypes.object.isRequired,
        modelGroupSelectedModel: PropTypes.object.isRequired,
        toolPathModelGroup: PropTypes.object.isRequired,
        previewFailed: PropTypes.bool.isRequired
    };

    thumbnail = React.createRef();

    contextMenuRef = React.createRef();

    actions = {
        onClickModelNameBox: (model) => {
            this.props.selectModelByID(model.modelID);
        },

        onClickModelHideBox: (model) => {
            const hideFlag = model.hideFlag;
            this.props.selectModelByID(model.modelID);
            if (!hideFlag) {
                this.props.hideSelectedModel(model);
            } else {
                this.props.showSelectedModel(model);
            }
            this.props.selectModelByID(model.modelID);
        }
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Object List'));
    }

    componentDidMount() {
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.previewFailed && !this.props.previewFailed) {
            modal({
                title: i18n._('Failed to preview'),
                body: i18n._('Failed to preview, please modify parameters and try again.')
            });
        }
    }

    showContextMenu = (event) => {
        console.log('----2----', event);
        this.contextMenuRef.current.show(event);
    };


    render() {
        // const actions = this.actions;
        const { modelGroup, modelGroupSelectedModel, headType, toolPathModelGroup } = this.props;
        const selectedModel = modelGroupSelectedModel;
        // const isModelSelected = !!this.props.selectedModel;
        console.log(headType); // ----1----
        console.log(toolPathModelGroup.selectedToolPathModel);
        return (
            <div>
                <div
                    className={classNames(
                        styles.objectListBox
                    )}
                >
                    {modelGroup.models.map(model => {
                        const taskInfo = model.getTaskInfo();
                        const modelName = taskInfo.modelName;
                        const modelIcon = () => {
                            if (taskInfo.sourceType === 'text') { return styles.iconText; }
                            if (taskInfo.mode !== 'vector') { return styles.iconPic; }
                            return styles.iconShape;
                        };
                        return (
                            <TipTrigger
                                title={i18n._('object list')}
                                content={model.modelName}
                            >
                                <div
                                    onContextMenu={this.showContextMenu}
                                >
                                    <div
                                        className={classNames(
                                            styles.bgr,
                                            selectedModel && selectedModel.modelID === model.modelID ? styles.selected : null,
                                        )}
                                    >
                                        <span
                                            className={classNames(
                                                styles.icon,
                                                modelIcon()
                                            )}
                                        />
                                        <text
                                            className={classNames(
                                                styles.name,
                                                styles.bt
                                            )}
                                            onClick={() => this.actions.onClickModelNameBox(model)}
                                        >
                                            {modelName}
                                        </text>
                                        <button
                                            type="button"
                                            className={classNames(
                                                styles.icon,
                                                taskInfo.hideFlag ? styles.iconHideClose : styles.iconHideOpen,
                                                styles.bt
                                            )}
                                            onClick={() => this.actions.onClickModelHideBox(model)}
                                        />
                                    </div>
                                </div>
                            </TipTrigger>
                        );
                    })}
                </div>
                <Thumbnail
                    ref={this.thumbnail}
                    modelGroup={this.props.modelGroup}
                    toolPathModelGroup={this.props.toolPathModelGroup}
                    minimized={this.props.minimized}
                />
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { workflowState } = state.machine;
    const { page, previewFailed, modelGroup, toolPathModelGroup, svgModelGroup } = state[ownProps.headType];
    const { headType } = ownProps;
    return {
        headType,
        page,
        modelGroup,
        toolPathModelGroup,
        svgModelGroup,
        workflowState,
        previewFailed,
        modelGroupSelectedModel: modelGroup.getSelectedModel() && modelGroup.getSelectedModel(),
        modelHideFlag: modelGroup.getSelectedModel() && modelGroup.getSelectedModel().hideFlag,
        modelGroupLength: modelGroup.models.length
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        togglePage: (page) => dispatch(editorActions.togglePage(ownProps.headType, page)),
        updateWidgetState: (state) => dispatch(widgetActions.updateWidgetState(ownProps.widgetId, '', state)),
        selectModelByID: (modelID) => dispatch(editorActions.selectModelByID(ownProps.headType, modelID)),
        hideSelectedModel: () => dispatch(editorActions.hideSelectedModel(ownProps.headType)),
        showSelectedModel: () => dispatch(editorActions.showSelectedModel(ownProps.headType))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ObjectListBox);
