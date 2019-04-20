import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import Tooltip from 'rc-tooltip';
import Detector from 'three/examples/js/Detector';
// import { NumberInput as Input } from '../../../components/Input';
// import modal from '../../../lib/modal';
import i18n from '../../../lib/i18n';
import { WEB_CACHE_IMAGE } from '../../../constants';
import { actions } from '../../../reducers/cncLaserShared';
import styles from '../styles.styl';

// http://react-component.github.io/slider/examples/handle.html // not work
// const createSliderWithTooltip = Slider.createSliderWithTooltip;
// const Range = createSliderWithTooltip(Slider.Range);
const Handle = Slider.Handle;

const handle = (props) => {
    const { value, dragging, index, ...restProps } = props;
    return (
        <Tooltip
            prefixCls="rc-slider-tooltip"
            overlay={value}
            visible={dragging}
            placement="top"
            key={index}
        >
            <Handle value={value} {...restProps} />
        </Tooltip>
    );
};

class TracePreview extends Component {
    static propTypes = {
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired,
        generateModel: PropTypes.func.isRequired,
        state: PropTypes.shape({
            mode: PropTypes.string.isRequired,
            options: PropTypes.object.isRequired,
            traceFilenames: PropTypes.array.isRequired,
            status: PropTypes.string.isRequired,
            showModal: PropTypes.bool.isRequired
        }),
        actions: PropTypes.shape({
            hideModal: PropTypes.func.isRequired,
            processTrace: PropTypes.func.isRequired,
            updateOptions: PropTypes.func.isRequired
        })
    };

    state = {
        previewSettings: {
            previewWidth: 0,
            previewHeight: 0
        },
        marks: {
            turdSize: { 2: 2, 20: 20, 40: 40, 60: 60, 80: 80, 100: 100 },
            // amplifier: { 1: 1, 64: 64, 256: 256, 512: 512, 1024: 1024 },
            amplifier: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
            threshold: { 0: 0, 64: 64, 128: 128, 192: 192, 255: 255 },
            thV: { 0: 0, 20: 20, 40: 40, 60: 60, 80: 80, 100: 100 }
        },
        // widthOffset: 24,
        turdSizeBase: this.props.state.options.turdSize,
        amplifier: 1,
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
        },
        updateTurdSize: (turdSize) => {
            this.props.actions.updateOptions({ turdSize });
        },
        updateThreshold: (threshold) => {
            this.props.actions.updateOptions({ threshold });
        },
        updateThV: (thV) => {
            this.props.actions.updateOptions({ thV });
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
        const whRatio = this.props.state.options.height / this.props.state.options.width;
        const imgCount = filenames.length;
        const imgCountSR = Math.ceil(Math.sqrt(imgCount)) + 1;
        const previewWidth = Math.ceil(width / imgCountSR);
        const previewHeight = Math.ceil(height / imgCountSR) * whRatio;
        /*
        const widthOffset = Math.floor((width - 24 - previewWidth * (imgCountSR - 1)) / 2);
        this.setState({
            // widthOffset: widthOffset
        });
        this.state.widthOffset = widthOffset; // TODO
        */
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
            <div key={index} className={styles['trace-image-div']}>
                <button
                    type="button"
                    style={{ background: btnBG, padding: '0 0 0 0' }}
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
        const { threshold, thV } = this.props.state.options;
        const turdSizeBase = this.state.turdSizeBase;
        const amplifier = this.state.amplifier;
        const marks = this.state.marks;
        let status = this.props.state.status;
        // const widthOffset = this.state.widthOffset;
        return (
            <div style={{ padding: '0px 10px 0px 10px' }}>
                <table className={styles['trace-table']}>
                    <tbody>
                        <tr>
                            <td className={styles['trace-td-title']}>
                                <p className={styles['trace-td-title-p']}>{i18n._('Grayscale')}</p>
                            </td>
                            <td className={styles['trace-td-slider']}>
                                <Slider
                                    value={threshold}
                                    min={0}
                                    max={255}
                                    step={1}
                                    marks={marks.threshold}
                                    handle={handle}
                                    onChange={(value) => {
                                        this.actions.updateThreshold(value);
                                    }}
                                    onAfterChange={() => {
                                        status = 'Busy';
                                        this.props.actions.processTrace();
                                    }}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td className={styles['trace-td-title']}>
                                <p className={styles['trace-td-title-p']}>{i18n._('V of HSV')}</p>
                            </td>
                            <td className={styles['trace-td-slider']}>
                                <Slider
                                    value={thV}
                                    min={0}
                                    max={100}
                                    step={1}
                                    marks={marks.thV}
                                    handle={handle}
                                    onChange={(value) => {
                                        this.actions.updateThV(value);
                                    }}
                                    onAfterChange={() => {
                                        status = 'Busy';
                                        this.props.actions.processTrace();
                                    }}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td className={styles['trace-td-title']}>
                                <p className={styles['trace-td-title-p']}>{i18n._('Area Filter')}</p>
                            </td>
                            <td className={styles['trace-td-slider']}>
                                <Slider
                                    value={turdSizeBase}
                                    min={2}
                                    max={100}
                                    step={1}
                                    marks={marks.turdSize}
                                    handle={handle}
                                    onChange={(value) => {
                                        this.state.turdSizeBase = value;
                                        const turdSize = value * Math.pow(2, this.state.amplifier);
                                        this.actions.updateTurdSize(turdSize);
                                    }}
                                    onAfterChange={() => {
                                        status = 'Busy';
                                        this.props.actions.processTrace();
                                    }}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td className={styles['trace-td-title']}>
                                <p className={styles['trace-td-title-p']}>{i18n._('Exponent')}</p>
                            </td>
                            <td className={styles['trace-td-slider']}>
                                <Slider
                                    value={amplifier}
                                    min={1}
                                    max={10}
                                    step={1}
                                    marks={marks.amplifier}
                                    handle={handle}
                                    onChange={(value) => {
                                        this.state.amplifier = value;
                                        const turdSize = turdSizeBase * Math.pow(2, value);
                                        this.actions.updateTurdSize(turdSize);
                                    }}
                                    onAfterChange={() => {
                                        status = 'Busy';
                                        this.props.actions.processTrace();
                                    }}
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
                <table className={styles['trace-table']}>
                    <tbody>
                        <tr>
                            <td>
                                <div className={styles['trace-btn-div']}>
                                    <button
                                        type="button"
                                        className="sm-btn-large sm-btn-primary"
                                        onClick={() => {
                                            this.props.actions.hideModal();
                                        }}
                                        style={{ width: '70px' }}
                                    >
                                        {i18n._('Close')}
                                    </button>
                                </div>
                            </td>
                            <td style={{ width: '20%' }}>
                                <p className={styles['trace-status']}>{i18n._('status: {{status}}', { status: status })}</p>
                            </td>
                            <td>
                                <div className={styles['trace-btn-div']}>
                                    <button
                                        type="button"
                                        className="sm-btn-large sm-btn-primary"
                                        onClick={() => {
                                            this.actions.uploadTrace(this.state.selectedFilenames);
                                        }}
                                        style={{ width: '70px' }}
                                    >
                                        {i18n._('Upload')}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <table className={styles['trace-table']}>
                    <tbody>
                        <tr>
                            <td
                                className={styles['trace-td-image']}
                                style={{ padding: '0 0 0 0' }}
                            >
                                {this.listImages(filenames)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        generateModel: (name, filename, width, height, mode, onFailure) => dispatch(actions.generateModel('laser', name, filename, width, height, mode, onFailure))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(TracePreview);
