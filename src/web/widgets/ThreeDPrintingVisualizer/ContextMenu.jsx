import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import styles from './styles.styl';


class ContextMenu extends PureComponent {
    static propTypes = {
        modelGroup: PropTypes.object.isRequired
    };

    state = {
        hasModel: false,
        selectedModel: null
    };

    constructor(props) {
        super(props);
        this.modelGroup = this.props.modelGroup;
        this.modelGroup.addChangeListener((args) => {
            const { hasModel, model } = args;
            this.setState({
                hasModel: hasModel,
                selectedModel: model
            });
        });
    }

    actions = {
        centerSelectedModel: () => {
            this.modelGroup.transformSelectedModel({ posX: 0, posZ: 0 }, true);
        },
        deleteSelectedModel: () => {
            this.modelGroup.removeSelectedModel();
        },
        duplicateSelectedModel: () => {
            this.modelGroup.multiplySelectedModel(1);
        },
        resetSelectedModelTransformation: () => {
            this.modelGroup.resetSelectedModelTransformation();
        },
        clearBuildPlate: () => {
            this.modelGroup.removeAllModels();
        },
        arrangeAllModels: () => {
            this.modelGroup.arrangeAllModels();
        },
        layFlatSelectedModel: () => {
            this.modelGroup.layFlatSelectedModel();
        }
    };

    render() {
        const actions = this.actions;
        const isModelSelected = !!this.state.selectedModel;
        const hasModel = this.state.hasModel;
        return (
            <React.Fragment>
                <Anchor
                    className={classNames(
                        styles['context-menu__option'],
                        isModelSelected ? '' : styles['context-menu__option--disabled']
                    )}
                    onClick={actions.centerSelectedModel}
                >
                    {i18n._('Center Selected Model')}
                </Anchor>
                <Anchor
                    className={classNames(
                        styles['context-menu__option'],
                        isModelSelected ? '' : styles['context-menu__option--disabled']
                    )}
                    onClick={actions.deleteSelectedModel}
                >
                    {i18n._('Delete Selected Model')}
                </Anchor>
                <Anchor
                    className={classNames(
                        styles['context-menu__option'],
                        isModelSelected ? '' : styles['context-menu__option--disabled']
                    )}
                    onClick={actions.duplicateSelectedModel}
                >
                    {i18n._('Duplicate Selected Model')}
                </Anchor>
                <Anchor
                    className={classNames(
                        styles['context-menu__option'],
                        isModelSelected ? '' : styles['context-menu__option--disabled']
                    )}
                    onClick={actions.resetSelectedModelTransformation}
                >
                    {i18n._('Reset Selected Model Transformation')}
                </Anchor>
                <Anchor
                    className={classNames(
                        styles['context-menu__option'],
                        isModelSelected ? '' : styles['context-menu__option--disabled']
                    )}
                    onClick={actions.layFlatSelectedModel}
                >
                    {i18n._('Lay Flat Selected Model')}
                </Anchor>
                <div
                    className={classNames(styles['context-menu__separator'])}
                />
                <Anchor
                    className={classNames(
                        styles['context-menu__option'],
                        hasModel ? '' : styles['context-menu__option--disabled']
                    )}
                    onClick={actions.clearBuildPlate}
                >
                    {i18n._('Clear Build Plate')}
                </Anchor>
                <Anchor
                    className={classNames(
                        styles['context-menu__option'],
                        hasModel ? '' : styles['context-menu__option--disabled']
                    )}
                    onClick={actions.arrangeAllModels}
                >
                    {i18n._('Arrange All Models')}
                </Anchor>
            </React.Fragment>
        );
    }
}

export default ContextMenu;

