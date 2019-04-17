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
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired
        // selectedIndex: PropTypes.array.isRequired
    };

    state = {
        tracePaths: [],
        selectedIndex: new Set()
        // selectedIndexUpdated: 0 // +new Date()
    };

    actions = {
        uploadTrace: (filenames) => {
            if (filenames) {
                const uploadMode = this.state.uploadMode;
                for (const file of filenames) {
                    this.props.uploadImage(file, uploadMode, () => {
                        modal({
                            title: i18n._('Parse Trace Error'),
                            body: i18n._('Failed to parse image file {{filename}}', { filename: file })
                        });
                    });
                }
            }
        }
    };

    controllerEvents = {
        'task:state': (tracePaths) => {
            this.setState({
                tracePaths: tracePaths
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
        const selected = this.state.selectedIndex;
        if (selected.has(index)) {
            selected.delete(index);
        } else {
            selected.add(index);
        }
        this.setState({
            selectedIndex: selected
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
        const filenames = this.state.tracePaths.filenames;
        return (
            <div>
                {this.listImages(filenames)}
                <div style={{ margin: '20px 60px' }}>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={this.actions.uploadTrace(filenames)}
                        style={{ width: '40%', float: 'left' }}
                    >
                        {i18n._('TODO1')}
                    </button>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={() => {
                            this.actions.uploadTrace(filenames);
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
        // tracePaths: state.tracePaths,
        // selectedIndex: state.selectedIndex
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, mode, onFailure) => dispatch(actions.uploadImage('laser', file, mode, onFailure))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(TracePreview);
