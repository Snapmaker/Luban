import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import Select from 'react-select';
import Detector from 'three/examples/js/Detector';
import i18n from '../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';
import { WEB_CACHE_IMAGE } from '../../../constants';
import { actions } from '../../../reducers/cncLaserShared';
import styles from '../styles.styl';

class TracePreview extends Component {
    static propTypes = {
        generateModel: PropTypes.func.isRequired,
        state: PropTypes.shape({
            from: PropTypes.string.isRequired,
            mode: PropTypes.string.isRequired,
            options: PropTypes.object.isRequired,
            traceFilenames: PropTypes.array.isRequired,
            status: PropTypes.string.isRequired,
            modalSetting: PropTypes.object.isRequired,
            showModal: PropTypes.bool.isRequired
        }),
        actions: PropTypes.shape({
            hideModal: PropTypes.func.isRequired,
            updateModalSetting: PropTypes.func.isRequired,
            processTrace: PropTypes.func.isRequired,
            updateOptions: PropTypes.func.isRequired
        })
    };

    state = {
        isUploadSVG: false,
        mode: 'vector',
        previewSettings: {
            previewWidth: 100,
            previewHeight: 100
        },
        marks: {
            blackThreshold: { 0: 0, 10: 10, 20: 20, 30: 30, 40: 40, 50: 50, 60: 60, 70: 70, 80: 80, 90: 90, 100: 100 },
            maskThreshold: { 0: -30, 10: -20, 20: -10, 30: 0, 40: 10, 50: 20, 60: 30 },
            iterations: { 1: 1, 5: 5, 10: 10, 15: 15, 20: 20, 25: 25, 30: 30 },
            colorRange: { 0: 0, 5: 5, 10: 10, 15: 15, 20: 20, 25: 25, 30: 30 },
            numberOfObjects: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12 },
        },
        selectedIndices: new Set(),
        selectedFilenames: new Set()
    };

    actions = {
        uploadTrace: (filenames, mode) => {
            if (filenames) {
                const name = this.props.state.options.name;
                const width = this.props.state.options.width;
                const height = this.props.state.options.height;
                const from = this.props.state.from;
                for (const filename of filenames) {
                    this.props.generateModel(from, name, filename, width, height, mode);
                }
            }
        },
        selectUploadMode: (option) => {
            this.setState({ mode: option.value });
        },
        clearSelectedFilenames: () => {
            this.setState({
                selectedIndices: new Set(),
                selectedFilenames: new Set()
            });
        }
    };

    onSelectedImage(index) {
        const { selectedIndices, selectedFilenames } = this.state;
        const filename = this.props.state.traceFilenames[index];
        if (selectedIndices.has(index)) {
            selectedIndices.delete(index);
            selectedFilenames.delete(filename);
        } else {
            selectedIndices.add(index);
            selectedFilenames.add(filename);
        }
        this.setState({
            selectedIndices: selectedIndices,
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
    };

    addImage = (filename, index, previewSettings) => {
        const src = `${WEB_CACHE_IMAGE}/${filename}`;
        let btnBG = this.state.selectedIndices.has(index) ? 'light-gray' : 'white';
        return (
            <div key={index} className={styles['trace-image-div']}>
                <button
                    type="button"
                    style={{ background: btnBG, padding: '0' }}
                    onClick={() => {
                        this.onSelectedImage(index);
                    }}
                >
                    <img
                        src={src}
                        alt="trace"
                        width={previewSettings.previewWidth}
                        height={previewSettings.previewHeight}
                        draggable="false"
                    />
                </button>
            </div>
        );
    };

    componentDidMount() {
        const { width, height } = this.props.state.modalSetting;
        const whRatio = this.props.state.options.height / this.props.state.options.width;
        const imgCount = this.props.state.traceFilenames.length;
        const imgCountSR = Math.ceil(Math.sqrt(imgCount));
        const imgCols = imgCountSR;
        const imgRows = Math.ceil(imgCount / imgCols);
        const previewWidth = Math.floor((width - 24 - 4 * imgCols) / imgCols);
        const previewHeight = Math.floor(previewWidth * whRatio);
        let heightOffset = 0;
        if (this.state.isUploadSVG) {
            heightOffset = 4 * imgRows + 26 + 48 + 32;
        } else {
            heightOffset = 4 * imgRows + 26 + 44 * 5 + 48 + 32; // title + slicer * n + button + offset
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
        if (nextProps.state.traceFilenames.length !== this.props.state.traceFilenames.length) {
            const { width, height } = nextProps.state.modalSetting;
            const whRatio = nextProps.state.options.height / nextProps.state.options.width;
            const imgCount = nextProps.state.traceFilenames.length;
            const imgCountSR = Math.ceil(Math.sqrt(imgCount));
            const imgCols = imgCountSR;
            const imgRows = Math.ceil(imgCount / imgCols);
            const previewWidth = Math.floor((width - 24 - 4 * imgCols) / imgCols);
            const previewHeight = Math.floor(previewWidth * whRatio);
            let heightOffset = 0;
            if (this.state.isUploadSVG) {
                heightOffset = 4 * imgRows + 26 + 48 + 24;
            } else {
                // heightOffset = 4 * imgRows + 26 + 51 * 3 + 48 + 32; // title + slicer * 3 + button + offset
                heightOffset = 4 * imgRows + 26 + 44 * 5 + 48 + 32; // title + slicer * 3 + button + offset
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
        let status = this.props.state.status;
        const filenames = this.props.state.traceFilenames;
        const { name, blackThreshold, maskThreshold, iterations, colorRange, numberOfObjects } = this.props.state.options;
        const extname = name.slice(-3);
        const isUploadSVG = extname === 'svg';
        this.state.isUploadSVG = isUploadSVG;
        const { mode, marks } = this.state;
        return (
            <div style={{ padding: '0px 10px 0px 10px' }}>
                {!isUploadSVG && (
                    <table className={styles['trace-table']}>
                        <tbody>
                            <tr>
                                <td className={styles['trace-td-title']}>
                                    <TipTrigger
                                        title={i18n._('Black Threshold')}
                                        content={i18n._('Adjust the black trace.')}
                                    >
                                        <p className={styles['trace-td-title-p']}>{i18n._('Black')}</p>
                                    </TipTrigger>
                                </td>
                                <td className={styles['trace-td-slider']}>
                                    <Slider
                                        value={blackThreshold}
                                        min={0}
                                        max={100}
                                        step={1}
                                        marks={marks.blackThreshold}
                                        onChange={(value) => {
                                            this.props.actions.updateOptions({ blackThreshold: value });
                                        }}
                                        onAfterChange={() => {
                                            status = 'BUSY';
                                            this.props.actions.processTrace();
                                            this.actions.clearSelectedFilenames();
                                        }}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td className={styles['trace-td-title']}>
                                    <TipTrigger
                                        title={i18n._('Foreground')}
                                        content={i18n._('Adjust the foreground.')}
                                    >
                                        <p className={styles['trace-td-title-p']}>{i18n._('Foreground')}</p>
                                    </TipTrigger>
                                </td>
                                <td className={styles['trace-td-slider']}>
                                    <Slider
                                        value={maskThreshold}
                                        min={0}
                                        max={60}
                                        step={1}
                                        marks={marks.maskThreshold}
                                        onChange={(value) => {
                                            this.props.actions.updateOptions({ maskThreshold: value });
                                        }}
                                        onAfterChange={() => {
                                            status = 'BUSY';
                                            this.props.actions.processTrace();
                                            this.actions.clearSelectedFilenames();
                                        }}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td className={styles['trace-td-title']}>
                                    <TipTrigger
                                        title={i18n._('Dilation')}
                                        content={i18n._('Dilate the foreground mask gradually. Bigger values cost more time.')}
                                    >
                                        <p className={styles['trace-td-title-p']}>{i18n._('Dilation')}</p>
                                    </TipTrigger>
                                </td>
                                <td className={styles['trace-td-slider']}>
                                    <Slider
                                        value={iterations}
                                        min={1}
                                        max={30}
                                        step={1}
                                        marks={marks.iterations}
                                        onChange={(value) => {
                                            this.props.actions.updateOptions({ iterations: value });
                                        }}
                                        onAfterChange={() => {
                                            status = 'BUSY';
                                            this.props.actions.processTrace();
                                            this.actions.clearSelectedFilenames();
                                        }}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td className={styles['trace-td-title']}>
                                    <TipTrigger
                                        title={i18n._('Color Range')}
                                        content={i18n._('Adjust the color range of each trace.')}
                                    >
                                        <p className={styles['trace-td-title-p']}>{i18n._('ColorRange')}</p>
                                    </TipTrigger>
                                </td>
                                <td className={styles['trace-td-slider']}>
                                    <Slider
                                        value={colorRange}
                                        min={0}
                                        max={30}
                                        step={1}
                                        marks={marks.colorRange}
                                        onChange={(value) => {
                                            this.props.actions.updateOptions({ colorRange: value });
                                        }}
                                        onAfterChange={() => {
                                            status = 'BUSY';
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
                                        content={i18n._('The number of the output objects.')}
                                    >
                                        <p className={styles['trace-td-title-p']}>{i18n._('Objects')}</p>
                                    </TipTrigger>
                                </td>
                                <td className={styles['trace-td-slider']}>
                                    <Slider
                                        value={numberOfObjects}
                                        min={1}
                                        max={12}
                                        step={1}
                                        marks={marks.numberOfObjects}
                                        onChange={(value) => {
                                            this.props.actions.updateOptions({ numberOfObjects: value });
                                        }}
                                        onAfterChange={() => {
                                            status = 'BUSY';
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
                            <td
                                className={styles['trace-td-image']}
                                style={{ padding: '0 0 0 0' }}
                            >
                                {this.listImages(filenames)}
                            </td>
                        </tr>
                    </tbody>
                </table>
                <table className={styles['trace-table']}>
                    <tbody>
                        <tr>
                            <td style={{ width: '302px' }}>
                                <p className={styles['trace-status']}>{i18n._('Status: {{status}}', { status: status })}</p>
                            </td>
                            <td style={{ width: '90px' }}>
                                <p className={styles['trace-status']}>{i18n._('Upload As: ')}</p>
                            </td>
                            <td>
                                {!isUploadSVG && (
                                    <Select
                                        style={{ width: '120px' }}
                                        clearable={false}
                                        options={[{
                                            value: 'bw',
                                            label: i18n._('B&W')
                                        }, {
                                            value: 'greyscale',
                                            label: i18n._('GREYSCALE')
                                        }, {
                                            value: 'vector',
                                            label: i18n._('VECTOR')
                                        }]}
                                        value={mode}
                                        searchable={false}
                                        onChange={this.actions.selectUploadMode}
                                    />
                                )}
                                {isUploadSVG && (
                                    <Select
                                        style={{ width: '120px' }}
                                        clearable={false}
                                        options={[{
                                            value: 'vector',
                                            label: i18n._('VECTOR')
                                        }]}
                                        value={mode}
                                        searchable={false}
                                        onChange={this.actions.selectUploadMode}
                                    />
                                )}
                            </td>
                            <td>
                                <TipTrigger
                                    content={i18n._('Upload the selected images.')}
                                >
                                    <div className={styles['trace-btn-div']}>
                                        <button
                                            type="button"
                                            className="sm-btn-large sm-btn-default"
                                            onClick={() => {
                                                this.actions.uploadTrace(this.state.selectedFilenames, mode);
                                            }}
                                            style={{ width: '80px' }}
                                        >
                                            {i18n._('UPLOAD')}
                                        </button>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { isUploadSVG, previewSettings, selectedIndices, selectedFilenames } = state;
    return {
        isUploadSVG,
        previewSettings,
        selectedIndices,
        selectedFilenames
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        generateModel: (from, name, filename, width, height, mode) => dispatch(actions.generateModel(from, name, filename, width, height, mode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(TracePreview);
