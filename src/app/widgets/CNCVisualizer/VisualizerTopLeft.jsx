import React, { PureComponent } from 'react';
import path from 'path';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import i18n from '../../lib/i18n';
import { PAGE_EDITOR } from '../../constants';
import modal from '../../lib/modal';
import { actions as editorActions } from '../../flux/editor';

class VisualizerTopLeft extends PureComponent {
    static propTypes = {
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
                uploadMode = 'greyscale';
            }

            this.props.togglePage(PAGE_EDITOR);
            if (uploadMode === 'greyscale') {
                this.props.setAutoPreview(false);
            }
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
    setAutoPreview: (value) => dispatch(editorActions.setAutoPreview('cnc', value)),
    uploadImage: (file, mode, onFailure) => dispatch(editorActions.uploadImage('cnc', file, mode, onFailure)),
    togglePage: (page) => dispatch(editorActions.togglePage('cnc', page))
});


export default connect(null, mapDispatchToProps)(VisualizerTopLeft);
