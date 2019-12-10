import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import styles from './styles.styl';
import { actions as printingActions } from '../../flux/printing';
import modal from '../../lib/modal';
import { CONNECTION_TYPE_WIFI } from '../../constants';
import FileTransitModal from '../WorkspaceVisualizer/FileTransitModal';


class VisualizerTopLeft extends PureComponent {
    static propTypes = {
        canUndo: PropTypes.bool.isRequired,
        canRedo: PropTypes.bool.isRequired,
        gcodeLine: PropTypes.object,
        isConnected: PropTypes.bool.isRequired,
        connectionType: PropTypes.string.isRequired,
        uploadModel: PropTypes.func.isRequired,
        undo: PropTypes.func.isRequired,
        redo: PropTypes.func.isRequired
    };

    state = {
        fileTransitModalVisible: false
    }

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
            this.props.undo();
        },
        redo: () => {
            this.props.redo();
        }
    };

    render() {
        const actions = this.actions;
        const { canUndo, canRedo, gcodeLine, isConnected, connectionType } = this.props;
        const { fileTransitModalVisible } = this.state;
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
                {isConnected && connectionType === CONNECTION_TYPE_WIFI && (
                    <div className="btn-group btn-group-sm">
                        <button
                            type="button"
                            className="sm-btn-small sm-btn-primary"
                            style={{
                                marginLeft: '10px'
                            }}
                            disabled={!gcodeLine}
                            onClick={actions.handleSend}
                            title={i18n._('File Transit via Wi-Fi')}
                        >
                            {i18n._('File Transit via Wi-Fi')}
                        </button>
                    </div>
                )}
                {fileTransitModalVisible && (
                    <FileTransitModal
                        // gcodeList={this.props.gcodeList}
                        onClose={this.actions.handleCancelSend}
                    />
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { isConnected, connectionType } = state.machine;
    const printing = state.printing;
    const { canUndo, canRedo, gcodeLine } = printing;

    return {
        canUndo,
        canRedo,
        gcodeLine,
        isConnected,
        connectionType
    };
};

const mapDispatchToProps = (dispatch) => ({
    uploadModel: (file) => dispatch(printingActions.uploadModel(file)),
    undo: () => dispatch(printingActions.undo()),
    redo: () => dispatch(printingActions.redo())
});


export default connect(mapStateToProps, mapDispatchToProps)(VisualizerTopLeft);
