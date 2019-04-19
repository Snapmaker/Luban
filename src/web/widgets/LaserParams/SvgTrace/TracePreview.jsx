import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Detector from 'three/examples/js/Detector';
// import modal from '../../../lib/modal';
import i18n from '../../../lib/i18n';
import { WEB_CACHE_IMAGE } from '../../../constants';
import { actions } from '../../../reducers/cncLaserShared';

class TracePreview extends Component {
    static propTypes = {
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired,
        generateModel: PropTypes.func.isRequired,
        state: PropTypes.shape({
            mode: PropTypes.string.isRequired,
            options: PropTypes.object.isRequired,
            traceFilenames: PropTypes.array.isRequired,
            showModal: PropTypes.bool.isRequired
        }),
        actions: PropTypes.shape({
            hideModal: PropTypes.func.isRequired,
            updateOptions: PropTypes.func.isRequired
        })
    };

    state = {
        previewSettings: {
            previewWidth: 0,
            previewHeight: 0
        },
        selectedIndex: new Set(),
        selectedFilenames: new Set()
    };

    actions = {
        uploadTrace: (filenames) => {
            if (filenames) {
                const name = this.props.state.options.name;
                const width = this.props.state.options.width;
                const height = this.props.state.options.height;
                const mode = this.props.state.mode;
                for (const filename of filenames) {
                    this.props.generateModel(name, filename, width, height, mode, () => {});
                }
            }
        }
    };

    onSelectedImage(index) {
        const selectedIndex = this.state.selectedIndex;
        const selectedFilenames = this.state.selectedFilenames;
        if (selectedIndex.has(index)) {
            selectedIndex.delete(index);
            selectedFilenames.delete(this.props.state.traceFilenames[index]);
        } else {
            selectedIndex.add(index);
            selectedFilenames.add(this.props.state.traceFilenames[index]);
        }
        this.setState({
            selectedIndex: selectedIndex,
            selectedFilenames: selectedFilenames
        });
    }

    listImages = (filenames) => {
        if (!filenames) {
            return null;
        }
        const { width, height } = this.props;
        const imgCount = filenames.length;
        const imgCountSR = Math.ceil(Math.sqrt(imgCount));
        const previewWidth = Math.ceil(width / imgCountSR);
        const previewHeight = Math.ceil(height / imgCountSR);
        this.state.previewSettings = {
            previewWidth: previewWidth,
            previewHeight: previewHeight
        };

        return filenames.map((filename, index) => {
            return this.addImage(filename, index, this.state.previewSettings);
        });
    }

    addImage = (filename, index, previewSettings) => {
        const src = `${WEB_CACHE_IMAGE}/${filename}`;
        let btnBG = this.state.selectedIndex.has(index) ? 'LightGray' : 'white';
        return (
            <div key={index} style={{ float: 'left' }}>
                <button
                    type="button"
                    style={{ background: btnBG }}
                    onClick={() => {
                        this.onSelectedImage(index);
                    }}
                >
                    <img
                        src={src}
                        alt="trace"
                        width={previewSettings.previewWidth}
                        height={previewSettings.previewHeight}
                    />
                </button>
            </div>
        );
    }

    render() {
        if (!Detector.webgl) {
            return null;
        }
        const filenames = this.props.state.traceFilenames;
        const { width, height } = this.props;
        return (
            <div>
                {this.listImages(filenames)}
                {!this.listImages(filenames) && (
                    <div sytle={{ width: `${width}`, height: `${height}` }} />
                )}
                <div style={{ margin: '20px 60px' }}>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={() => {
                            this.props.actions.hideModal();
                        }}
                        style={{ width: '40%', float: 'left' }}
                    >
                        {i18n._('Close')}
                    </button>
                </div>
                <div style={{ margin: '20px 60px' }}>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={() => {
                            this.actions.uploadTrace(this.state.selectedFilenames);
                        }}
                        style={{ width: '40%', float: 'right' }}
                    >
                        {i18n._('Upload')}
                    </button>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        // options: state.options,
        // traceFilenames: state.traceFilenames
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        generateModel: (name, filename, width, height, mode, onFailure) => dispatch(actions.generateModel('laser', name, filename, width, height, mode, onFailure))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(TracePreview);
