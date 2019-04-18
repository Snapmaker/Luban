import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Detector from 'three/examples/js/Detector';
import modal from '../../../lib/modal';
import i18n from '../../../lib/i18n';
import controller from '../../../lib/controller';
import { WEB_CACHE_IMAGE } from '../../../constants';
import { actions } from '../../../reducers/cncLaserShared';

class TracePreview extends Component {
    static propTypes = {
        width: PropTypes.number,
        height: PropTypes.number,
        generateModel: PropTypes.func
    };

    state = {
        mode: 'trace',
        tracePaths: [],
        selectedIndex: new Set(),
        selectedFilenames: new Set()
        // selectedIndexUpdated: 0 // +new Date()
    };

    actions = {
        uploadTrace: (filenames) => {
            if (filenames) {
                const mode = this.state.mode;
                for (const filename of filenames) {
                    const img = new Image();
                    img.src = `${WEB_CACHE_IMAGE}/${filename}`;
                    const width = img.width;
                    const height = img.height;
                    this.props.generateModel(filename, width, height, mode, () => {
                        modal({
                            title: i18n._('Parse Trace Error'),
                            body: i18n._('Failed to parse image file {{filename}}', { filename: filename })
                        });
                    });
                }
            }
        }
    };

    controllerEvents = {
        'task:trace': (tracePaths) => {
            this.setState({
                tracePaths: tracePaths.filenames
            });
        }
    };

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

    componentDidMount() {
        this.addControllerEvents();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
    }

    onSelectedImage(index) {
        const selectedIndex = this.state.selectedIndex;
        const selectedFilenames = this.state.selectedFilenames;
        if (selectedIndex.has(index)) {
            selectedIndex.delete(index);
            selectedFilenames.delete(this.state.tracePaths[index]);
        } else {
            selectedIndex.add(index);
            selectedFilenames.add(this.state.tracePaths[index]);
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
        const imgWidth = Math.ceil(width / imgCountSR);
        const imgHeight = Math.ceil(height / imgCountSR);
        const options = {
            width: imgWidth,
            height: imgHeight
        };

        return filenames.map((filename, index) => {
            return this.addImage(filename, index, options);
        });
    }

    addImage = (filename, index, options) => {
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
                        width={options.width}
                        height={options.height}
                    />
                </button>
            </div>
        );
    }

    render() {
        if (!Detector.webgl) {
            return null;
        }
        const filenames = this.state.tracePaths;
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
                            this.actions.uploadTrace(this.state.selectedFilenames);
                        }}
                        style={{ width: '40%', float: 'right' }}
                    >
                        {i18n._('upload')}
                    </button>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        mode: state.uploadMode
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        generateModel: (filename, width, height, mode, onFailure) => dispatch(actions.generateModel('laser', filename, filename, width, height, mode, onFailure))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(TracePreview);
