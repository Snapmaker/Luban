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
    acceptExtNames = [];

    state = {
        isDragging: false
    };

    componentDidMount() {
        this.acceptExtNames = [];
        if (this.props.accept) {
            const extNames = this.props.accept.split(',');
            for (let i = 0; i < extNames.length; i++) {
                this.acceptExtNames.push(extNames[i].trim().toLowerCase());
            }
        }
    }

    onDrop(acceptedFiles) {
        const onDropAccepted = this.props.onDropAccepted;
        const onDropRejected = this.props.onDropRejected;
        if (this.acceptExtNames.length === 0 || !onDropAccepted || !onDropRejected) {
            return;
        }
        const file = acceptedFiles[0];
        if (this.acceptExtNames.includes(path.extname(file.name).toLowerCase())) {
            onDropAccepted(file);
        } else {
            onDropRejected(file);
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
                        { [styles.hidden]: !(isDragging) }
                    )}
                >
                    <div className={styles['text-block']}>
                        {dragEnterMsg}
                    </div>
                </div>
                <ReactDropzone
                    className={styles.dropzone}
                    disableClick={true}
                    disabled={disabled}
                    disablePreview={true}
                    multiple={false}
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

Dropzone.propTypes = {
    disabled: PropTypes.bool,
    accept: PropTypes.string.isRequired,
    onDropAccepted: PropTypes.func.isRequired,
    onDropRejected: PropTypes.func.isRequired,
    dragEnterMsg: PropTypes.string.isRequired
};

export default Dropzone;
