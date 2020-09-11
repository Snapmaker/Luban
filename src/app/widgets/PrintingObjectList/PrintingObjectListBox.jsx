import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import path from 'path';
import { timestamp } from '../../../shared/lib/random-utils';
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
        selectedModelIDArray: PropTypes.array
    };


    actions = {
        onClickSelectModel: (model, event) => {
            this.props.selectTargetModel(model, event.shiftKey);
        },
        onClickHideShowSelectedModel: (model) => {
            const visible = model.visible;
            this.props.selectTargetModel(model);
            if (visible === true) {
                this.props.hideSelectedModel();
            } else {
                this.props.showSelectedModel();
            }
        },
        limitTheLengthOfDisplayName: (name) => {
            let newName = name;
            if (newName.length > 40) {
                newName = `${newName.slice(0, 31)}...${newName.slice(-9)}`;
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


    render() {
        const { modelGroup, selectedModelIDArray } = this.props;
        return (
            <div>
                <div
                    className={classNames(
                        styles.objectListBox
                    )}
                >
                    {(modelGroup.models) && modelGroup.models.map((model) => {
                        const modelName = path.basename(model.originalName, path.extname(model.originalName));
                        const displayModelName = this.actions.limitTheLengthOfDisplayName(modelName);
                        const modelIcon = () => {
                            return styles.iconShape;
                        };
                        return (
                            <TipTrigger
                                key={model.modelName + timestamp()}
                                title={i18n._('object list')}
                                content={modelName}
                            >
                                <div>
                                    <div
                                        className={classNames(
                                            styles.bgr,
                                            selectedModelIDArray.length > 0 && selectedModelIDArray.indexOf(model.modelID) >= 0 ? styles.selected : null,
                                        )}
                                    >
                                        <Anchor
                                            className={classNames(
                                                styles.name,
                                                styles.bt
                                            )}
                                            onClick={(event) => this.actions.onClickSelectModel(model, event)}
                                        >
                                            <span
                                                className={classNames(
                                                    styles.icon,
                                                    modelIcon()
                                                )}
                                            />
                                            <span>
                                                {displayModelName}
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
    const { modelGroup } = state.printing;
    return {
        modelGroup,
        selectedModelIDArray: modelGroup.selectedModelIDArray
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        selectTargetModel: (model, shiftKey) => dispatch(printingActions.selectTargetModel(model, shiftKey)),
        hideSelectedModel: () => dispatch(printingActions.hideSelectedModel()),
        showSelectedModel: () => dispatch(printingActions.showSelectedModel())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(PrintingObjectListBox);
