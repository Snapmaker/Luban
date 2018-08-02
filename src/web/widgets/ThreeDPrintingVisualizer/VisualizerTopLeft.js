import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import styles from './styles.styl';


class VisualizerTopLeft extends PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
            onChangeFile: PropTypes.func
        }),
        state: PropTypes.object
    };

    fileInputEl = null;

    actions = {
        onClickToUpload: () => {
            this.fileInputEl.value = null;
            this.fileInputEl.click();
        }
    };

    render() {
        const actions = { ...this.props.actions, ...this.actions };
        const state = this.props.state;
        return (
            <React.Fragment>
                <input
                    ref={(node) => {
                        this.fileInputEl = node;
                    }}
                    type="file"
                    accept=".stl, .obj"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-upload'])}
                    title="Upload File"
                    onClick={actions.onClickToUpload}
                >
                    {i18n._('Upload File')}
                </button>
                <Anchor
                    componentClass="button"
                    className={styles['btn-top-left']}
                    onClick={actions.undo}
                    disabled={!state.canUndo}
                >
                    <div className={styles['btn-undo']} />
                </Anchor>
                <Anchor
                    componentClass="button"
                    className={styles['btn-top-left']}
                    onClick={actions.redo}
                    disabled={!state.canRedo}
                >
                    <div className={styles['btn-redo']} />
                </Anchor>
                <Anchor
                    componentClass="button"
                    className={styles['btn-top-left']}
                    onClick={() => {
                        actions.removeModelFromParent(state.selectedModel);
                    }}
                    disabled={state.selectedModel === undefined}
                >
                    <div className={styles['btn-reset']} />
                </Anchor>
            </React.Fragment>
        );
    }
}

export default VisualizerTopLeft;
