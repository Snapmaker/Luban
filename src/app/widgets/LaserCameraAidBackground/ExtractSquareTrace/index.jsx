import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import api from '../../../api';
// import { actions as machineActions } from '../../../flux/machine';


import styles from '../styles.styl';
import ExtractPreview from './ExtractPreview';
import Anchor from '../../../components/Anchor';
// import { EXPERIMENTAL_LASER_CAMERA } from '../../../constants';

class ExtractSquareTrace extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        server: PropTypes.object.isRequired,
        serverStatus: PropTypes.string.isRequired,
        // sideLength: PropTypes.number,
        // displayPrintTrace: PropTypes.func.isRequired,
        setBackgroundImage: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    extractingPreview0 = React.createRef();

    extractingPreview1 = React.createRef();

    extractingPreview2 = React.createRef();

    extractingPreview3 = React.createRef();

    extractingPreview4 = React.createRef();

    extractingPreview5 = React.createRef();

    extractingPreview6 = React.createRef();

    extractingPreview7 = React.createRef();

    extractingPreview8 = React.createRef();

    extractingPreview = [
        this.extractingPreview0,
        this.extractingPreview1,
        this.extractingPreview2,
        this.extractingPreview3,
        this.extractingPreview4,
        this.extractingPreview5,
        this.extractingPreview6,
        this.extractingPreview7,
        this.extractingPreview8
    ];

    state = {
        // servers: this.props.servers,
        // center: {
        //     x: 115,
        //     y: 125
        // },
        filename: '',
        options: {
            size: this.props.size,
            // size: {
            //     x: 230,
            //     y: 250
            // },
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
            const resPro = await api.processTakePhoto({ 'path': 'request_camera_calibration' });
            const resData = JSON.parse(resPro.body.res.text);
            this.setState({
                options: {
                    ...this.state.options,
                    corners: resData.corners,
                    getPoints: resData.points
                }
            });
            console.log('corners>>>>>start', this.state.options);
            const imagesName = [];
            const density = [];
            const getPhotoArray = [];
            const d = 100;
            const cameraOffsetX = 15;
            const cameraOffsetY = -5;
            console.log('props size', this.props.size);
            for (let j = 1; j >= -1; j--) {
                for (let i = -1; i <= 1; i++) {
                    const x = this.props.size.x / 2 + cameraOffsetX + d * i;
                    const y = this.props.size.y / 2 + cameraOffsetY + d * j;
                    density.push({ 'x': x, 'y': y });
                    // console.log(`G0 X${x} Y${y} F1000`);
                }
            }
            for (let i = 0; i < 9; i++) {
                const res = await api.processTakePhoto({ 'path': 'request_capture_photo', 'index': i, 'x': density[i].x, 'y': density[i].y });
                const ask = await getPhotoArray.push(api.processGetPhoto({ 'index': i }));
                console.log(res, ask);
            }

            Promise.all(getPhotoArray)
                .then(async (resArray) => {
                // console.log(resArray);
                    resArray.forEach((item, index) => {
                        const { width = 140, height = 140, fileName } = item.body;
                        imagesName.push(fileName);
                        this.extractingPreview[index].current.onChangeImage(fileName, width, height);
                    });
                    this.setState({
                        options: {
                            ...this.state.options,
                            fileNames: imagesName
                        }
                    });
                    console.log(this.state.options.fileNames);
                    await this.actions.processStitch(this.state.options);
                })
                .catch(() => {
                });
        },
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        processStitch: (options) => {
            // console.log('from frondend processStitch');
            api.processStitch(options).then((res) => {
                console.log(res);
                this.setState({
                    filename: res.body.filename
                });
            });
            console.log(this.state.filename);
        },
        onChangeFile: (event) => {
            const files = event.target.files;
            const imagesName = [];
            const formDataArray = [];
            console.log('size file', this.props.size, this.props.server, this.props.serverStatus);
            if (files.length) {
                for (let i = 0, len = files.length; i < len; i++) {
                    const formData = new FormData();
                    formData.append('image', files[i]);
                    formDataArray.push(api.uploadImage(formData));
                }
            }
            Promise.all(formDataArray)
                .then(async (resArray) => {
                    // console.log(resArray);
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
                    // console.log(imagesName);
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
                    <ExtractPreview
                        ref={this.extractingPreview[0]}
                        size={this.props.size}
                        width={140}
                        height={140}
                    />
                    <ExtractPreview
                        ref={this.extractingPreview[1]}
                        size={this.props.size}
                        width={140}
                        height={140}
                    />
                    <ExtractPreview
                        ref={this.extractingPreview[2]}
                        size={this.props.size}
                        width={140}
                        height={140}
                    />
                    <ExtractPreview
                        ref={this.extractingPreview[3]}
                        size={this.props.size}
                        width={140}
                        height={140}
                    />
                    <ExtractPreview
                        ref={this.extractingPreview[4]}
                        size={this.props.size}
                        width={140}
                        height={140}
                    />
                    <ExtractPreview
                        ref={this.extractingPreview[5]}
                        size={this.props.size}
                        width={140}
                        height={140}
                    />
                    <ExtractPreview
                        ref={this.extractingPreview[6]}
                        size={this.props.size}
                        width={140}
                        height={140}
                    />
                    <ExtractPreview
                        ref={this.extractingPreview[7]}
                        size={this.props.size}
                        width={140}
                        height={140}
                    />
                    <ExtractPreview
                        ref={this.extractingPreview[8]}
                        size={this.props.size}
                        width={140}
                        height={140}
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
        serverStatus: machine.serverStatus,
        size: machine.size
    };
};
// const mapDispatchToProps = (dispatch) => {
//     return {
//         // executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(gcode, context)),
//         // takePhoto: (index, positions, context) => dispatch(machineActions.takePhoto(index, positions, context)),
//         // getPhoto: (index, callback) => dispatch(machineActions.getPhoto(index, callback))
//     };
// };

export default connect(mapStateToProps)(ExtractSquareTrace);
