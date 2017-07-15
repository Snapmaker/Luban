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
        changeContrast: (value) => {
            const contrast = Number(value) || 0;
            this.setState({
                ...this.state.contrast,
                contrast,
                stage: STAGE_IMAGE_LOADED
            });
        },
        changeBrightness: (value) => {
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
        changeAlgorithm: (options) => {
            this.setState({
                ...this.state.algorithm,
                algorithm: options.value,
                stage: STAGE_IMAGE_LOADED
            });
        },
        changeDwellTime: (event) => {
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
        changeQuality: (event) => {
            const value = event.target.value;
            if (typeof value === 'string' && value.trim() === '') {
                this.setState({
                    ...this.state.quality,
                    quality: '',
                    stage: STAGE_IMAGE_LOADED
                });
            } else {
                this.setState({
                    ...this.state.quality,
                    quality: value > 10 ? 10 : ensurePositiveNumber(value),
                    stage: STAGE_IMAGE_LOADED
                });
            }
        },
        onChangeWidth: (event) => {
            const value = event.target.value;
            const scale = this.state.originHeight / this.state.originWidth;

            this.setState({
                ...this.state.imageWidth,
                ...this.state.imageHeight,
                imageWidth: value,
                imageHeight: value * scale,
                stage: STAGE_IMAGE_LOADED
            });
        },
        onChangeHeight: (event) => {
            const value = event.target.value;
            const scale = this.state.originHeight / this.state.originWidth;

            console.log(value);
            console.log(scale);

            this.setState({
                ...this.state.imageWidth,
                ...this.state.imageHeight,
                imageWidth: value / scale,
                imageHeight: value,
                stage: STAGE_IMAGE_LOADED
            });
        },
        changePreview: () => {
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
                    ...that.state.imageWidth,
                    ...that.state.imageHeight,
                    originWidth: this.width,
                    originHeight: this.height,
                    imageWidth: this.width,
                    imageHeight: this.height
                });
            };
            img.src = _URL.createObjectURL(file);

            api.uploadImage(formdata).then((res) => {
                this.setState({
                    ...this.state.imageSrc,
                    originSrc: `./images/${res.text}`,
                    imageSrc: `./images/${res.text}`,
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
                pubsub.publish('gcode:load', { name: gcodeSrc, gcode: result });
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
            contrast: 50,
            brightness: 50,
            whiteClip: 255,
            algorithm: 'FloyedSteinburg',
            dwellTime: 0.0417,
            speed: 288,
            quality: 10,
            originSrc: '-',
            originWidth: 0,
            originHeight: 0,
            imageSrc: './images/doggy.png',
            imageWidth: 0,
            imageHeight: 0,
            gcodeSrc: '-',
            stage: STAGE_INITIAL
        };
    }

    test() {
        console.log('Hooooooooooray!');
    }

    render() {
        const style = this.props.style;
        const state = { ...this.state };
        const actions = { ...this.actions };
        return (
            <div style={style}>

                <div style={{ position: 'fixed', left: '60px', right: '420px', top: '51px', bottom: '0' }}>
                    <LaserVisiualizer widgetId="laserVisiualizer" state={state} />
                </div>

                <div style={{ position: 'absolute', width: '400px', right: '0px' }}>

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
                        onClick={::this.test}
                    >
                        Upload Image
                    </button>
                    <div className="table-form-row">
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
                                onChange={actions.changeContrast}
                                disabled={state.stage < STAGE_IMAGE_LOADED}
                            />
                        </div>
                    </div>

                    <div className="table-form-row">
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
                                onChange={actions.changeBrightness}
                                disabled={state.stage < STAGE_IMAGE_LOADED}
                            />
                        </div>
                    </div>

                    <div className="table-form-row">
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

                    <div className="form-group">
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
                            onChange={actions.changeAlgorithm}
                            disabled={state.stage < STAGE_IMAGE_LOADED}
                        />
                    </div>

                    <div className="table-form-row">
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
                                    onChange={actions.changeDwellTime}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
                                <span className="input-group-addon">{'ms/pixel'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="table-form-row">
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
                                    onChange={actions.changeQuality}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
                                <span className="input-group-addon">{'pixel/mm'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="table-form-row">
                        <div className="table-form-col table-form-col-label middle">
                            Width
                        </div>
                        <div className="table-form-col">
                            <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                <input
                                    type="number"
                                    className="form-control"
                                    style={{ borderRadius: 0 }}
                                    value={state.imageWidth}
                                    onChange={actions.onChangeWidth}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="table-form-row">
                        <div className="table-form-col table-form-col-label middle">
                            Height
                        </div>
                        <div className="table-form-col">
                            <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                <input
                                    type="number"
                                    className="form-control"
                                    style={{ borderRadius: 0 }}
                                    value={state.imageHeight}
                                    onChange={actions.onChangeHeight}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="btn-group" role="group">
                        <button
                            type="button"
                            className="btn btn-default"
                            onClick={actions.changePreview}
                            disabled={state.stage < STAGE_IMAGE_LOADED}
                        >
                            Preview
                        </button>
                    </div>


                    <div className="btn-group" role="group">
                        <button
                            type="button"
                            className="btn btn-default"
                            onClick={actions.onChangeGcode}
                            disabled={state.stage < STAGE_PREVIEWD}
                        >
                            GenerateGCode
                        </button>
                    </div>

                    <div className="btn-group" role="group">
                        <button
                            type="button"
                            className="btn btn-default"
                            onClick={actions.onLoadGcode}
                            disabled={state.stage < STAGE_GENERATED}
                        >
                            Load
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}

export default withRouter(Laser);
