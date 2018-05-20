import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
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

    canUndo() {
        const state = this.props.state;
        return state.undoMatrix4Array.length > 1;
    }

    canRedo() {
        const state = this.props.state;
        return state.redoMatrix4Array.length >= 1;
    }

    render() {
        const actions = {
            ...this.props.actions,
            ...this.actions
        };

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
                    Upload File
                </button>
                <Anchor
                    componentClass="button"
                    className={styles['btn-top-left']}
                    onClick={actions.onUndo}
                    disabled={!this.canUndo()}
                >
                    <div className={styles['btn-undo']} />
                </Anchor>
                <Anchor
                    componentClass="button"
                    className={styles['btn-top-left']}
                    onClick={actions.onRedo}
                    disabled={!this.canRedo()}
                >
                    <div className={styles['btn-redo']} />
                </Anchor>
                <Anchor
                    componentClass="button"
                    className={styles['btn-top-left']}
                    onClick={actions.onReset}
                    disabled={!this.canUndo() && !this.canRedo()}
                >
                    <div className={styles['btn-reset']} />
                </Anchor>
            </React.Fragment>
        );
    }
}

export default VisualizerTopLeft;
