import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import { actions as editorActions } from '../../flux/editor';
import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';

class ObjectListBox extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        selectTargetModel: PropTypes.func.isRequired,
        hideSelectedModel: PropTypes.func.isRequired,
        showSelectedModel: PropTypes.func.isRequired,

        modelGroup: PropTypes.object.isRequired,
        selectedModelArray: PropTypes.array,
        // toolPathModelGroup: PropTypes.object.isRequired,
        previewFailed: PropTypes.bool.isRequired
    };


    thumbnail = React.createRef();

    contextMenuRef = React.createRef();

    actions = {
        onClickModelNameBox: (model, event) => {
            let isMultiSelect = event.shiftKey;
            if (this.props.selectedModelArray.length === 1 && this.props.selectedModelArray[0].visible === false) {
                isMultiSelect = false;
            }
            if (this.props.selectedModelArray && this.props.selectedModelArray.length > 0 && model.visible === false) {
                isMultiSelect = false;
            }
            this.props.selectTargetModel(model, isMultiSelect);
        },

        onClickModelHideBox: (model) => {
            const visible = model.visible;
            this.props.selectTargetModel(model);
            if (visible) {
                this.props.hideSelectedModel(model);
            } else {
                this.props.showSelectedModel(model);
            }
        },
        limitTheLengthOfDisplayName: (name) => {
            let newName = name;
            if (newName.length > 36) {
                newName = `${newName.slice(0, 27)}...${newName.slice(-9)}`;
            }
            return newName;
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
        const { modelGroup, selectedModelArray } = this.props;
        return (
            <div>
                <div className={styles['object-list-box']}>
                    {modelGroup.models.map((model) => {
                        const taskInfo = model.getTaskInfo();
                        const modelName = taskInfo.modelName;
                        const displayModelName = this.actions.limitTheLengthOfDisplayName(modelName);
                        const modelIcon = () => {
                            if (taskInfo.sourceType === 'text') {
                                return styles.iconText;
                            }
                            if (taskInfo.mode !== 'vector') {
                                return styles.iconPic;
                            }
                            return styles.iconShape;
                        };
                        return (
                            <TipTrigger
                                key={model.modelName}
                                title={i18n._('Object')}
                                content={model.modelName}
                            >
                                <div>
                                    <div
                                        className={classNames(
                                            styles['object-list-item'],
                                            selectedModelArray && selectedModelArray.includes(model) ? styles.selected : null,
                                        )}
                                    >
                                        <Anchor
                                            className={classNames(
                                                styles.name,
                                                styles.bt
                                            )}
                                            onClick={(event) => this.actions.onClickModelNameBox(model, event)}
                                        >
                                            <span
                                                className={classNames(
                                                    styles.icon,
                                                    modelIcon()
                                                )}
                                            />
                                            {displayModelName}
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
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { workflowState } = state.machine;
    const { page, previewFailed, modelGroup, toolPathModelGroup } = state[ownProps.headType];
    const { selectedModelArray } = modelGroup;
    const { headType } = ownProps;
    return {
        models: modelGroup.models,
        headType,
        page,
        modelGroup,
        selectedModelArray,
        toolPathModelGroup,
        workflowState,
        previewFailed
        // modelVisible: modelGroup.getSelectedModel().visible
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        selectTargetModel: (model, shiftKey) => dispatch(editorActions.selectTargetModel(model, ownProps.headType, shiftKey)),
        hideSelectedModel: () => dispatch(editorActions.hideSelectedModel(ownProps.headType)),
        showSelectedModel: () => dispatch(editorActions.showSelectedModel(ownProps.headType))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ObjectListBox);
