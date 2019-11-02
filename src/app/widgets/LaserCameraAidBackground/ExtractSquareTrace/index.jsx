import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from
    'prop-types';
import i18n from '../../../lib/i18n';
import api from '../../../api';
import styles from '../styles.styl';
import ExtractPreview from './ExtractPreview';
import Anchor from '../../../components/Anchor';

class ExtractSquareTrace extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        server: PropTypes.object.isRequired,
        setBackgroundImage: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    extractingPreview = [
        React.createRef(),
        React.createRef(),
        React.createRef(),
        React.createRef(),
        React.createRef(),
        React.createRef(),
        React.createRef(),
        React.createRef(),
        React.createRef()
    ];

    state = {
        isStitched: false,
        shouldStopAction: false,
        filename: '',
        currentIndex: -1,
        options: {
            size: this.props.size,
            getPoints: [
                {
                    'x': 107,
                    'y': 345
                },
                {
                    'x': 918,
                    'y': 319
                },
                {
                    'x': 941,
                    'y': 1071
                },
                {
                    'x': 142,
                    'y': 1102
                }
            ],
            corners: [
                {
                    'x': 65,
                    'y': 175
                },
                {
                    'x': 165,
                    'y': 175
                },
                {
                    'x': 165,
                    'y': 75
                },
                {
                    'x': 65,
                    'y': 75
                }
            ],
            fileNames: []
        }
    };

    actions = {
        start: async () => {
            const { address } = this.props.server;
            const resPro = await api.processTakePhoto({ 'path': 'request_camera_calibration', 'address': address });
            const resData = JSON.parse(resPro.body.res.text);
            this.setState({
                options: {
                    ...this.state.options,
                    corners: resData.corners,
                    getPoints: resData.points
                }
            });
            const imagesName = [];
            const density = [];
            const d = 100;
            const cameraOffsetX = 15;
            const cameraOffsetY = -5;
            for (let j = 1; j >= -1; j--) {
                for (let i = -1; i <= 1; i++) {
                    const x = this.props.size.x / 2 + cameraOffsetX + d * i;
                    const y = this.props.size.y / 2 + cameraOffsetY + d * j;
                    density.push({ 'x': x, 'y': y });
                }
            }
            this.setState({
                currentIndex: 0,
                shouldStopAction: false
            });
            for (let i = 0; i < 9; i++) {
                if (this.state.shouldStopAction === true) {
                    this.setState({
                        options: {
                            fileNames: []
                        }
                    });
                    return;
                }
                await api.processTakePhoto({ 'path': 'request_capture_photo', 'index': i, 'x': density[i].x, 'y': density[i].y, 'address': address });
                const ask = await api.processGetPhoto({ 'index': i, 'address': address });
                if (this.state.currentIndex !== i) {
                    return;
                }
                this.setState({
                    currentIndex: this.state.currentIndex + 1
                });
                const { width, height, fileName } = ask.body;
                imagesName.push(fileName);
                this.extractingPreview[i].current.onChangeImage(fileName, width, height);
            }

            this.setState({
                options: {
                    ...this.state.options,
                    fileNames: imagesName
                }
            });
            await this.actions.processStitch(this.state.options);
        },
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        processStitch: (options) => {
            api.processStitch(options).then((res) => {
                this.setState({
                    filename: res.body.filename,
                    isStitched: true
                });
            });
        },
        onChangeFile: async (event) => {
            const { address } = this.props.server;
            const resPro = await api.processTakePhoto({ 'path': 'request_camera_calibration', 'address': address });
            const resData = JSON.parse(resPro.body.res.text);
            this.setState({
                options: {
                    ...this.state.options,
                    corners: resData.corners,
                    getPoints: resData.points
                }
            });
            const files = event.target.files;

            const imagesName = [];
            const formDataArray = [];
            if (files.length) {
                for (let i = 0, len = files.length; i < len; i++) {
                    const formData = new FormData();
                    formData.append('image', files[i]);
                    formDataArray.push(api.uploadImage(formData));
                }
            }
            Promise.all(formDataArray)
                .then(async (resArray) => {
                    resArray.forEach((item, index) => {
                        const { width, height, uploadName } = item.body;
                        imagesName.push(uploadName);
                        this.extractingPreview[index].current.onChangeImage(uploadName, width, height);
                    });
                    this.setState({
                        options: {
                            ...this.state.options,
                            fileNames: imagesName
                        }
                    });
                    await this.actions.processStitch(this.state.options);
                })
                .catch(() => {
                });
        },
        startCameraAid: () => {
            this.actions.start();
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
                    multiple="multiple"
                    onChange={this.actions.onChangeFile}
                />
                <div className="clearfix" />
                <div className={styles['laser-set-background-modal-title']}>
                    {i18n._('Extract Square Trace')}
                </div>
                <div style={{ textAlign: 'center' }}>
                    {this.extractingPreview.map((previewId, index) => {
                        const key = previewId + index;
                        return (
                            <ExtractPreview
                                ref={previewId}
                                key={key}
                                size={this.props.size}
                                width={140}
                                height={140}
                            />
                        );
                    })}
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
                            onClick={this.actions.startCameraAid}
                        >
                            <i className={styles['extract-actions__icon-reset']} />
                        </Anchor>
                        <span className={styles['extract-actions__text']}>{i18n._('Take Photo')}</span>
                    </div>
                </div>
                <div style={{ margin: '0 60px' }}>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={this.actions.setBackgroundImage}
                        disabled={!this.state.isStitched}
                        style={{ width: '50%', margin: '0 auto', display: 'block' }}
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
        server: machine.server,
        size: machine.size
    };
};
export default connect(mapStateToProps)(ExtractSquareTrace);
