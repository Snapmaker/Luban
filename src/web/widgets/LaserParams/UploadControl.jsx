import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import styles from './styles.styl';


// Upload Control for laser parameters widget
class UploadControl extends PureComponent {
    static propTypes = {
        accept: PropTypes.string.isRequired,
        onChangeFile: PropTypes.func.isRequired,
        filename: PropTypes.string.isRequired,
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired
    };

    fileInput = null;

    onClickUpload = () => {
        this.fileInput.value = null;
        this.fileInput.click();
    };

    render() {
        const { accept, onChangeFile, filename, width, height, ...rest } = this.props;

        return (
            <div {...rest}>
                <input
                    ref={(node) => {
                        this.fileInput = node;
                    }}
                    type="file"
                    accept={accept}
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={onChangeFile}
                />
                <div style={{ display: 'inline-block', float: 'left', marginTop: '5px' }}>
                    <button
                        type="button"
                        className={classNames(styles['btn-small'], styles['btn-default'])}
                        title={i18n._('Upload Image')}
                        onClick={this.onClickUpload}
                    >
                        {i18n._('Upload Image')}
                    </button>
                </div>
                <div style={{ display: 'inline-block', marginLeft: '10px' }}>
                    <div><span className={styles['description-text']}>{filename}</span></div>
                    <div><span className={styles['description-text']}>{width} x {height}</span></div>
                </div>
            </div>
        );
    }
}

export default UploadControl;
