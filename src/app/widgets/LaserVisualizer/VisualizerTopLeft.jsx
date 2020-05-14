import React, { PureComponent } from 'react';
import path from 'path';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { actions as editorActions } from '../../flux/editor';
import i18n from '../../lib/i18n';
import { PAGE_EDITOR } from '../../constants';
import api from '../../api';
import modal from '../../lib/modal';

class VisualizerTopLeft extends PureComponent {
    static propTypes = {
        canUndo: PropTypes.bool.isRequired,
        canRedo: PropTypes.bool.isRequired,
        undo: PropTypes.func.isRequired,
        redo: PropTypes.func.isRequired,
        uploadImage: PropTypes.func.isRequired,
        setAutoPreview: PropTypes.func.isRequired,
        togglePage: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    actions = {
        onChangeFile: (event) => {
            const file = event.target.files[0];
            const extname = path.extname(file.name).toLowerCase();
            let uploadMode;
            if (extname === '.svg') {
                uploadMode = 'vector';
            } else if (extname === '.dxf') {
                uploadMode = 'vector';
            } else {
                uploadMode = 'bw';
            }

            this.props.togglePage(PAGE_EDITOR);
            if (uploadMode === 'trace') {
                const formData = new FormData();
                formData.append('image', file);
                api.uploadImage(formData)
                    .then(async (res) => {
                        this.actions.updateOptions({
                            originalName: res.body.originalName,
                            uploadName: res.body.uploadName,
                            width: res.body.width,
                            height: res.body.height
                        });
                    });
            } else {
                if (uploadMode === 'greyscale') {
                    this.props.setAutoPreview(false);
                }
                this.props.uploadImage(file, uploadMode, () => {
                    modal({
                        title: i18n._('Parse Image Error'),
                        body: i18n._('Failed to parse image file {{filename}}', { filename: file.name })
                    });
                });
            }
        },
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        undo: () => {
            this.props.undo();
        },
        redo: () => {
            this.props.redo();
        }
    };

    render() {
        // const actions = this.actions;
        // eslint-disable-next-line no-unused-vars
        const { canUndo, canRedo } = this.props;

        return (
            <React.Fragment>
                <input
                    ref={this.fileInput}
                    type="file"
                    accept=".svg, .png, .jpg, .jpeg, .bmp, .dxf"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={this.actions.onChangeFile}
                />
                <button
                    type="button"
                    className="sm-btn-small sm-btn-primary"
                    style={{ float: 'left' }}
                    title={i18n._('Open File')}
                    onClick={() => this.actions.onClickToUpload()}
                >
                    {i18n._('Open File')}
                </button>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { canUndo, canRedo } = state.laser;

    return {
        canUndo,
        canRedo
    };
};

const mapDispatchToProps = (dispatch) => ({
    undo: () => dispatch(editorActions.undo('laser')),
    redo: () => dispatch(editorActions.redo('laser')),
    setAutoPreview: (value) => dispatch(editorActions.setAutoPreview('laser', value)),
    uploadImage: (file, mode, onFailure) => dispatch(editorActions.uploadImage('laser', file, mode, onFailure)),
    togglePage: (page) => dispatch(editorActions.togglePage('laser', page))
});


export default connect(mapStateToProps, mapDispatchToProps)(VisualizerTopLeft);
