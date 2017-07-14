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
            algorithm: 0,
            dwellTime: 0.0417,
            speed: 288,
            quality: 10,
            originSrc: '-',
            imageSrc: './images/doggy.png',
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
                            value: 1,
                            label: 'abc'
                        }, {
                            value: 2,
                            label: 'def'
                        }]}
                        placeholder={'choose algorithms'}
                        searchable={false}
                        value={state.algorithm}
                        onChange={actions.changeAlgorithm}
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
                            />
                            <span className="input-group-addon">{'pixel/mm'}</span>
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

                <div>
                    {this.state.gcodeSrc}
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
                <img src={state.imageSrc} alt="aha" />
                <div style={{ position: 'relative' }}>
                    <LaserVisiualizer widgetId="laserVisiualizer" state={state} />
                </div>
            </div>
        );
    }
}

export default withRouter(Laser);
