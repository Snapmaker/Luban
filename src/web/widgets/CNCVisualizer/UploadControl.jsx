import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import styles from './styles.styl';


class UploadControl extends PureComponent {
    static propTypes = {
        onChangeFile: PropTypes.func.isRequired
    };

    fileInputEl = null;

    onClickUpload = () => {
        this.fileInputEl.value = null;
        this.fileInputEl.click();
    };

    render() {
        const { onChangeFile } = this.props;
        return (
            <React.Fragment>
                <input
                    ref={(node) => {
                        this.fileInputEl = node;
                    }}
                    type="file"
                    accept=".svg"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={onChangeFile}
                />
                <button
                    type="button"
                    className={classNames(styles['btn-small'], styles['btn-primary'])}
                    title={i18n._('Upload SVG File')}
                    onClick={this.onClickUpload}
                >
                    {i18n._('Upload SVG File')}
                </button>
            </React.Fragment>
        );
    }
}

export default UploadControl;
