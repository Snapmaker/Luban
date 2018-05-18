import React, { PureComponent } from 'react';
import api from '../../api';
import Canvas from './Canvas';
import VisualizerTopLeft from './VisualizerTopLeft';
import VisualizerModelOperations from './VisualizerModelOperations';
import VisualizerCameraOperations from './VisualizerCameraOperations';
import styles from './styles.styl';


class Visualizer extends PureComponent {
    state = {
        modelFileName: ''
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
        }
    };

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
