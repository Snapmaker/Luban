import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
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
        uploadModel: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    actions = {
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        onChangeFile: async (event) => {
            const file = event.target.files[0];
            try {
                await this.props.uploadModel(file);
            } catch (e) {
                modal({
                    title: i18n._('Failed to upload model'),
                    body: e.message
                });
            }
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
                    className="sm-btn-small sm-btn-primary"
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
    uploadModel: (file) => dispatch(printingActions.uploadModel(file))
});


export default connect(mapStateToProps, mapDispatchToProps)(VisualizerTopLeft);
