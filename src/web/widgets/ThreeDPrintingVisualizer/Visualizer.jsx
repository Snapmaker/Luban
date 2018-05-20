import React, { PureComponent } from 'react';
import pubsub from 'pubsub-js';
import api from '../../api';
import Canvas from './Canvas';
import VisualizerTopLeft from './VisualizerTopLeft';
import VisualizerModelOperations from './VisualizerModelOperations';
import VisualizerCameraOperations from './VisualizerCameraOperations';
import styles from './styles.styl';


class Visualizer extends PureComponent {
    state = {
        modelFileName: '',

        // top left
        undoMatrix4Array: [],
        redoMatrix4Array: [],

        // model operations
        moveX: 0,
        moveY: 0,
        moveZ: 0,
        scale: 100,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,

        _: 0 // placeholder
    };

    actions = {
        onChangeFile: (event) => {
            const files = event.target.files;
            const formData = new FormData();
            formData.append('file', files[0]);

            api.uploadFile(formData).then((res) => {
                const file = res.body;
                this.setState({
                    modelFileName: file.filename
                });
            });
        },
        onModelOperationChanged: (state) => {
            this.setState(state);
            // make changes based on model operations
        },
        onUndo: () => {
            console.info('onUndo');
            // call outer action to perform undo
        },
        onRedo: () => {
            console.info('onRedo');
            // call outer action to perform redo
        },
        onReset: () => {
            console.info('onReset');
            // call outer action to perform reset
        }
    };

    subscriptions = [];

    componentDidMount() {
        this.subscriptions = [];
    }

    componentWillUnmount() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
    }

    render() {
        const state = this.state;
        const actions = this.actions;

        return (
            <React.Fragment>
                <div className={styles['visualizer-top-left']}>
                    <VisualizerTopLeft actions={actions} state={state} />
                </div>

                <div className={styles['visualizer-model-operations']}>
                    <VisualizerModelOperations actions={actions} state={state} />
                </div>

                <div className={styles['visualizer-camera-operations']}>
                    <VisualizerCameraOperations actions={actions} state={state} />
                </div>

                <div className={styles.canvas}>
                    <Canvas />
                </div>
            </React.Fragment>
        );
    }
}

export default Visualizer;
