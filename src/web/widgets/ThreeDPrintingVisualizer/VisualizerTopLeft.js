import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';


class VisualizerTopLeft extends PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
            onChangeFile: PropTypes.func
        }),
        state: PropTypes.object
    };

    fileInputEl = null;

    actions = {
        onClickToUpload: () => {
            this.fileInputEl.value = null;
            this.fileInputEl.click();
        }
    };

    render() {
        const actions = {
            ...this.props.actions,
            ...this.actions
        };

        return (
            <React.Fragment>
                <input
                    ref={(node) => {
                        this.fileInputEl = node;
                    }}
                    type="file"
                    accept=".stl, .obj"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                <button
                    type="button"
                    className="btn btn-primary"
                    title="Upload File"
                    onClick={actions.onClickToUpload}
                >
                    Upload File
                </button>
            </React.Fragment>
        );
    }
}

export default VisualizerTopLeft;
