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
        machine: PropTypes.object.isRequired,
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
        outputFilename: '',
        options: {
            shouldStopAction: false,
            currentIndex: 0,
            size: this.props.size,
            currentArrIndex: 0,
            getPoints: [],
            corners: [],
            fileNames: [],
            stitchFileName: ''
        }
    };

    actions = {
        startCameraAid: async () => {
            // parse 1: request_camera_calibration
            console.log(this.props.machine, this.props.size);
            const { address } = this.props.server;
            const resPro = await api.processTakePhoto({ 'path': 'request_camera_calibration', 'address': address });
            const resData = JSON.parse(resPro.body.res.text);
            console.log(resData.corners, resData.points);
            this.setState({
                options: {
                    ...this.state.options,
                    corners: resData.corners,
                    getPoints: resData.points
                }
            });
            let imagesName = new Set();
            const position = [];
            const d = 100;
            const cameraOffsetX = 20;
            const cameraOffsetY = -8.5;
            for (let j = 1; j >= -1; j--) {
                if (j === 1 || j === -1) {
                    for (let i = -1; i <= 1; i++) {
                        const x = this.props.size.x / 2 + cameraOffsetX + d * i;
                        const y = this.props.size.y / 2 + cameraOffsetY + d * j;
                        position.push({ 'x': x, 'y': y, 'index': position.length });
                    }
                } else if (j === 0) {
                    for (let i = 1; i >= -1; i--) {
                        const x = this.props.size.x / 2 + cameraOffsetX + d * i;
                        const y = this.props.size.y / 2 + cameraOffsetY + d * j;
                        if (position.length === 3) {
                            position.push({ 'x': x, 'y': y, 'index': 5 });
                        } else if (position.length === 5) {
                            position.push({ 'x': x, 'y': y, 'index': 3 });
                        } else {
                            position.push({ 'x': x, 'y': y, 'index': position.length });
                        }
                    }
                }
            }
            console.log(position);
            this.setState({
                options: {
                    ...this.state.options,
                    currentIndex: 0,
                    currentArrIndex: 0,
                    shouldStopAction: false
                }
            });

            // parse 2

            let idx = 0;
            for (let i = 0; i < 9; i++) {
                if (this.state.options.shouldStopAction === true) {
                    this.setState({
                        options: {
                            ...this.state.options,
                            currentArrIndex: 0,
                            fileNames: []
                        }
                    });
                    return;
                }
                console.log(this.state.options.currentArrIndex, i - 1);
                // if (this.state.options.currentArrIndex !== 0 && this.state.options.currentArrIndex !== i - 1) {
                //     return;
                // }
                await api.processTakePhoto({ 'path': 'request_capture_photo', 'index': position[i].index, 'x': position[i].x, 'y': position[i].y, 'address': address });
                let requestPic = api.processGetPhoto({ 'index': position[i].index, 'address': address });
                let requestPicStatus = false;
                let timmer = null;

                timmer = setInterval(() => {
                    if (requestPicStatus) {
                        if (idx === 9) {
                            imagesName = Array.from(imagesName);
                            const swiper = imagesName[3];
                            imagesName[3] = imagesName[5];
                            imagesName[5] = swiper;
                            this.setState({
                                options: {
                                    ...this.state.options,
                                    fileNames: imagesName
                                }
                            });
                            this.actions.processStitch(this.state.options);
                        }
                        clearInterval(timmer);
                        return;
                    }
                    requestPic.then((res) => {
                        if (!JSON.parse(res.text).fileName && JSON.parse(res.text).status === 404) {
                            requestPic = api.processGetPhoto({ 'index': position[i].index, 'address': address });
                        } else {
                            requestPicStatus = true;
                            const { fileName } = res.body;
                            this.setState({
                                options: {
                                    ...this.state.options,
                                    currentArrIndex: this.state.options.currentArrIndex + 1,
                                    currentIndex: position[i].index,
                                    stitchFileName: fileName
                                }
                            });
                            imagesName.add(fileName);
                            api.processStitchEach(this.state.options).then((stitchImg) => {
                                const { filename, xSize, ySize } = JSON.parse(stitchImg.text);
                                this.extractingPreview[position[i].index].current.onChangeImage(filename, xSize, ySize);
                            });
                            idx++;
                        }
                    });
                }, 700);
            }
        },
        processStitch: (options) => {
            api.processStitch(options).then((res) => {
                this.setState({
                    outputFilename: res.body.filename,
                    isStitched: true
                });
            });
        },
        setBackgroundImage: () => {
            this.props.setBackgroundImage(this.state.outputFilename);
        }
    };

    render() {
        return (
            <div>
                <div className="clearfix" />
                <div className={styles['laser-set-background-modal-title']}>
                    {i18n._('Extract Square Trace')}
                </div>
                <div className={styles['photo-display']} style={{ height: this.props.size.y, width: this.props.size.x }}>
                    {this.extractingPreview.map((previewId, index) => {
                        const key = previewId + index;
                        return (
                            <ExtractPreview
                                ref={previewId}
                                key={key}
                            />
                        );
                    })}
                </div>
                <div className={styles['extract-background']}>
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
        machine: machine,
        server: machine.server,
        size: machine.size
    };
};
export default connect(mapStateToProps)(ExtractSquareTrace);
