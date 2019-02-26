import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import styles from './styles.styl';


class VisualizerTopLeft extends PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
            onChangeFile: PropTypes.func.isRequired
        }),
        modelGroup: PropTypes.object.isRequired
    };

    fileInput = React.createRef();
    modelGroup = null;

    constructor(props) {
        super(props);
        this.modelGroup = this.props.modelGroup;
        this.modelGroup.addChangeListener((args) => {
            const { canUndo, canRedo } = args;
            this.setState({
                canUndo: canUndo,
                canRedo: canRedo
            });
        });
    }

    state = {
        canUndo: false,
        canRedo: false
    };

    actions = {
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        undo: () => {
            this.modelGroup.undo();
        },
        redo: () => {
            this.modelGroup.redo();
        }
    };

    render() {
        const actions = { ...this.props.actions, ...this.actions };
        const state = this.state;
        return (
            <React.Fragment>
                <input
                    ref={this.fileInput}
                    type="file"
                    accept=".stl, .obj"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                <button
                    type="button"
                    className={classNames(styles['btn-small'], styles['btn-primary'])}
                    style={{ float: 'left' }}
                    title={i18n._('Upload File')}
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
            </React.Fragment>
        );
    }
}

export default VisualizerTopLeft;
