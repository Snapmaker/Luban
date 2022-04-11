import React, { PureComponent } from 'react';
import path from 'path';
import ReactDropzone from 'react-dropzone';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import styles from './index.styl';


// react-dropzone doc: https://react-dropzone.js.org/
// do not use the "accept" prop.
// use file extension
class Dropzone extends PureComponent {
    static propTypes = {
        children: PropTypes.node.isRequired,
        disabled: PropTypes.bool,
        accept: PropTypes.string.isRequired,
        onDropAccepted: PropTypes.func.isRequired,
        onDropRejected: PropTypes.func.isRequired,
        dragEnterMsg: PropTypes.string.isRequired,
        multiple: PropTypes.bool
    };

    state = {
        isDragging: false
    };

    onDrop(acceptedFiles) {
        const onDropAccepted = this.props.onDropAccepted;
        const onDropRejected = this.props.onDropRejected;

        const acceptExtNames = this.props.accept.split(',').map(name => name.trim().toLowerCase());
        if (acceptExtNames.length === 0 || !onDropAccepted || !onDropRejected) {
            return;
        }
        const files = acceptedFiles.filter((file) => {
            return acceptExtNames.includes(path.extname(file.name).toLowerCase());
        });

        if (files.length > 0) {
            if (this.props.multiple === true && files.length !== acceptedFiles.length) {
                onDropRejected();
            }
            onDropAccepted(this.props.multiple === true ? files : files[0]);
        } else {
            onDropRejected();
        }
    }

    render() {
        const { disabled = false, dragEnterMsg = '', children = null } = this.props;
        const isDragging = this.state.isDragging;


        return (
            <div>
                <div
                    className={classNames(
                        styles['dropzone-overlay'],
                        { [styles.hidden]: !(isDragging) },
                    )}
                >
                    <div className={styles['text-block']}>
                        {dragEnterMsg}
                    </div>
                </div>
                <ReactDropzone
                    className={styles.dropzone}
                    disableClick
                    disablePreview
                    disabled={disabled}
                    multiple={this.props.multiple || false}
                    onDragEnter={() => {
                        if (!isDragging) {
                            this.setState({ isDragging: true });
                        }
                    }}
                    onDragLeave={() => {
                        if (isDragging) {
                            this.setState({ isDragging: false });
                        }
                    }}
                    onDrop={(acceptedFiles) => {
                        this.setState({ isDragging: false });
                        this.onDrop(acceptedFiles);
                    }}
                >
                    {children}
                </ReactDropzone>
            </div>
        );
    }
}

export default Dropzone;
