import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import connect from 'react-redux/es/connect/connect';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import styles from './styles.styl';
import { actions as printingActions } from '../../reducers/printing';
import modal from '../../lib/modal';


class VisualizerTopLeft extends PureComponent {
    static propTypes = {
        modelGroup: PropTypes.object.isRequired,
        canUndo: PropTypes.bool.isRequired,
        canRedo: PropTypes.bool.isRequired,
        uploadFile3d: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    actions = {
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        onChangeFile: (event) => {
            const file = event.target.files[0];
            this.props.uploadFile3d(file, () => {
                modal({
                    title: i18n._('Parse File Error'),
                    body: i18n._('Failed to parse 3d file {{filename}}', { filename: file.filename })
                });
            });
        },
        undo: () => {
            this.props.modelGroup.undo();
        },
        redo: () => {
            this.props.modelGroup.redo();
        }
    };

    render() {
        const actions = this.actions;
        const { canUndo, canRedo } = this.props;
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
                    disabled={!canUndo}
                >
                    <div className={styles['btn-undo']} />
                </Anchor>
                <Anchor
                    componentClass="button"
                    className={styles['btn-top-left']}
                    onClick={actions.redo}
                    disabled={!canRedo}
                >
                    <div className={styles['btn-redo']} />
                </Anchor>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const printing = state.printing;
    const { modelGroup, canUndo, canRedo } = printing;

    return {
        modelGroup,
        canUndo,
        canRedo
    };
};

const mapDispatchToProps = (dispatch) => ({
    uploadFile3d: (file, onError) => dispatch(printingActions.uploadFile3d(file, onError))
});


export default connect(mapStateToProps, mapDispatchToProps)(VisualizerTopLeft);
