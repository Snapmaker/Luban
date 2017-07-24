import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import Slider from 'rc-slider';
import Select from 'react-select';
import jQuery from 'jquery';
import pubsub from 'pubsub-js';
import ensurePositiveNumber from '../../lib/ensure-positive-number';
import controller from '../../lib/controller';
import api from '../../api';
import LaserVisiualizer from '../../widgets/LaserVisualizer';
import styles from './index.styl';

// stage
const STAGE_INITIAL = 0;
const STAGE_IMAGE_LOADED = 1;
const STAGE_PREVIEWD = 2;
const STAGE_GENERATED = 3;

class Laser extends Component {
    state = this.getInitialState();

    fileInputEl = null;

    onClickToUpload() {
        console.log('click');
        this.fileInputEl.value = null;
        this.fileInputEl.click();
    }

    actions = {
        onChangeContrast: (value) => {
            const contrast = Number(value) || 0;
            this.setState({
                ...this.state.contrast,
                contrast,
                stage: STAGE_IMAGE_LOADED
            });
        },
        onChangeBrightness: (value) => {
            const brightness = Number(value) || 0;
            this.setState({
                ...this.state.brightness,
                brightness,
                stage: STAGE_IMAGE_LOADED
            });
        },
        onChangeWhiteClip: (value) => {
            const whiteClip = Number(value) || 255;
            this.setState({
                ...this.state.whiteClip,
                whiteClip,
                stage: STAGE_IMAGE_LOADED
            });
        },
        onChangeAlgorithm: (options) => {
            this.setState({
                ...this.state.algorithm,
                algorithm: options.value,
                stage: STAGE_IMAGE_LOADED
            });
        },
        onChangeDwellTime: (event) => {
            const value = event.target.value;
            if (typeof value === 'string' && value.trim() === '') {
                this.setState({
                    ...this.state.dwellTime,
                    dwellTime: '',
                    stage: STAGE_IMAGE_LOADED
                });
            } else {
                this.setState({
                    ...this.state.dwellTime,
                    dwellTime: value > 1 ? 1 : ensurePositiveNumber(value),
                    stage: STAGE_IMAGE_LOADED
                });
            }
        },
        onChangeQuality: (event) => {
            let value = event.target.value;
            if (typeof value === 'string' && value.trim() === '') {
                this.setState({
                    ...this.state.quality,
                    quality: '',
                    stage: STAGE_IMAGE_LOADED
                });
            } else {
                if (value < 1) {
                    value = 1;
                }
                this.setState({
                    ...this.state.quality,
                    quality: value > 10 ? 10 : value,
                    stage: STAGE_IMAGE_LOADED
                });
            }
        },
        onChangeWorkSpeed: (event) => {
            let value = event.target.value;
            if (typeof value === 'string' && value.trim() === '') {
                this.setState({
                    ...this.state.workSpeed,
                    workSpeed: '',
                    stage: STAGE_IMAGE_LOADED
                });
            } else {
                if (value < 1) {
                    value = 1;
                }
                this.setState({
                    ...this.state.workSpeed,
                    workSpeed: value > 3600 ? 3600 : value,
                    stage: STAGE_IMAGE_LOADED
                });
            }
        },
        onChangeWidth: (event) => {
            const value = event.target.value;
            const scale = this.state.originHeight / this.state.originWidth;

            this.setState({
                ...this.state.sizeWidth,
                ...this.state.sizeHeight,
                sizeWidth: value,
                sizeHeight: value * scale,
                stage: STAGE_IMAGE_LOADED
            });
        },
        onChangeHeight: (event) => {
            const value = event.target.value;
            const scale = this.state.originHeight / this.state.originWidth;

            console.log(value);
            console.log(scale);

            this.setState({
                ...this.state.sizeWidth,
                ...this.state.sizeHeight,
                sizeWidth: value / scale,
                sizeHeight: value,
                stage: STAGE_IMAGE_LOADED
            });
        },
        onChangePreview: () => {
            //this.setState({
            //    ...this.state.imageSrc,
            //    imageSrc: './images/doggy-grey-x2.png'
            //});
            controller.generateImage(this.state);
        },
        onChangeFile: (event) => {
            const files = event.target.files;
            const file = files[0];
            const formdata = new FormData();
            formdata.append('image', file);
            console.log(file);

            // get width & height
            let _URL = window.URL || window.webkitURL;
            let img = new Image();
            let that = this;
            img.onload = function() {
                console.log(`width = ${this.width}, height = ${this.height}`);
                that.setState({
                    ...that.state.originWidth,
                    ...that.state.originHeight,
                    ...that.state.sizeWidth,
                    ...that.state.sizeHeight,
                    ...that.state.quality,
                    quality: 10,
                    originWidth: this.width,
                    originHeight: this.height,
                    sizeWidth: this.width / 10,
                    sizeHeight: this.height / 10

                });
            };
            img.src = _URL.createObjectURL(file);

            api.uploadImage(formdata).then((res) => {
                this.setState({
                    ...this.state.imageSrc,
                    originSrc: `./images/_cache/${res.text}`,
                    imageSrc: `./images/_cache/${res.text}`,
                    stage: STAGE_IMAGE_LOADED
                });
            });
        },
        onChangeGcode: () => {
            controller.generateGcode(this.state);
        },
        onLoadGcode: () => {
            const gcodeSrc = this.state.gcodeSrc;
            location.href = '/#/workspace';
            window.scrollTo(0, 0);
            console.log('window.scrollTo(0, 0);');
            console.log('location.href');
            jQuery.get(gcodeSrc, (result) => {
                console.log('publish');
                console.log(gcodeSrc);
                console.log(result.length);
                //pubsub.publish('gcode:load', { name: gcodeSrc, gcode: result });
                pubsub.publish('gcode:upload', { gcode: result, meta: { name: gcodeSrc } });
            });
        },
        onChangeGreyscale: () => {
            this.setState({
                ...this.state.mode,
                mode: 'greyscale'
            });
        },
        onChangeBW: () => {
            this.setState({
                ...this.state.mode,
                mode: 'bw'
            });
        },
        changeBWThreshold: (value) => {
            const bwThreshold = Number(value) || 0;
            this.setState({
                ...this.state.bwThreshold,
                bwThreshold,
                stage: STAGE_IMAGE_LOADED
            });
        },
        onChangeDirection: (options) => {
            this.setState({
                ...this.state.direction,
                direction: options.value,
                stage: STAGE_IMAGE_LOADED
            });
        }

    };

    controllerEvents = {
        'image:generated': (imageSrc) => {
            this.setState({
                ...this.state.imageSrc,
                imageSrc,
                stage: STAGE_PREVIEWD
            });
        },
        'gcode:generated': (gcodeSrc) => {
            this.setState({
                ...this.state.gcodeSrc,
                gcodeSrc,
                stage: STAGE_GENERATED
            });
        }
    };

    componentDidMount() {
        this.addControllerEvents();
    }
    componentWillUnmount() {
        this.removeControllerEvents();
    }

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }
    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }


    getInitialState() {
        return {
            mode: 'greyscale',
            bwThreshold: 128,
            direction: 'Horizontal',
            contrast: 50,
            brightness: 50,
            whiteClip: 255,
            algorithm: 'FloyedSteinburg',
            dwellTime: 0.0417,
            speed: 288,
            workSpeed: 288,
            quality: 10,
            originSrc: '-',
            originWidth: 0,
            originHeight: 0,
            imageSrc: './images/snap-logo-square-256x256.png',
            sizeWidth: 0,
            sizeHeight: 0,
            gcodeSrc: '-',
            stage: STAGE_INITIAL
        };
    }

    render() {
        const style = this.props.style;
        const state = { ...this.state };
        const actions = { ...this.actions };
        return (
            <div style={style}>
                <div className={ styles.laserTable }>
                    <div className={ styles.laserTableRow }>

                        <div className={ styles.viewSpace }>
                            <div style={{ position: 'absolute', top: '50px', left: '30px', zIndex: '300' }}>
                                <input
                                    // The ref attribute adds a reference to the component to
                                    // this.refs when the component is mounted.
                                    ref={(node) => {
                                        this.fileInputEl = node;
                                    }}
                                    type="file"
                                    style={{ display: 'none' }}
                                    multiple={false}
                                    onChange={actions.onChangeFile}
                                />

                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    title={'Upload Image'}
                                    onClick={::this.onClickToUpload}
                                >
                                    Upload Image
                                </button>
                            </div>
                            <LaserVisiualizer widgetId="laserVisiualizer" state={state} />
                        </div>

                        <div className={ styles.controlBar }>
                            <div style={{ marginBottom: '20px' }}>
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    style={{ width: '150px' }}
                                    onClick={actions.onChangeGreyscale}
                                >
                                    GREYSCALE
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-default"
                                    style={{ width: '150px', marginLeft: '20px' }}
                                    onClick={actions.onChangeBW}
                                >
                                    B&W
                                </button>
                            </div>

                            {state.mode === 'greyscale' &&
                                <div className="table-form-row" style={{ marginBottom: '30px' }}>
                                    <div className="table-form-col table-form-col-label middle">
                                        Contrast
                                    </div>
                                    <div className="table-form-col">
                                        <div className="text-center">{state.contrast}%</div>
                                        <Slider
                                            style={{ padding: 0 }}
                                            defaultValue={state.contrast}
                                            min={0}
                                            max={100}
                                            step={1}
                                            onChange={actions.onChangeContrast}
                                            disabled={state.stage < STAGE_IMAGE_LOADED}
                                        />
                                    </div>
                                </div>
                            }

                            {state.mode === 'greyscale' &&
                                <div className="table-form-row" style={{ marginBottom: '30px' }}>
                                    <div className="table-form-col table-form-col-label middle">
                                        Brightness
                                    </div>
                                    <div className="table-form-col">
                                        <div className="text-center">{state.brightness}%</div>
                                        <Slider
                                            style={{ padding: 0 }}
                                            defaultValue={state.brightness}
                                            min={0}
                                            max={100}
                                            step={1}
                                            onChange={actions.onChangeBrightness}
                                            disabled={state.stage < STAGE_IMAGE_LOADED}
                                        />
                                    </div>
                                </div>
                            }

                            {state.mode === 'greyscale' &&
                                <div className="table-form-row" style={{ marginBottom: '30px' }}>
                                    <div className="table-form-col table-form-col-label middle">
                                        White Clip
                                    </div>
                                    <div className="table-form-col">
                                        <div className="text-center">{state.whiteClip}</div>
                                        <Slider
                                            style={{ padding: 0 }}
                                            defaultValue={state.whiteClip}
                                            min={1}
                                            max={255}
                                            step={1}
                                            onChange={actions.onChangeWhiteClip}
                                            disabled={state.stage < STAGE_IMAGE_LOADED}
                                        />
                                    </div>
                                </div>
                            }

                            {state.mode === 'greyscale' &&
                                <div className="form-group" style={{ marginBottom: '30px' }}>
                                    <label className="control-label">{'Algorithm'}</label>
                                    <Select
                                        backspaceRemoves={false}
                                        className="sm"
                                        clearable={false}
                                        menuContainerStyle={{ zIndex: 5 }}
                                        name="baudrate"
                                        options={[{
                                            value: 'Atkinson',
                                            label: 'Atkinson'
                                        }, {
                                            value: 'Burks',
                                            label: 'Burks'
                                        }, {
                                            value: 'FloyedSteinburg',
                                            label: 'FloyedSteinburg'
                                        }, {
                                            value: 'JarvisJudiceNinke',
                                            label: 'JarvisJudiceNinke'
                                        }, {
                                            value: 'Sierra2',
                                            label: 'Sierra2'
                                        }, {
                                            value: 'Sierra3',
                                            label: 'Sierra3'
                                        }, {
                                            value: 'SierraLite',
                                            label: 'SierraLite'
                                        }, {
                                            value: 'Stucki',
                                            label: 'Stucki'
                                        }]}
                                        placeholder={'choose algorithms'}
                                        searchable={false}
                                        value={state.algorithm}
                                        onChange={actions.onChangeAlgorithm}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                </div>
                            }

                            {state.mode === 'greyscale' &&
                                <div className="table-form-row" style={{ marginBottom: '10px' }}>
                                    <div className="table-form-col table-form-col-label middle">
                                        Dwell Time
                                    </div>
                                    <div className="table-form-col">
                                        <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                            <input
                                                type="number"
                                                className="form-control"
                                                style={{ borderRadius: 0 }}
                                                value={state.dwellTime}
                                                min={0}
                                                step={0.001}
                                                onChange={actions.onChangeDwellTime}
                                                disabled={state.stage < STAGE_IMAGE_LOADED}
                                            />
                                            <span className="input-group-addon">{'ms/pixel'}</span>
                                        </div>
                                    </div>
                                </div>
                            }

                            {state.mode === 'bw' &&
                                <div className="table-form-row" style={{ marginBottom: '30px' }}>
                                    <div className="table-form-col table-form-col-label middle">
                                        B&W
                                    </div>
                                    <div className="table-form-col">
                                        <div className="text-center">{state.bwThreshold}</div>
                                        <Slider
                                            style={{ padding: 0 }}
                                            defaultValue={state.bwThreshold}
                                            min={0}
                                            max={255}
                                            step={1}
                                            onChange={actions.changeBWThreshold}
                                            disabled={state.stage < STAGE_IMAGE_LOADED}
                                        />
                                    </div>
                                </div>
                            }

                            {state.mode === 'bw' &&
                                <div className="form-group" style={{ marginBottom: '30px' }}>
                                    <label className="control-label">{'Line Direction'}</label>
                                    <Select
                                        backspaceRemoves={false}
                                        className="sm"
                                        clearable={false}
                                        menuContainerStyle={{ zIndex: 5 }}
                                        name="line_direction"
                                        options={[{
                                            value: 'Horizontal',
                                            label: 'Horizontal'
                                        }, {
                                            value: 'Vertical',
                                            label: 'Vertical'
                                        }, {
                                            value: 'Diagonal',
                                            label: 'Diagonal'
                                        }, {
                                            value: 'Diagnonal2',
                                            label: 'Diagnonal2'
                                        }]}
                                        placeholder={'choose algorithms'}
                                        searchable={false}
                                        value={state.direction}
                                        onChange={actions.onChangeDirection}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                </div>
                            }

                            {state.mode === 'bw' &&
                                <div className="table-form-row" style={{ marginBottom: '10px' }}>
                                    <div className="table-form-col table-form-col-label middle">
                                        Speed
                                    </div>
                                    <div className="table-form-col">
                                        <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                            <input
                                                type="number"
                                                className="form-control"
                                                style={{ borderRadius: 0 }}
                                                value={state.workSpeed}
                                                min={1}
                                                step={1}
                                                onChange={actions.onChangeWorkSpeed}
                                                disabled={state.stage < STAGE_IMAGE_LOADED}
                                            />
                                            <span className="input-group-addon">{'mm/minute'}</span>
                                        </div>
                                    </div>
                                </div>
                            }

                            <div className="table-form-row" style={{ marginBottom: '10px' }}>
                                <div className="table-form-col table-form-col-label middle">
                                    Quality
                                </div>
                                <div className="table-form-col">
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <input
                                            type="number"
                                            className="form-control"
                                            style={{ borderRadius: 0 }}
                                            value={state.quality}
                                            min={1}
                                            step={1}
                                            onChange={actions.onChangeQuality}
                                            disabled={state.stage < STAGE_IMAGE_LOADED}
                                        />
                                        <span className="input-group-addon">{'pixel/mm'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="table-form-row" style={{ marginBottom: '10px' }}>
                                <div className="table-form-col table-form-col-label middle">
                                    Width
                                </div>
                                <div className="table-form-col">
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <input
                                            type="number"
                                            className="form-control"
                                            style={{ borderRadius: 0 }}
                                            value={state.sizeWidth}
                                            onChange={actions.onChangeWidth}
                                            disabled={state.stage < STAGE_IMAGE_LOADED}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="table-form-row" style={{ marginBottom: '10px' }}>
                                <div className="table-form-col table-form-col-label middle">
                                    Height
                                </div>
                                <div className="table-form-col">
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <input
                                            type="number"
                                            className="form-control"
                                            style={{ borderRadius: 0 }}
                                            value={state.sizeHeight}
                                            onChange={actions.onChangeHeight}
                                            disabled={state.stage < STAGE_IMAGE_LOADED}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: '30px' }}>

                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={actions.onChangePreview}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                    style={{ display: 'block', width: '200px', marginLeft: 'auto', marginRight: 'auto', mariginTop: '10px', marginBottom: '10px' }}
                                >
                                    Preview
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={actions.onChangeGcode}
                                    disabled={state.stage < STAGE_PREVIEWD}
                                    style={{ display: 'block', width: '200px', marginLeft: 'auto', marginRight: 'auto', mariginTop: '10px', marginBottom: '10px' }}
                                >
                                    GenerateGCode
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={actions.onLoadGcode}
                                    disabled={state.stage < STAGE_GENERATED}
                                    style={{ display: 'block', width: '200px', marginLeft: 'auto', marginRight: 'auto', mariginTop: '10px', marginBottom: '10px' }}
                                >
                                    Load
                                </button>

                            </div>
                        </div>
                    </div>
                </div>

            </div>
        );
    }
}

export default withRouter(Laser);
