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
import { MACHINE_TYPE_SMALL } from '../../../constants';


class ExtractSquareTrace extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        server: PropTypes.object.isRequired,
        series: PropTypes.string.isRequired,
        setBackgroundImage: PropTypes.func.isRequired
    };

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
        canTakePhoto: true,
        outputFilename: '',
        options: {
            currentIndex: 0,
            size: this.props.size,
            centerDis: 100,
            series: this.props.series,
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

            if (!this.state.canTakePhoto) {
                return;
            }
            this.setState({
                canTakePhoto: false
            });
            const { address } = this.props.server;
            const resPro = await api.processTakePhoto({ 'path': 'request_camera_calibration', 'address': address });
            const resData = JSON.parse(resPro.body.res.text);
            console.log(this.props.size, resData.corners, resData.points);
            this.setState({
                options: {
                    ...this.state.options,
                    corners: resData.corners,
                    getPoints: resData.points
                }
            });
            let imagesName = new Set();
            const position = [];
            let centerDis;
            const cameraOffsetX = 20;
            const cameraOffsetY = -8.5;
            if (this.props.series === MACHINE_TYPE_SMALL) {
                centerDis = 80;
                [1, 2, 4, 3].forEach((item) => {
                    position.push({
                        'x': this.props.size.x / 2 + cameraOffsetX + centerDis / 2 * (item % 2 === 1 ? -1 : 1),
                        'y': this.props.size.y / 2 + cameraOffsetY + centerDis / 2 * (Math.ceil(item / 2) === 1 ? 1 : -1),
                        'index': item - 1
                    });
                });
            } else {
                centerDis = 100;
                for (let j = 1; j >= -1; j--) {
                    if (j === 1 || j === -1) {
                        for (let i = -1; i <= 1; i++) {
                            const x = this.props.size.x / 2 + cameraOffsetX + centerDis * i;
                            const y = this.props.size.y / 2 + cameraOffsetY + centerDis * j;
                            position.push({ 'x': x, 'y': y, 'index': position.length });
                        }
                    } else if (j === 0) {
                        for (let i = 1; i >= -1; i--) {
                            const x = this.props.size.x / 2 + cameraOffsetX + centerDis * i;
                            const y = this.props.size.y / 2 + cameraOffsetY + centerDis * j;
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
            }

            this.timmers = new Array(position.length);
            this.setState({
                options: {
                    ...this.state.options,
                    centerDis,
                    currentIndex: 0,
                    currentArrIndex: 0
                }
            });

            // parse 2

            let idx = 0;
            for (let i = 0; i < position.length; i++) {
                console.log(this.state.options.currentArrIndex, i);
                if (this.state.options.currentArrIndex !== i) {
                    break;
                }
                await api.processTakePhoto({
                    'path': 'request_capture_photo',
                    'index': position[i].index,
                    'x': position[i].x,
                    'y': position[i].y,
                    'z': 170,
                    'feedRate': 3000,
                    'address': address
                });

                let requestPic = api.processGetPhoto({ 'index': position[i].index, 'address': address });
                let requestPicStatus = false;
                let timmer = null;
                this.timmers[position[i].index] = Date.now();
                this.setState({
                    options: {
                        ...this.state.options,
                        currentArrIndex: this.state.options.currentArrIndex + 1
                    }
                });


                timmer = setInterval(() => {
                    const diff = Date.now() - this.timmers[position[i].index];
                    if (requestPicStatus || diff > 60000) {
                        if (idx === position.length) {
                            imagesName = Array.from(imagesName);
                            if (this.props.series !== MACHINE_TYPE_SMALL) {
                                this.swiperItem(imagesName, 3, 5);
                            } else {
                                this.swiperItem(imagesName, 2, 3);
                            }
                            this.setState({
                                options: {
                                    ...this.state.options,
                                    fileNames: imagesName
                                }
                            });
                            this.actions.processStitch(this.state.options);
                            this.setState({
                                canTakePhoto: true
                            });
                        }
                        clearInterval(timmer);
                        return;
                    }
                    requestPic.then((res) => {
                        if (!JSON.parse(res.text).fileName && JSON.parse(res.text).status === 404) {
                            requestPic = api.processGetPhoto({ 'index': position[i].index, 'address': address });
                        } else {
                            requestPicStatus = true;
                            const { fileName } = JSON.parse(res.text);
                            this.setState({
                                options: {
                                    ...this.state.options,
                                    currentIndex: position[i].index,
                                    stitchFileName: fileName
                                }
                            });
                            imagesName.add(fileName);
                            api.processStitchEach(this.state.options).then((stitchImg) => {
                                const { filename, xSize, ySize } = JSON.parse(stitchImg.text);
                                if (this.extractingPreview[position[i].index].current) {
                                    this.extractingPreview[position[i].index].current.onChangeImage(filename, xSize, ySize, position[i].index);
                                }
                            });
                            idx++;
                        }
                    });
                }, 700);
                // this.timmers.push(timmer);
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


    timmers = [];


    swiperItem(imagesName, item1, item2) {
        const swiper = imagesName[item1];
        imagesName[item1] = imagesName[item2];
        imagesName[item2] = swiper;
    }


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
                                size={this.props.size}
                                series={this.props.series}
                                ref={previewId}
                                key={key}
                            />
                        );
                    })}
                </div>
                <div className={styles['extract-background']}>
                    <div className={classNames(styles['extract-actions'])}>
                        <Anchor
                            className={this.state.canTakePhoto ? styles['extract-actions__btn'] : styles['extract-actions__disable']}

                            onClick={this.actions.startCameraAid}
                        >
                            <i className={styles['extract-actions__icon-reset']} />
                        </Anchor>
                        <span
                            className={styles['extract-actions__text']}
                        >
                            {i18n._('Take Photo')}
                        </span>
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
        series: machine.series,
        server: machine.server,
        size: machine.size
    };
};
export default connect(mapStateToProps)(ExtractSquareTrace);
