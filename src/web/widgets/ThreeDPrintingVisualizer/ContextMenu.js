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
        const actions = this.props.actions;
        const state = this.props.state;
        const isModelSelected = !!state.selectedModel;
        const isModelLoaded = (state.stage === STAGES_3DP.modelLoaded);
        return (
            <React.Fragment>
                <Anchor
                    className={classNames(
                        styles['contextMenu--option'],
                        isModelSelected ? '' : styles['contextMenu--option__disabled']
                    )}
                    onClick={() => {
                        actions.centerSelectedModel();
                    }}
                >
                    {i18n._('Center Selected Model')}
                </Anchor>
                <Anchor
                    className={classNames(
                        styles['contextMenu--option'],
                        isModelSelected ? '' : styles['contextMenu--option__disabled']
                    )}
                    onClick={() => {
                        actions.deleteSelectedModel();
                    }}
                >
                    {i18n._('Delete Selected Model')}
                </Anchor>
                <Anchor
                    className={classNames(
                        styles['contextMenu--option'],
                        isModelSelected ? '' : styles['contextMenu--option__disabled']
                    )}
                    onClick={() => {
                        actions.multiplySelectedModel(1);
                    }}
                >
                    {i18n._('Duplicate Selected Model')}
                </Anchor>
                <Anchor
                    className={classNames(
                        styles['contextMenu--option'],
                        isModelSelected ? '' : styles['contextMenu--option__disabled']
                    )}
                    onClick={() => {
                        actions.resetSelectedModelTransformation();
                    }}
                >
                    {i18n._('Reset Selected Model Transformation')}
                </Anchor>
                <div
                    className={classNames(styles['contextMenu--separator'])}
                />
                <Anchor
                    className={classNames(
                        styles['contextMenu--option'],
                        isModelLoaded ? '' : styles['contextMenu--option__disabled']
                    )}
                    onClick={() => {
                        actions.clearBuildPlate();
                    }}
                >
                    {i18n._('Clear Build Plate')}
                </Anchor>
                <Anchor
                    className={classNames(
                        styles['contextMenu--option'],
                        isModelLoaded ? '' : styles['contextMenu--option__disabled']
                    )}
                    onClick={() => {
                        actions.arrangeAllModels();
                    }}
                >
                    {i18n._('Arrange All Models')}
                </Anchor>
            </React.Fragment>
        );
    }
}

export default ContextMenu;
