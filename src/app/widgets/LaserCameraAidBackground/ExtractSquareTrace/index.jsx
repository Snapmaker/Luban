import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from
    'prop-types';
import i18n from '../../../lib/i18n';
import api from '../../../api';
import styles from '../styles.styl';
import ExtractPreview from './ExtractPreview';
import ManualCalibration from '../ManualCalibration';
import { MACHINE_SERIES } from '../../../constants';
import { actions } from '../../../flux/machine';

const PANEL_EXTRACT_TRACE = 1;
const PANEL_MANUAL_CALIBRATION = 2;
const DefaultBgiName = '../../../images/camera-aid/Loading.gif';

class ExtractSquareTrace extends PureComponent {
    static propTypes = {
        laserSize: PropTypes.object.isRequired,
        size: PropTypes.object.isRequired,
        server: PropTypes.object.isRequired,
        series: PropTypes.string.isRequired,
        headType: PropTypes.string.isRequired,
        canTakePhoto: PropTypes.bool.isRequired,
        lastFileNames: PropTypes.array,
        xSize: PropTypes.array.isRequired,
        ySize: PropTypes.array.isRequired,
        updateEachPicSize: PropTypes.func.isRequired,
        changeLastFileNames: PropTypes.func.isRequired,
        changeCanTakePhoto: PropTypes.func.isRequired,
        setBackgroundImage: PropTypes.func.isRequired,
        executeGcodeG54: PropTypes.func.isRequired
    };

    extractingPreview = [];

    close = false;

    multiple = 2;

    state = {
        panel: PANEL_EXTRACT_TRACE,
        getPhotoTasks: [],
        imageNames: [],
        manualPoints: [],
        matrix: '',
        xSize: this.props.xSize,
        ySize: this.props.ySize,
        shouldCalibrate: false,
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
        backtoCalibrationModal: () => {
            this.setState({
                panel: PANEL_EXTRACT_TRACE
            });
        },
        updateAffinePoints: (manualPoints) => {
            this.setState({
                manualPoints
            });
        },
        displayExtractTrace: () => {
            this.setState({ panel: PANEL_EXTRACT_TRACE });
        },
        calibrationOnOff: (shouldCalibrate) => {
            this.setState({
                shouldCalibrate
            });
        },
        startCameraAid: async () => {
            if (!this.props.canTakePhoto) {
                return;
            }
            await this.props.server.executeGcode('G53;');

            this.setState({
                isStitched: false,
                canStart: false
            });
            this.props.changeCanTakePhoto(false);
            const { address } = this.props.server;
            const resPro = await api.getCameraCalibration({ 'address': address });
            const resData = JSON.parse(resPro.body.res.text);

            this.setState({
                options: {
                    ...this.state.options,
                    corners: resData.corners,
                    getPoints: resData.points
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
                        'x': this.props.laserSize.x / 2 + cameraOffsetX + centerDis / 2 * (item % 2 === 1 ? -1 : 1),
                        'y': this.props.laserSize.y / 2 + cameraOffsetY + centerDis / 2 * (Math.ceil(item / 2) === 1 ? 1 : -1),
                        'index': item - 1
                    });
                });
                length = 4;
            } else {
                centerDis = 100;
                for (let j = 1; j >= -1; j--) {
                    if (j === 1 || j === -1) {
                        for (let i = -1; i <= 1; i++) {
                            const x = this.props.laserSize.x / 2 + cameraOffsetX + centerDis * i;
                            const y = this.props.laserSize.y / 2 + cameraOffsetY + centerDis * j;
                            position.push({ 'x': x, 'y': y, 'index': position.length });
                        }
                    } else if (j === 0) {
                        for (let i = 1; i >= -1; i--) {
                            const x = this.props.laserSize.x / 2 + cameraOffsetX + centerDis * i;
                            const y = this.props.laserSize.y / 2 + cameraOffsetY + centerDis * j;
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
                this.props.changeLastFileNames(this.state.imageNames);
                this.props.updateEachPicSize('xSize', this.state.xSize);
                this.props.updateEachPicSize('ySize', this.state.ySize);

                this.actions.processStitch(this.state.options);
                this.props.changeCanTakePhoto(true);
            });
        },

        takePhotos: (address, position) => {
            const getPhotoTasks = this.state.getPhotoTasks;
            let z = 170;
            if (this.state.options.picAmount === 4) {
                z = 140;
            }
            return new Promise(async (resolve, reject) => {
                for (let i = 0; i < position.length; i++) {
                    if (this.close) {
                        this.props.changeCanTakePhoto(true);
                        this.props.executeGcodeG54(this.props.series, this.props.headType);
                        reject();
                        return;
                    }
                    await api.processTakePhoto({
                        'index': position[i].index,
                        'x': position[i].x,
                        'y': position[i].y,
                        'z': z,
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
                                if (this.state.options.picAmount === 4) {
                                    this.state.xSize[task.index] = this.props.laserSize.x / 2;
                                    this.state.ySize[task.index] = this.props.laserSize.y / 2;
                                } else {
                                    if (parseInt(task.index / 3, 10) === 1) {
                                        this.state.ySize[task.index] = this.state.options.centerDis;
                                    } else {
                                        this.state.ySize[task.index] = ((this.props.laserSize.y - this.state.options.centerDis) / 2);
                                    }
                                    if (task.index % 3 === 1) {
                                        this.state.xSize[task.index] = this.state.options.centerDis;
                                    } else {
                                        this.state.xSize[task.index] = ((this.props.laserSize.x - this.state.options.centerDis) / 2);
                                    }
                                }
                                this.props.updateEachPicSize('xSize', this.state.xSize);
                                this.props.updateEachPicSize('ySize', this.state.ySize);

                                this.extractingPreview[task.index].current.onChangeImage(
                                    DefaultBgiName,
                                    this.state.xSize[task.index] * this.multiple,
                                    this.state.ySize[task.index] * this.multiple,
                                    task.index,
                                    this.multiple
                                );

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
                                        this.extractingPreview[task.index].current.onChangeImage(
                                            filename,
                                            this.state.xSize[task.index] * this.multiple,
                                            this.state.ySize[task.index] * this.multiple,
                                            task.index,
                                            this.multiple
                                        );
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
        updateStitchEach: async () => {
            if (this.props.series === MACHINE_SERIES.A350.value) {
                this.multiple = 1.5;
            } else if (this.props.series === MACHINE_SERIES.A150.value) {
                this.setState({
                    options: {
                        ...this.state.options,
                        centerDis: 80
                    }
                });
            }
            if (this.state.shouldCalibrate && this.state.manualPoints.length === 4) {
                this.setState({
                    options: {
                        ...this.state.options,
                        getPoints: this.state.manualPoints
                    }
                });
            } else {
                const resPro = await api.getCameraCalibration({ 'address': this.props.server.address });
                const resData = JSON.parse(resPro.body.res.text);
                this.setState({
                    options: {
                        ...this.state.options,
                        getPoints: resData.points,
                        corners: resData.corners
                    }
                });
            }
            // fileNames, getPoints, corners, size, centerDis
            for (let i = 0; i < this.props.lastFileNames.length; i++) {
                if (this.state.xSize.length > 0 && this.state.ySize.length > 0) {
                    this.extractingPreview[i].current.onChangeImage(
                        DefaultBgiName, this.state.xSize[i] * this.multiple, this.state.ySize[i] * this.multiple, i, this.multiple
                    );
                } else {
                    this.extractingPreview[i].current.onChangeImage(
                        DefaultBgiName, this.props.xSize[i] * this.multiple, this.props.ySize[i] * this.multiple, i, this.multiple
                    );
                }
                const stitchImg = await api.processStitchEach(
                    {
                        ...this.state.options,
                        currentIndex: i,
                        stitchFileName: this.props.lastFileNames[i]
                    }
                );
                const { filename } = JSON.parse(stitchImg.text);

                if (this.state.xSize.length > 0 && this.state.ySize.length > 0) {
                    this.extractingPreview[i].current.onChangeImage(
                        filename, this.state.xSize[i] * this.multiple, this.state.ySize[i] * this.multiple, i, this.multiple
                    );
                } else {
                    this.extractingPreview[i].current.onChangeImage(
                        filename, this.props.xSize[i] * this.multiple, this.props.ySize[i] * this.multiple, i, this.multiple
                    );
                }
            }
            api.processStitch({
                ...this.state.options,
                fileNames: this.props.lastFileNames
            }).then((res) => {
                this.setState({
                    outputFilename: res.body.filename,
                    isStitched: true
                });
            });
            this.props.changeCanTakePhoto(true);
        },

        processStitch: (options) => {
            api.processStitch(options).then((res) => {
                this.setState({
                    outputFilename: res.body.filename,
                    isStitched: true
                });
                this.props.executeGcodeG54(this.props.series, this.props.headType);
            });
        },
        setBackgroundImage: () => {
            this.props.setBackgroundImage(this.state.outputFilename);
        },
        displayManualCalibration: async () => {
            const resPro = await api.getCameraCalibration({ 'address': this.props.server.address });
            const res = JSON.parse(resPro.body.res.text);
            this.setState({
                manualPoints: res.points,
                matrix: res
            });
            this.setState({
                panel: PANEL_MANUAL_CALIBRATION
            });
        }
    };


    timer = null;

    componentDidMount() {
        for (let i = 0; i < this.state.options.picAmount; i++) {
            this.extractingPreview[i] = React.createRef();
        }

        if (this.props.lastFileNames && this.props.lastFileNames.length > 0) {
            this.setState({
                canStart: false
            });
            this.actions.updateStitchEach();
            this.setState({
                canStart: true
            });
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
        if (this.props.series === MACHINE_SERIES.A350.value) {
            this.multiple = 1.5;
        } else {
            this.multiple = 2;
        }
        return (
            <div>
                <div className="clearfix" />
                <div style={{ display: this.state.panel === PANEL_EXTRACT_TRACE ? 'block' : 'none' }}>
                    <div className={styles['laser-set-background-modal-title']}>
                        {i18n._('Camera Capture')}
                    </div>
                    <div style={{ margin: '1rem 0' }}>
                        {i18n._('The camera on the laser module captures images of the work area, and stitch them together as the background. The accuracy of Camera Calibration affects how the captured image is mapped with machine coordinates. If you have reinstalled the laser module, please redo Camera Calibration on the touch screen before proceeding.')}
                    </div>
                    <div
                        className={styles['photo-display']}
                        style={{ height: this.props.laserSize.y * this.multiple + 2, width: this.props.laserSize.x * this.multiple + 2 }}
                    >

                        {this.extractingPreview.map((previewId, index) => {
                            const key = previewId + index;
                            return (
                                <ExtractPreview
                                    size={this.props.laserSize}
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
                        </div>
                    </div>
                    <div style={{ minHeight: 30, width: this.props.laserSize.x * this.multiple + 2, margin: '0 auto' }}>
                        <div className="clearfix" />
                        <button
                            type="button"
                            className={classNames(
                                'sm-btn-large',
                                styles[this.props.canTakePhoto ? 'btn-camera' : 'btn-camera-disabled'],
                            )}
                            style={{ marginTop: '1rem' }}
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
                            style={{ marginTop: '1rem' }}
                            onClick={this.actions.setBackgroundImage}
                            disabled={!this.state.isStitched}
                        >
                            {i18n._('Comfirm')}
                        </button>
                    </div>
                </div>
                {this.state.panel === PANEL_MANUAL_CALIBRATION && (
                    <ManualCalibration
                        backtoCalibrationModal={this.actions.backtoCalibrationModal}
                        getPoints={this.state.manualPoints}
                        matrix={this.state.matrix}
                        updateAffinePoints={this.actions.updateAffinePoints}
                        shouldCalibrate={this.state.shouldCalibrate}
                        displayExtractTrace={this.actions.displayExtractTrace}
                        updateStitchEach={this.actions.updateStitchEach}
                        calibrationOnOff={this.actions.calibrationOnOff}
                    />
                )}

            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    return {
        series: machine.series,
        headType: machine.headType,
        size: machine.size,
        server: machine.server,
        laserSize: machine.laserSize
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcodeG54: (series, headType) => dispatch(actions.executeGcodeG54(series, headType))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ExtractSquareTrace);
