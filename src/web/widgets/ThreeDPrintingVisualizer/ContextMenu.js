import React, { PureComponent } from 'react';
import classNames from 'classnames';
import styles from './styles.styl';
import { STAGES_3DP } from '../../constants';

class ContextMenu extends PureComponent {
    render() {
        const actions = this.props.actions;
        const state = this.props.state;
        const isModelSelected = (state.selectedModel !== undefined);
        const isModelLoaded = (state.stage === STAGES_3DP.modelLoaded);
        return (
            <React.Fragment>
                <div
                    role="button"
                    tabIndex="0"
                    className={classNames(
                        styles['contextMenu--option'],
                        isModelSelected ? '' : styles['contextMenu--option__disabled']
                    )}
                    onClick={() => {
                        actions.centerSelectedModel();
                    }}
                >
                    {'Center Selected Model'}
                </div>
                <div
                    role="button"
                    tabIndex="0"
                    className={classNames(
                        styles['contextMenu--option'],
                        isModelSelected ? '' : styles['contextMenu--option__disabled']
                    )}
                    onClick={() => {
                        actions.deleteSelectedModel();
                    }}
                >
                    {'Delete Selected Model'}
                </div>
                <div
                    role="button"
                    tabIndex="0"
                    className={classNames(
                        styles['contextMenu--option'],
                        isModelSelected ? '' : styles['contextMenu--option__disabled']
                    )}
                    onClick={() => {
                        actions.multiplySelectedModel(1);
                    }}
                >
                    {'Duplicate Selected Model'}
                </div>
                <div
                    role="button"
                    tabIndex="0"
                    className={classNames(
                        styles['contextMenu--option'],
                        isModelSelected ? '' : styles['contextMenu--option__disabled']
                    )}
                    onClick={() => {
                        actions.resetSelectedModelTransformation();
                    }}
                >
                    {'Reset Selected Model Transformation'}
                </div>
                <div
                    className={classNames(styles['contextMenu--separator'])}
                />
                <div
                    role="button"
                    tabIndex="0"
                    className={classNames(
                        styles['contextMenu--option'],
                        isModelLoaded ? '' : styles['contextMenu--option__disabled']
                    )}
                    onClick={() => {
                        actions.clearBuildPlate();
                    }}
                >
                    {'Clear Build Plate'}
                </div>
                <div
                    role="button"
                    tabIndex="0"
                    className={classNames(
                        styles['contextMenu--option'],
                        isModelLoaded ? '' : styles['contextMenu--option__disabled']
                    )}
                    onClick={() => {
                        actions.arrangeAllModels();
                    }}
                >
                    {'Arrange All Models'}
                </div>
            </React.Fragment>
        );
    }
}

export default ContextMenu;
