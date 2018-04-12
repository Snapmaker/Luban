import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import controller from '../../lib/controller';
import api from '../../api';
import {
    CURA_CONFIG_PATH
} from '../../constants';

class Print3D extends Component {

    fileInputEl = null;

    onClickToUpload() {
        this.fileInputEl.value = null;
        this.fileInputEl.click();
    }
    actions = {
        onChangeFile: (event) => {
            const files = event.target.files;
            const formData = new FormData();
            formData.append('file', files[0]);

            api.uploadFile(formData).then((res) => {
                const file = res.body;
                this.setState({
                    modelFilePath: `${file.filePath}`,
                    configFilePath: `${CURA_CONFIG_PATH}`
                });
                console.log('filePath:' + file.filePath);
                console.log('filename:' + file.filename);
            });
        }
    }
    constructor(props) {
        super(props);
        this.state = {
            sliceProgress: undefined,
            gcodePath: undefined,
            printTime: undefined,
            filamentLength: undefined,
            filamentWeight: undefined,
            modelFilePath: undefined,
            configFilePath: undefined
        };
    }

    onSlice() {
        controller.print3DSlice({
            modelFilePath: this.state.modelFilePath,
            configFilePath: this.state.configFilePath
        });
    }

    controllerEvents = {
        'print3D:gcode-generated': (args) => {
            console.log('@ args:' + JSON.stringify(args));
            this.setState({
                sliceProgress: 1,
                gcodePath: args.gcodePath,
                printTime: args.printTime,
                filamentLength: args.filamentLength,
                filamentWeight: args.filamentWeight
            });
        },
        'print3D:gcode-slice-progress': (sliceProgress) => {
            console.log('@ sliceProgress:' + sliceProgress);
            this.setState({
                sliceProgress: sliceProgress
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
    render() {
        const style = this.props.style;
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
                    accept={'.stl, .obj'}
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                <button onClick={::this.onClickToUpload}>
                    load model
                </button>
                <button onClick={::this.onSlice}>
                    slice
                </button>
                <button >
                    {this.state.sliceProgress}
                </button>
                <button >
                    {this.state.gcodePath}
                </button>
                <button >
                    {this.state.printTime}
                </button>
                <button >
                    {this.state.filamentLength}
                </button>
                <button >
                    {this.state.filamentWeight}
                </button>
                <button >
                    {this.state.modelFilePath}
                </button>
                <button >
                    {this.state.configFilePath}
                </button>
            </div>
        );
    }
}

export default withRouter(Print3D);
