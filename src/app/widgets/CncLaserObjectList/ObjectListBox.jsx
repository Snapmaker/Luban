import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
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

        modelGroupSelectedModel: PropTypes.object,
        modelGroup: PropTypes.object.isRequired,
        toolPathModelGroup: PropTypes.object.isRequired,
        previewFailed: PropTypes.bool.isRequired
        // selectedModelHideFlag: PropTypes.bool
    };

    // state = {
    //     selectedModelID: ''
    // };

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

    render() {
        const { modelGroup, modelGroupSelectedModel } = this.props;
        const selectedModel = modelGroupSelectedModel;
        return (
            <div>
                <div
                    className={classNames(
                        styles.objectListBox
                    )}
                >
                    {modelGroup.models.map((model) => {
                        const taskInfo = model.getTaskInfo();
                        const modelName = taskInfo.modelName;
                        const modelIcon = () => {
                            if (taskInfo.sourceType === 'text') { return styles.iconText; }
                            if (taskInfo.mode !== 'vector') { return styles.iconPic; }
                            return styles.iconShape;
                        };
                        return (
                            <TipTrigger
                                key={model.modelName}
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
                                        <Anchor
                                            className={classNames(
                                                styles.name,
                                                styles.bt
                                            )}
                                            onClick={() => this.actions.onClickModelNameBox(model)}
                                        >
                                            {modelName}
                                        </Anchor>
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
    const { page, previewFailed, modelGroup, toolPathModelGroup, svgModelGroup, selectedModelHideFlag } = state[ownProps.headType];
    const { headType } = ownProps;
    return {
        headType,
        page,
        modelGroup,
        toolPathModelGroup,
        svgModelGroup,
        workflowState,
        previewFailed,
        // will change better methods next version
        modelGroupLength: modelGroup.models.length,
        modelGroupSelectedModel: modelGroup.getSelectedModel() && modelGroup.getSelectedModel(),
        modelHideFlag: modelGroup.getSelectedModel() && modelGroup.getSelectedModel().hideFlag,
        selectedModelHideFlag
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
