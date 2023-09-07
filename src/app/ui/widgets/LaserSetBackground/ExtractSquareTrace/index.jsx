import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../../../lib/i18n';
import api from '../../../../api';
import styles from '../styles.styl';
import ExtractPreview from './ExtractPreview';
import Anchor from '../../../components/Anchor';
import { Button } from '../../../components/Buttons';
import Modal from '../../../components/Modal';
import { EXPERIMENTAL_LASER_CAMERA } from '../../../../constants';
import SvgIcon from '../../../components/SvgIcon';


class ExtractSquareTrace extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        sideLength: PropTypes.number,
        displayPrintTrace: PropTypes.func.isRequired,
        setBackgroundImage: PropTypes.func.isRequired,
        hideModal: PropTypes.func.isRequired
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
                    const { sourceWidth, sourceHeight, uploadName } = res.body;
                    this.extractingPreview.current.onChangeImage(uploadName, sourceWidth, sourceHeight);
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
                <Modal style={{ width: '480px', height: '720px' }} size="lg" onClose={this.props.hideModal}>

                    <div className="clearfix" />
                    <Modal.Header>
                        <div className={styles['laser-set-background-modal-title']}>
                            {i18n._('key-Laser/CameraCaptureOriginal-Extract Square')}
                        </div>
                    </Modal.Header>

                    <Modal.Body>
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
                                    {/* <i className={styles['extract-actions__icon-upload']} /> */}
                                    <SvgIcon
                                        type={['static']}
                                        className="margin-bottom-4"
                                        name="CameraCaptureImport"
                                    />
                                </Anchor>
                                <span className={styles['extract-actions__text']}>{i18n._('key-Laser/CameraCaptureOriginal-Upload')}</span>
                            </div>
                            <div className={classNames(styles['extract-actions'])}>
                                <Anchor
                                    className={styles['extract-actions__btn']}
                                    onClick={this.actions.reset}
                                >
                                    {/* <i className={styles['extract-actions__icon-reset']} /> */}
                                    <SvgIcon
                                        type={['static']}
                                        className="margin-bottom-4"
                                        name="CameraCaptureReset"
                                    />
                                </Anchor>
                                <span className={styles['extract-actions__text']}>{i18n._('key-Laser/CameraCaptureOriginal-Reset')}</span>
                            </div>
                            <div className={classNames(styles['extract-actions'])}>
                                <Anchor
                                    className={styles['extract-actions__btn']}
                                    onClick={this.actions.extract}
                                >
                                    <SvgIcon
                                        type={['static']}
                                        className="margin-bottom-4"
                                        name="CameraCaptureExtract"
                                    />
                                    {/* <i className={styles['extract-actions__icon-conform']} /> */}
                                </Anchor>
                                <span className={styles['extract-actions__text']}>{i18n._('key-Laser/CameraCaptureOriginal-Extract')}</span>
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        {!EXPERIMENTAL_LASER_CAMERA && (
                            <Button
                                priority="level-two"
                                width="96px"
                                type="default"
                                className="float-l"
                                onClick={this.actions.previousPanel}
                            >
                                {i18n._('key-Laser/CameraCaptureOriginal-Back')}
                            </Button>
                        )}
                        <Button
                            priority="level-two"
                            width="96px"
                            onClick={this.actions.setBackgroundImage}
                        >
                            {i18n._('key-Laser/CameraCaptureOriginal-Complete')}
                        </Button>
                    </Modal.Footer>
                </Modal>
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
