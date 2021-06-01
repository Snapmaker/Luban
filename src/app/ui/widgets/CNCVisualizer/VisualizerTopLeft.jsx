import React, { PureComponent } from 'react';
import path from 'path';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import i18n from '../../../lib/i18n';
import { PAGE_EDITOR, PROCESS_MODE_GREYSCALE, PROCESS_MODE_MESH, PROCESS_MODE_VECTOR } from '../../../constants';
import modal from '../../../lib/modal';
import { actions as editorActions } from '../../../flux/editor';

class VisualizerTopLeft extends PureComponent {
    static propTypes = {
        uploadImage: PropTypes.func.isRequired,
        switchToPage: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    actions = {
        onChangeFile: (event) => {
            const file = event.target.files[0];
            const extname = path.extname(file.name).toLowerCase();
            let uploadMode;
            if (extname.toLowerCase() === '.svg') {
                uploadMode = PROCESS_MODE_VECTOR;
            } else if (extname.toLowerCase() === '.dxf') {
                uploadMode = PROCESS_MODE_VECTOR;
            } else if (extname.toLowerCase() === '.stl') {
                uploadMode = PROCESS_MODE_MESH;
            } else {
                uploadMode = PROCESS_MODE_GREYSCALE;
            }

            // Switch to PAGE_EDITOR page if new image being uploaded
            this.props.switchToPage(PAGE_EDITOR);

            this.props.uploadImage(file, uploadMode, () => {
                modal({
                    title: i18n._('Parse Error'),
                    body: i18n._('Failed to parse image file {{filename}}.', { filename: file.name })
                });
            });
        },
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        }
    };

    render() {
        return (
            <React.Fragment>
                <input
                    ref={this.fileInput}
                    type="file"
                    accept=".svg, .png, .jpg, .jpeg, .bmp, .dxf, .stl"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={this.actions.onChangeFile}
                />
                <button
                    type="button"
                    className="sm-btn-small sm-btn-primary"
                    style={{ float: 'left' }}
                    title={i18n._('Add...')}
                    onClick={() => this.actions.onClickToUpload()}
                >
                    {i18n._('Add...')}
                </button>
            </React.Fragment>
        );
    }
}

const mapDispatchToProps = (dispatch) => ({
    uploadImage: (file, mode, onFailure) => dispatch(editorActions.uploadImage('cnc', file, mode, onFailure)),
    switchToPage: (page) => dispatch(editorActions.switchToPage('cnc', page))
});


export default connect(null, mapDispatchToProps)(VisualizerTopLeft);
