import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import path from 'path';
// import { ListIconOpen, ListIconClose, IconLock } from 'snapmaker-react-icon';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import { actions as printingActions } from '../../flux/printing';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';

class PrintingObjectListBox extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        selectTargetModel: PropTypes.func.isRequired,
        hideSelectedModel: PropTypes.func.isRequired,
        showSelectedModel: PropTypes.func.isRequired,

        modelGroup: PropTypes.object.isRequired,
        selectedModelID: PropTypes.string
    };


    actions = {
        onClickSelectModel: (model) => {
            this.props.selectTargetModel(model);
        },
        onClickHideShowSelectedModel: (model) => {
            const visible = model.visible;
            this.props.selectTargetModel(model);
            if (visible) {
                this.props.hideSelectedModel();
            } else {
                this.props.showSelectedModel();
            }
        }

    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Object List'));
    }

    componentDidMount() {
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
                    {(modelGroup.models) && modelGroup.models.map((model, index) => {
                        let modelName = path.basename(model.originalName, path.extname(model.originalName));
                        if (index > 0 && model.modelName) {
                            modelName += model.modelName.match(/\(\d/)[0].replace(/\(/, ' ');
                        }
                        const modelIcon = () => {
                            return styles.iconShape;
                        };
                        return (
                            <TipTrigger
                                key={model.modelName}
                                title={i18n._('object list')}
                                content={modelName}
                            >
                                <div>
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
                                            onClick={() => this.actions.onClickSelectModel(model)}
                                        >
                                            <span
                                                className={classNames(
                                                    styles.icon,
                                                    modelIcon()
                                                )}
                                            />
                                            <span>
                                                {modelName}
                                            </span>
                                        </Anchor>
                                        <button
                                            type="button"
                                            className={classNames(
                                                styles.icon,
                                                model.visible ? styles.iconHideOpen : styles.iconHideClose,
                                                styles.bt
                                            )}
                                            onClick={() => this.actions.onClickHideShowSelectedModel(model)}
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

const mapStateToProps = (state) => {
    const { selectedModelID, modelGroup, visible } = state.printing;
    return {
        modelGroup,
        selectedModelID,
        visible
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        selectTargetModel: (model) => dispatch(printingActions.selectTargetModel(model)),
        hideSelectedModel: () => dispatch(printingActions.hideSelectedModel()),
        showSelectedModel: () => dispatch(printingActions.showSelectedModel())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(PrintingObjectListBox);
