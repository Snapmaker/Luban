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
import TipTrigger from '../../components/TipTrigger';

class ObjectListBox extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        selectModelByID: PropTypes.func.isRequired,
        minimized: PropTypes.bool.isRequired,
        hideSelectedModel: PropTypes.func.isRequired,
        showSelectedModel: PropTypes.func.isRequired,

        modelGroup: PropTypes.object.isRequired,
        selectedModelID: PropTypes.string,
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
            const visible = model.visible;
            this.props.selectModelByID(model.modelID);
            if (visible) {
                this.props.hideSelectedModel(model);
            } else {
                this.props.showSelectedModel(model);
            }
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
        const { modelGroup, selectedModelID } = this.props;
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
                                            selectedModelID && selectedModelID === model.modelID ? styles.selected : null,
                                        )}
                                    >
                                        <Anchor
                                            className={classNames(
                                                styles.name,
                                                styles.bt
                                            )}
                                            onClick={() => this.actions.onClickModelNameBox(model)}
                                        >
                                            <span
                                                className={classNames(
                                                    styles.icon,
                                                    modelIcon()
                                                )}
                                            />
                                            {modelName}
                                        </Anchor>
                                        <button
                                            type="button"
                                            className={classNames(
                                                styles.icon,
                                                taskInfo.visible ? styles.iconHideOpen : styles.iconHideClose,
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
    const { page, previewFailed, selectedModelID, modelGroup, toolPathModelGroup } = state[ownProps.headType];
    const { headType } = ownProps;
    return {
        headType,
        page,
        modelGroup,
        selectedModelID,
        toolPathModelGroup,
        workflowState,
        previewFailed,
        modelVisible: modelGroup.getSelectedModel() && modelGroup.getSelectedModel().visible
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        selectModelByID: (modelID) => dispatch(editorActions.selectModelByID(ownProps.headType, modelID)),
        hideSelectedModel: () => dispatch(editorActions.hideSelectedModel(ownProps.headType)),
        showSelectedModel: () => dispatch(editorActions.showSelectedModel(ownProps.headType))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ObjectListBox);
