import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import api from '../../../api';
import styles from '../styles.styl';
import ExtractPreview from './ExtractPreview';
import Anchor from '../../../components/Anchor';
import { EXPERIMENTAL_LASER_CAMERA } from '../../../constants';


class ExtractSquareTrace extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        sideLength: PropTypes.number,
        onChangeBackgroundFilename: PropTypes.func.isRequired,
        displayPrintTrace: PropTypes.func.isRequired,
        setBackgroundImage: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    extractingPreview = React.createRef();

    state = {
        filename: ''
    };

    actions = {
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        onChangeFile: (event) => {
            const file = event.target.files[0];

            const formData = new FormData();
            formData.append('image', file);
            api.uploadImage(formData)
                .then((res) => {
                    const { width, height, filename } = res.body;
                    this.extractingPreview.current.onChangeImage(filename, width, height);
                })
                .catch(() => {
                    // onFailure && onFailure();
                });
        },
        reset: () => {
            this.extractingPreview.current.reset();
        },
        extract: () => {
            if (EXPERIMENTAL_LASER_CAMERA) {
                const { size } = this.props;
                this.extractingPreview.current.extract(
                    size.x,
                    size.y,
                    (filename) => {
                        this.setState({ filename });
                    }
                );
            } else {
                this.extractingPreview.current.extract(
                    this.props.sideLength,
                    this.props.sideLength,
                    (filename) => {
                        this.setState({ filename });
                    }
                );
            }
        },
        previousPanel: () => {
            this.props.displayPrintTrace();
        },
        setBackgroundImage: () => {
            this.props.setBackgroundImage(this.state.filename);
        }
    };

    render() {
        return (
            <div>
                <input
                    ref={this.fileInput}
                    type="file"
                    accept=".png, .jpg, .jpeg, .bmp"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={this.actions.onChangeFile}
                />
                <div className="clearfix" />
                <div className={styles['laser-set-background-modal-title']}>
                    {i18n._('Extract Square Trace')}
                </div>
                <div style={{ textAlign: 'center' }}>
                    <ExtractPreview
                        ref={this.extractingPreview}
                        size={this.props.size}
                        width={400}
                        height={400}
                    />
                </div>
                <div className={styles['extract-background']}>
                    <div className={classNames(styles['extract-actions'])}>
                        <Anchor
                            className={styles['extract-actions__btn']}
                            onClick={this.actions.onClickToUpload}
                        >
                            <i className={styles['extract-actions__icon-upload']} />
                        </Anchor>
                        <span className={styles['extract-actions__text']}>{i18n._('Upload')}</span>
                    </div>
                    <div className={classNames(styles['extract-actions'])}>
                        <Anchor
                            className={styles['extract-actions__btn']}
                            onClick={this.actions.reset}
                        >
                            <i className={styles['extract-actions__icon-reset']} />
                        </Anchor>
                        <span className={styles['extract-actions__text']}>{i18n._('Reset')}</span>
                    </div>
                    <div className={classNames(styles['extract-actions'])}>
                        <Anchor
                            className={styles['extract-actions__btn']}
                            onClick={this.actions.extract}
                        >
                            <i className={styles['extract-actions__icon-conform']} />
                        </Anchor>
                        <span className={styles['extract-actions__text']}>{i18n._('Extract')}</span>
                    </div>
                </div>
                <div style={{ margin: '20px 60px' }}>
                    {!EXPERIMENTAL_LASER_CAMERA && (
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-primary"
                            onClick={this.actions.previousPanel}
                            style={{ width: '40%', float: 'left' }}
                        >
                            {i18n._('Previous')}
                        </button>
                    )}
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={this.actions.setBackgroundImage}
                        style={{ width: '40%', float: 'right' }}
                    >
                        {i18n._('Complete')}
                    </button>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    return {
        size: machine.size
    };
};

export default connect(mapStateToProps)(ExtractSquareTrace);
