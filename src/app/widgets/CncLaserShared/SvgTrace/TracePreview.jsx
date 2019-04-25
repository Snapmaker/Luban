import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import Tooltip from 'rc-tooltip';
import Detector from 'three/examples/js/Detector';
// import { NumberInput as Input } from '../../../components/Input';
// import modal from '../../../lib/modal';
import i18n from '../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';
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
        generateModel: PropTypes.func.isRequired,
        state: PropTypes.shape({
            mode: PropTypes.string.isRequired,
            options: PropTypes.object.isRequired,
            traceFilenames: PropTypes.array.isRequired,
            status: PropTypes.string.isRequired,
            modalSetting: PropTypes.object.isRequired,
            showModal: PropTypes.bool.isRequired
        }),
        actions: PropTypes.shape({
            hideModal: PropTypes.func.isRequired,
            processTrace: PropTypes.func.isRequired,
            updateOptions: PropTypes.func.isRequired
        })
    };

    state = {
        isUploadSVG: false,
        previewSettings: {
            previewWidth: 100,
            previewHeight: 100
        },
        marks: {
            turdSize: { 2: 2, 20: 20, 40: 40, 60: 60, 80: 80, 100: 100 },
            objects: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
        },
        selectedFilenames: new Set()
    };

    actions = {
        uploadTrace: (filenames) => {
            if (filenames) {
                const name = this.props.state.options.name;
                const width = this.props.state.options.width;
                const height = this.props.state.options.height;
                const from = this.props.state.from;
                const mode = this.props.state.mode;
                for (const filename of filenames) {
                    this.props.generateModel(from, name, filename, width, height, mode, () => {});
                }
            }
        },
        clearSelectedFilenames: () => {
            this.setState({
                selectedFilenames: new Set()
            });
        }
    };

    onSelectedImage(index) {
        const selectedFilenames = this.state.selectedFilenames;
        const filename = this.props.state.traceFilenames[index];
        if (selectedFilenames.has(filename)) {
            selectedFilenames.delete(filename);
        } else {
            selectedFilenames.add(filename);
        }
        this.setState({
            selectedFilenames: selectedFilenames
        });
    }

    listImages = (filenames) => {
        if (!filenames) {
            return null;
        }
        return filenames.map((filename, index) => {
            return this.addImage(filename, index, this.state.previewSettings);
        });
    }

    addImage = (filename, index, previewSettings) => {
        const src = `${WEB_CACHE_IMAGE}/${filename}`;
        let btnBG = this.state.selectedFilenames.has(filename) ? 'LightGray' : 'white';
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

    componentDidMount() {
        const { width, height } = this.props.state.modalSetting;
        const whRatio = this.props.state.options.height / this.props.state.options.width;
        const imgCount = this.props.state.traceFilenames.length;
        const imgCountSR = Math.ceil(Math.sqrt(imgCount));
        const imgCols = imgCountSR;
        const imgRows = Math.ceil(imgCount / imgCols);
        const previewWidth = Math.floor((width - 24 - 4 * imgCols) / imgCols);
        // const previewHeight = Math.ceil(height / imgCountSR) * whRatio;
        const previewHeight = Math.floor(previewWidth * whRatio);
        let heightOffset = 0;
        if (this.state.isUploadSVG) {
            heightOffset = 4 * imgRows + 26 + 48 + 32;
        } else {
            heightOffset = 4 * imgRows + 26 + 51 * 2 + 48 + 32; // title + slicer * 4 + button + offset
        }

        const heightAllowance = height - heightOffset - previewHeight * imgRows;
        if (heightAllowance !== 0 && imgCount > 0) {
            this.props.actions.updateModalSetting({ height: height - heightAllowance });
        }

        const newState = {};
        const previewSettings = {
            previewWidth: previewWidth,
            previewHeight: previewHeight
        };
        Object.assign(newState, {
            previewSettings: previewSettings
        });
        this.setState(newState);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.state.traceFilenames !== this.props.state.traceFilenames) {
            const { width, height } = nextProps.state.modalSetting;
            const whRatio = nextProps.state.options.height / nextProps.state.options.width;
            const imgCount = nextProps.state.traceFilenames.length;
            const imgCountSR = Math.ceil(Math.sqrt(imgCount));
            const imgCols = imgCountSR;
            const imgRows = Math.ceil(imgCount / imgCols);
            const previewWidth = Math.floor((width - 24 - 4 * imgCols) / imgCols);
            // const previewHeight = Math.ceil(height / imgCountSR) * whRatio;
            const previewHeight = Math.floor(previewWidth * whRatio);
            let heightOffset = 0;
            if (this.state.isUploadSVG) {
                heightOffset = 4 * imgRows + 26 + 48 + 32;
            } else {
                heightOffset = 4 * imgRows + 26 + 51 * 2 + 48 + 32; // title + slicer * 4 + button + offset
            }

            const heightAllowance = height - heightOffset - previewHeight * imgRows;
            if (heightAllowance !== 0 && imgCount > 0) {
                this.props.actions.updateModalSetting({ height: height - heightAllowance });
            }

            const newState = {};
            const previewSettings = {
                previewWidth: previewWidth,
                previewHeight: previewHeight
            };
            Object.assign(newState, {
                previewSettings: previewSettings
            });
            this.setState(newState);
        }
    }

    render() {
        if (!Detector.webgl) {
            return null;
        }
        const filenames = this.props.state.traceFilenames;
        // const extname = this.props.state.options.name.substring(-4, -1);
        const originalFilename = this.props.state.options.name;
        const extname = originalFilename.slice(-3);
        const isUploadSVG = extname === 'svg';
        this.state.isUploadSVG = isUploadSVG;
        // console.log('svg', this.state.isUploadSVG);
        const { turdSize, objects } = this.props.state.options;
        const marks = this.state.marks;
        let status = this.props.state.status;
        return (
            <div style={{ padding: '0px 10px 0px 10px' }}>
                {!isUploadSVG && (
                    <table className={styles['trace-table']}>
                        <tbody>
                            <tr>
                                <td className={styles['trace-td-title']}>
                                    <TipTrigger
                                        title={i18n._('Area Filter')}
                                        content={i18n._('The threshold to remove the small graphs based on area.')}
                                    >
                                        <p className={styles['trace-td-title-p']}>{i18n._('Area Filter')}</p>
                                    </TipTrigger>
                                </td>
                                <td className={styles['trace-td-slider']}>
                                    <Slider
                                        value={turdSize}
                                        min={2}
                                        max={100}
                                        step={1}
                                        marks={marks.turdSize}
                                        handle={handle}
                                        onChange={(value) => {
                                            this.props.actions.updateOptions({ turdSize: value });
                                        }}
                                        onAfterChange={() => {
                                            status = 'Busy';
                                            this.props.actions.processTrace();
                                            this.actions.clearSelectedFilenames();
                                        }}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td className={styles['trace-td-title']}>
                                    <TipTrigger
                                        title={i18n._('Objects')}
                                        content={i18n._('The number of objects.')}
                                    >
                                        <p className={styles['trace-td-title-p']}>{i18n._('Objects')}</p>
                                    </TipTrigger>
                                </td>
                                <td className={styles['trace-td-slider']}>
                                    <Slider
                                        value={objects}
                                        min={1}
                                        max={10}
                                        step={1}
                                        marks={marks.objects}
                                        handle={handle}
                                        onChange={(value) => {
                                            this.props.actions.updateOptions({ objects: value });
                                        }}
                                        onAfterChange={() => {
                                            status = 'Busy';
                                            this.props.actions.processTrace();
                                            this.actions.clearSelectedFilenames();
                                        }}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                )}
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
                                <TipTrigger
                                    content={i18n._('Before upload, please click the images.')}
                                >
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
                                </TipTrigger>
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
    const { isUploadSVG, previewSettings, selectedFilenames } = state;
    return {
        isUploadSVG,
        previewSettings,
        selectedFilenames
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        generateModel: (from, name, filename, width, height, mode, onFailure) => dispatch(actions.generateModel(from, name, filename, width, height, mode, onFailure))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(TracePreview);
