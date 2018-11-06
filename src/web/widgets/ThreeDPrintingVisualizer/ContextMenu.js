import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import styles from './styles.styl';
import { STAGES_3DP } from '../../constants';


class ContextMenu extends PureComponent {
    static propTypes = {
        actions: PropTypes.object.isRequired,
        state: PropTypes.object.isRequired
    };

    render() {
        const { actions, state } = this.props;
        const isModelSelected = !!state.selectedModel;
        const isModelLoaded = (state.stage === STAGES_3DP.modelLoaded);
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
                    onClick={() => {
                        actions.multiplySelectedModel(1);
                    }}
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
                        isModelLoaded ? '' : styles['context-menu__option--disabled']
                    )}
                    onClick={actions.clearBuildPlate}
                >
                    {i18n._('Clear Build Plate')}
                </Anchor>
                <Anchor
                    className={classNames(
                        styles['context-menu__option'],
                        isModelLoaded ? '' : styles['context-menu__option--disabled']
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
