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
const DefaultBgiName = '../../../images/camera-aid/Loading.gif';

class ExtractSquareTrace extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        server: PropTypes.object.isRequired,
        series: PropTypes.string.isRequired,
        canTakePhoto: PropTypes.bool.isRequired,
        changeCanTakePhoto: PropTypes.func.isRequired,
        shouldCalibrate: PropTypes.bool.isRequired,
        getPoints: PropTypes.array.isRequired,
        setBackgroundImage: PropTypes.func.isRequired,
        displayManualCalibration: PropTypes.func.isRequired
    };

    extractingPreview = [];

    close = false;

    state = {
        getPhotoTasks: [],
        imageNames: [],
        isStitched: false,
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
            if (!this.props.canTakePhoto) {
                return;
            }
            console.log(this.props.size);
            await this.props.server.executeGcode('G53;');
            this.setState({
                canStart: false
            });
            this.props.changeCanTakePhoto(false);
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
            const position = [];
            let centerDis;
            const cameraOffsetX = 20;
            const cameraOffsetY = -8.5;
            let length;
            if (this.props.series === MACHINE_SERIES.A150.value) {
                centerDis = 80;
                [1, 2, 4, 3].forEach((item) => {
                    position.push({
                        'x': this.props.size.x / 2 + cameraOffsetX + centerDis / 2 * (item % 2 === 1 ? -1 : 1),
                        'y': this.props.size.y / 2 + cameraOffsetY + centerDis / 2 * (Math.ceil(item / 2) === 1 ? 1 : -1),
                        'index': item - 1
                    });
                });
                length = 4;
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
                length = 9;
            }
            this.setState({
                options: {
                    ...this.state.options,
                    centerDis,
                    currentIndex: 0,
                    currentArrIndex: 0
                }
            });
            const takePhotos = this.actions.takePhotos(address, position);
            const getPhototTasks = this.actions.startGetPhotoTasks(length);
            Promise.all([takePhotos, getPhototTasks]).then(() => {
                if (this.props.series !== MACHINE_SERIES.A150.value) {
                    this.swapItem(this.state.imageNames, 3, 5);
                } else {
                    this.swapItem(this.state.imageNames, 2, 3);
                }
                this.setState({
                    options: {
                        ...this.state.options,
                        fileNames: this.state.imageNames
                    }
                });
                this.actions.processStitch(this.state.options);
                this.props.changeCanTakePhoto(true);
            });

            // parse 2

            // const idx = 0;
            // for (let i = 0; i < position.length; i++) {
            //     if (this.state.options.currentArrIndex !== i) {
            //         break;
            //     }
            //     await api.processTakePhoto({
            //         'index': position[i].index,
            //         'x': position[i].x,
            //         'y': position[i].y,
            //         'z': 170,
            //         'feedRate': 3000,
            //         'address': address
            //     });

            // const requestPic = api.processGetPhoto({ 'index': position[i].index, 'address': address });
            //
            //
            // const requestPicStatus = false;
            // this.setState({
            //     options: {
            //         ...this.state.options
            //     }
            // });
            // if (this.state.options.currentArrIndex !== i + 1) {
            //     break;
            // }
            // const time = Date.now();
            // const timer = setInterval(() => {
            //     const diff = Date.now() - time;
            //     if (requestPicStatus || diff > 30000) {
            //         if (idx === position.length) {
            //             imagesName = Array.from(imagesName);
            //             if (this.props.series !== MACHINE_SERIES.A150.value) {
            //                 this.swapItem(imagesName, 3, 5);
            //             } else {
            //                 this.swapItem(imagesName, 2, 3);
            //             }
            //             this.setState({
            //                 options: {
            //                     ...this.state.options,
            //                     fileNames: imagesName
            //                 }
            //             });
            //             this.actions.processStitch(this.state.options);
            //             this.setState({
            //                 canTakePhoto: true
            //             });
            //         }
            //         clearInterval(timer);
            //         return;
            //     }
            //     requestPic.then((res) => {
            //         if (!JSON.parse(res.text).fileName && JSON.parse(res.text).status === 404) {
            //             requestPic = api.processGetPhoto({ 'index': position[i].index, 'address': address });
            //         } else {
            //             requestPicStatus = true;
            //             const { fileName } = JSON.parse(res.text);
            //             this.setState({
            //                 options: {
            //                     ...this.state.options,
            //                     currentIndex: position[i].index,
            //                     stitchFileName: fileName
            //                 }
            //             });
            //             imagesName.add(fileName);
            //
            //
            //             api.processStitchEach(this.state.options).then((stitchImg) => {
            //                 const { filename } = JSON.parse(stitchImg.text);
            //                 if (this.extractingPreview[position[i].index].current) {
            //                     this.extractingPreview[position[i].index].current.onChangeImage(filename, xSize * 2, ySize * 2, position[i].index);
            //                 }
            //             });
            //             idx++;
            //         }
            //     });
            // }, 700);
            // this.timers.push(timer);
            // }
        },

        takePhotos: (address, position) => {
            const getPhotoTasks = this.state.getPhotoTasks;
            return new Promise(async (resolve, reject) => {
                for (let i = 0; i < position.length; i++) {
                    if (this.close) {
                        this.props.changeCanTakePhoto(true);
                        this.props.server.executeGcode('G54');
                        reject();
                        return;
                    }
                    await api.processTakePhoto({
                        'index': position[i].index,
                        'x': position[i].x,
                        'y': position[i].y,
                        'z': 170,
                        'feedRate': 3000,
                        'address': address
                    });
                    getPhotoTasks.push({
                        address: address,
                        index: position[i].index,
                        status: 0
                    });
                }
                resolve();
            });
        },

        startGetPhotoTasks: (length) => {
            if (this.timer) {
                return Promise.reject();
            }
            const getPhotoTasks = this.state.getPhotoTasks;
            return new Promise(((resolve, reject) => {
                this.timer = setInterval(() => {
                    if (this.close) {
                        this.timer && clearInterval(this.timer);
                        this.timer = null;
                        reject();
                    }
                    const success = getPhotoTasks.filter(v => v.status === 2).length;
                    if (success === length) {
                        this.timer && clearInterval(this.timer);
                        this.timer = null;
                        resolve();
                    }
                    const post = getPhotoTasks.filter(v => v.status === 1).length;
                    if (post === 1) {
                        return;
                    }
                    const task = getPhotoTasks.find(v => v.status === 0);
                    if (!task) {
                        return;
                    }
                    task.status = 1;
                    api
                        .processGetPhoto({ 'index': task.index, 'address': task.address })
                        .then((res) => {
                            if (JSON.parse(res.text).fileName || JSON.parse(res.text).status !== 404) {
                                let xSize, ySize;

                                if (this.state.options.picAmount === 4) {
                                    xSize = this.props.size.x / 2;
                                    ySize = this.props.size.y / 2;
                                } else {
                                    if (parseInt(task.index / 3, 10) === 1) {
                                        ySize = this.state.options.centerDis;
                                    } else {
                                        ySize = ((this.props.size.y - this.state.options.centerDis) / 2);
                                    }
                                    if (task.index % 3 === 1) {
                                        xSize = this.state.options.centerDis;
                                    } else {
                                        xSize = ((this.props.size.x - this.state.options.centerDis) / 2);
                                    }
                                }
                                this.extractingPreview[task.index].current.onChangeImage(DefaultBgiName, xSize * 2, ySize * 2, task.index);

                                const { fileName } = JSON.parse(res.text);
                                this.setState({
                                    options: {
                                        ...this.state.options,
                                        currentIndex: task.index,
                                        stitchFileName: fileName
                                    }
                                });
                                this.state.imageNames.push(fileName);

                                api.processStitchEach(this.state.options).then((stitchImg) => {
                                    const { filename } = JSON.parse(stitchImg.text);
                                    if (this.extractingPreview[task.index].current) {
                                        this.extractingPreview[task.index].current.onChangeImage(filename, xSize * 2, ySize * 2, task.index);
                                    }
                                    task.status = 2;
                                });
                            } else {
                                task.status = 0;
                            }
                        })
                        .catch(() => {
                            this.close = true;
                        });
                }, 500);
            }));
        },


        processStitch: (options) => {
            api.processStitch(options).then((res) => {
                this.setState({
                    outputFilename: res.body.filename,
                    isStitched: true
                });
                this.props.server.executeGcode('G54');
            });
        },
        setBackgroundImage: () => {
            this.props.setBackgroundImage(this.state.outputFilename);
        },
        displayManualCalibration: () => {
            this.props.displayManualCalibration({ panel: PANEL_MANUAL_CALIBRATION });
        }
    };


    timer = null;

    componentDidMount() {
        for (let i = 0; i < this.state.options.picAmount; i++) {
            this.extractingPreview[i] = React.createRef();
        }
    }

    componentWillUnmount() {
        this.close = true;
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
                <div style={{ minHeight: 30, width: this.props.size.x * 2 + 2, margin: '0 auto' }}>
                    <div className="clearfix" />
                    <button
                        type="button"
                        className={classNames(
                            'sm-btn-large',
                            styles[this.props.canTakePhoto ? 'btn-camera' : 'btn-camera-disabled'],
                        )}
                        onClick={this.actions.displayManualCalibration}
                        disabled={!this.props.canTakePhoto}

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
