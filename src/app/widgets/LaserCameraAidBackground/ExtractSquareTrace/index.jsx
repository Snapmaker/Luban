import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from
    'prop-types';
import i18n from '../../../lib/i18n';
import api from '../../../api';
import styles from '../styles.styl';
import ExtractPreview from './ExtractPreview';
import { MACHINE_SERIES } from '../../../constants';


const PANEL_MANUAL_CALIBRATION = 2;
const DefaultBgiName = '../../../images/snap-logo-badge-256x256.png';

class ExtractSquareTrace extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        server: PropTypes.object.isRequired,
        series: PropTypes.string.isRequired,
        shouldCalibrate: PropTypes.bool.isRequired,
        getPoints: PropTypes.array.isRequired,
        setBackgroundImage: PropTypes.func.isRequired,
        displayManualCalibration: PropTypes.func.isRequired
    };

    extractingPreview = [
    ];

    state = {
        isStitched: false,
        canTakePhoto: true,
        canStart: true,
        outputFilename: '',
        options: {
            picAmount: this.props.series === MACHINE_SERIES.A150.value ? 4 : 9,
            currentIndex: 0,
            size: this.props.size,
            series: this.props.series,
            centerDis: 100,
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
                canStart: false,
                canTakePhoto: false
            });
            const { address } = this.props.server;
            const resPro = await api.getCameraCalibration({ 'address': address });
            const resData = JSON.parse(resPro.body.res.text);

            const getPoints = (this.props.shouldCalibrate && this.props.getPoints.length === 4) ? this.props.getPoints : resData.points;
            this.setState({
                options: {
                    ...this.state.options,
                    corners: resData.corners,
                    getPoints: getPoints
                }
            });
            console.log('getPoints --------------', this.props.size, getPoints, resData.corners,);
            let imagesName = new Set();
            const position = [];
            let centerDis;
            const cameraOffsetX = 20;
            const cameraOffsetY = -8.5;
            if (this.props.series === MACHINE_SERIES.A150.value) {
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
                if (this.state.options.currentArrIndex !== i) {
                    break;
                }
                await api.processTakePhoto({
                    'index': position[i].index,
                    'x': position[i].x,
                    'y': position[i].y,
                    'z': 170,
                    'feedRate': 3000,
                    'address': address
                });

                let requestPic = api.processGetPhoto({ 'index': position[i].index, 'address': address });
                let xSize, ySize;
                if (this.state.options.picAmount === 4) {
                    xSize = this.props.size.x / 2;
                    ySize = this.props.size.y / 2;
                } else {
                    if (parseInt(position[i].index / 3, 10) === 1) {
                        ySize = centerDis;
                    } else {
                        ySize = Math.floor((this.props.size.y - centerDis) / 2);
                    }
                    if (position[i].index % 3 === 1) {
                        xSize = centerDis;
                    } else {
                        xSize = Math.floor((this.props.size.x - centerDis) / 2);
                    }
                }
                this.extractingPreview[position[i].index].current.onChangeImage(DefaultBgiName, xSize * 2, ySize * 2, position[i].index);

                let requestPicStatus = false;
                this.setState({
                    options: {
                        ...this.state.options,
                        currentArrIndex: this.state.options.currentArrIndex + 1
                    }
                });
                if (this.state.options.currentArrIndex !== i + 1) {
                    break;
                }
                const time = Date.now();
                const timer = setInterval(() => {
                    const diff = Date.now() - time;
                    if (requestPicStatus || diff > 30000) {
                        if (idx === position.length) {
                            imagesName = Array.from(imagesName);
                            if (this.props.series !== MACHINE_SERIES.A150.value) {
                                this.swapItem(imagesName, 3, 5);
                            } else {
                                this.swapItem(imagesName, 2, 3);
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
                        clearInterval(timer);
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
                                const { filename } = JSON.parse(stitchImg.text);
                                if (this.extractingPreview[position[i].index].current) {
                                    this.extractingPreview[position[i].index].current.onChangeImage(filename, xSize * 2, ySize * 2, position[i].index);
                                }
                            });
                            idx++;
                        }
                    });
                }, 700);
                this.timers.push(timer);
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
        },
        displayManualCalibration: () => {
            this.props.displayManualCalibration({ panel: PANEL_MANUAL_CALIBRATION });
        }
    };


    timers = [];

    componentDidMount() {
        for (let i = 0; i < this.state.options.picAmount; i++) {
            this.extractingPreview[i] = React.createRef();
        }
    }

    componentWillUnmount() {
        this.timers.forEach(v => {
            clearInterval(v);
        });
    }


    swapItem(imagesName, item1, item2) {
        const swap = imagesName[item1];
        imagesName[item1] = imagesName[item2];
        imagesName[item2] = swap;
    }


    render() {
        return (
            <div>
                <div className="clearfix" />
                <div className={styles['laser-set-background-modal-title']}>
                    {i18n._('Camera Aid Background')}
                </div>
                <div className={styles['photo-display']} style={{ height: this.props.size.y * 2 + 2, width: this.props.size.x * 2 + 2 }}>
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
                    <div
                        className={styles['start-background']}
                        style={{ display: this.state.canStart ? 'block' : 'none', width: '100%' }}

                    >
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-primary start-actions"
                            onClick={this.actions.startCameraAid}
                            style={{ display: 'block', width: '50%', margin: 'auto' }}

                        >
                            {i18n._('Start')}
                        </button>
                        <div
                            style={{ textAlign: 'center' }}
                        >
                            {i18n._('Type Something')}
                        </div>
                    </div>
                </div>
                <div style={{ margin: '0 60px', minHeight: '30px' }}>

                    <div className="clearfix" />
                    <button
                        type="button"
                        className={classNames(
                            'sm-btn-large',
                            styles[this.state.canTakePhoto ? 'btn-camera' : 'btn-camera-disabled'],
                        )}
                        onClick={this.actions.displayManualCalibration}
                        disabled={!this.state.canTakePhoto}

                    >
                        {i18n._('Calibration')}
                    </button>
                    <button
                        type="button"
                        className={classNames(
                            'sm-btn-large',
                            styles[this.state.isStitched ? 'btn-right-camera' : 'btn-right-camera-disabled'],
                        )}
                        onClick={this.actions.setBackgroundImage}
                        disabled={!this.state.isStitched}
                    >
                        {i18n._('Comfirm')}
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
