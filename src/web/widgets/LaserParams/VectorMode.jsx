import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Slider from 'rc-slider';
import Select from 'react-select';
import {
    BOUND_SIZE,
    DEFAULT_RASTER_IMAGE,
    DEFAULT_SIZE_HEIGHT,
    DEFAULT_SIZE_WIDTH,
    DEFAULT_VECTOR_IMAGE
} from '../../constants';
import i18n from '../../lib/i18n';
import Space from '../../components/Space';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import OptionalDropdown from '../../components/OptionalDropdown';
import { actions } from '../../reducers/modules/laser';
import UploadControl from './UploadControl';
import styles from './styles.styl';


class VectorMode extends PureComponent {
    static propTypes = {
        source: PropTypes.object.isRequired,
        target: PropTypes.object.isRequired,
        params: PropTypes.object.isRequired,
        anchorOptions: PropTypes.array.isRequired,

        // actions from parent
        onChangeFile: PropTypes.func.isRequired,
        onChangeWidth: PropTypes.func.isRequired,
        onChangeHeight: PropTypes.func.isRequired,

        // redux actions
        changeSourceImage: PropTypes.func.isRequired,
        setTarget: PropTypes.func.isRequired,
        changeTargetSize: PropTypes.func.isRequired,
        setParams: PropTypes.func.isRequired,
        preview: PropTypes.func.isRequired
    };

    actions = {
        onChangeSubMode: (option) => {
            const defaultImage = option.value === 'raster' ? DEFAULT_RASTER_IMAGE : DEFAULT_VECTOR_IMAGE;
            this.props.setParams({ subMode: option.value });
            this.props.changeSourceImage(defaultImage, i18n._('(default image)'), DEFAULT_SIZE_WIDTH, DEFAULT_SIZE_HEIGHT);
            this.props.changeTargetSize(DEFAULT_SIZE_WIDTH / 10, DEFAULT_SIZE_HEIGHT / 10);
        },
        changeVectorThreshold: (vectorThreshold) => {
            this.props.setParams({ vectorThreshold });
        },
        onChangeTurdSize: (turdSize) => {
            this.props.setParams({ turdSize });
        },
        onToggleInvert: (event) => {
            this.props.setParams({ isInvert: event.target.checked });
        },
        onChangeAnchor: (option) => {
            this.props.setTarget({ anchor: option.value });
        },
        onToggleFill: () => {
            this.props.setParams({ fillEnabled: !this.props.params.fillEnabled });
        },
        onChangeFillDensity: (fillDensity) => {
            this.props.setParams({ fillDensity });
        },
        onToggleOptimizePath: (event) => {
            this.update({ optimizePath: event.target.checked });
        }
    };

    render() {
        const {
            source, target, params, anchorOptions,
            onChangeFile, onChangeWidth, onChangeHeight, preview
        } = this.props;
        const actions = this.actions;

        return (
            <div>
                <table className={styles['parameter-table']} style={{ marginTop: '15px' }}>
                    <tbody>
                        <tr>
                            <td>
                                {i18n._('Source Type')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Source Type')}
                                    content={i18n._('Select the type of the image you want to upload. Raster supports \
PNG and JPEG images, while SVG only supports SVG images. The Raster images will be transferred into SVG automatically.')}
                                >
                                    <Select
                                        backspaceRemoves={false}
                                        clearable={false}
                                        searchable={false}
                                        options={[{
                                            value: 'raster',
                                            label: i18n._('Raster')
                                        }, {
                                            value: 'svg',
                                            label: i18n._('SVG')
                                        }]}
                                        value={params.subMode}
                                        onChange={actions.onChangeSubMode}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <UploadControl
                    style={{ marginTop: '10px' }}
                    accept={params.subMode === 'svg' ? '.svg' : '.png, .jpg, .jpeg, .bmp'}
                    onChangeFile={onChangeFile}
                    filename={source.filename}
                    width={source.width}
                    height={source.height}
                />
                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
                        {params.subMode === 'raster' &&
                        <tr>
                            <td>
                                {i18n._('B&W')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('B&W')}
                                    content={i18n._('Set the proportion of the black color based on the original color of the image.')}
                                >
                                    <div className="text-center">{params.vectorThreshold}</div>
                                    <Slider
                                        style={{ padding: 0 }}
                                        defaultValue={params.vectorThreshold}
                                        min={0}
                                        max={255}
                                        step={1}
                                        onChange={actions.changeVectorThreshold}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>}
                        {params.subMode === 'raster' &&
                        <tr>
                            <td>
                                {i18n._('Impurity Size')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Impurity Size')}
                                    content={i18n._('Determines the minimum size of impurity which allows to be showed.')}
                                >
                                    <Input
                                        value={params.turdSize}
                                        min={0}
                                        max={10000}
                                        onChange={actions.onChangeTurdSize}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>}
                        {params.subMode === 'raster' &&
                        <tr>
                            <td />
                            <td>
                                <TipTrigger
                                    title={i18n._('Invert')}
                                    content={i18n._('Inverts black to white and vise versa.')}
                                >
                                    <input type="checkbox" defaultChecked={params.isInvert} onChange={actions.onToggleInvert} /> <span>{i18n._('Invert')}</span>
                                </TipTrigger>
                            </td>
                        </tr>}
                        <tr>
                            <td>
                                {i18n._('Size (mm)')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Size')}
                                    content={i18n._('Enter the size of the engraved picture. The size cannot be larger than 125 x 125 mm or the size of your material.')}
                                >
                                    <Input
                                        style={{ width: '45%' }}
                                        value={target.width}
                                        min={1}
                                        max={BOUND_SIZE}
                                        onChange={onChangeWidth}
                                    />
                                    <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                    <Input
                                        style={{ width: '45%' }}
                                        value={target.height}
                                        min={1}
                                        max={BOUND_SIZE}
                                        onChange={onChangeHeight}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Anchor')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Anchor')}
                                    content={i18n._('Find the anchor of the image to correspond to the (0, 0) coordinate.')}
                                >
                                    <Select
                                        backspaceRemoves={false}
                                        clearable={false}
                                        searchable={false}
                                        options={anchorOptions}
                                        placeholder={i18n._('Anchor')}
                                        value={target.anchor}
                                        onChange={actions.onChangeAnchor}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td />
                            <td>
                                <TipTrigger
                                    title={i18n._('Optimize Path')}
                                    content={i18n._('Optimizes the path based on the proximity of the lines in the image.')}
                                >
                                    <input
                                        type="checkbox"
                                        defaultChecked={params.optimizePath}
                                        onChange={actions.onToggleOptimizePath}
                                    />
                                    <Space width={4} />
                                    <span>{i18n._('Optimize Path')}</span>
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <OptionalDropdown
                    title={i18n._('Fill')}
                    onClick={this.actions.onToggleFill}
                    hidden={!params.fillEnabled}
                >
                    <table className={styles['parameter-table']}>
                        <tbody>
                            <tr>
                                <td>
                                    {i18n._('Fill Density')}
                                </td>
                                <td>
                                    <TipTrigger
                                        title={i18n._('Fill Density')}
                                        content={i18n._('Set the degree to which an area is filled with laser dots. The highest density is 20 dot/mm. When it is set to 0, the SVG image will be engraved without fill.')}
                                    >
                                        <div style={{ display: 'inline-block', width: '50%' }}>
                                            <Slider
                                                value={params.fillDensity}
                                                min={0}
                                                max={20}
                                                onChange={this.actions.onChangeFillDensity}
                                            />
                                        </div>
                                        <div style={{ display: 'inline-block', width: '10%' }} />
                                        <Input
                                            style={{ width: '40%' }}
                                            value={params.fillDensity}
                                            min={0}
                                            max={20}
                                            onChange={actions.onChangeFillDensity}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '0 0 0 -50px' }}>dot/mm</span>
                                    </TipTrigger>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </OptionalDropdown>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-blue'])}
                    onClick={preview}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    {i18n._('Preview')}
                </button>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    // anchor options is based on language selected
    const anchorOptions = [
        { label: i18n._('Center'), value: 'Center' },
        { label: i18n._('Center Left'), value: 'Center Left' },
        { label: i18n._('Center Right'), value: 'Center Right' },
        { label: i18n._('Bottom Left'), value: 'Bottom Left' },
        { label: i18n._('Bottom Middle'), value: 'Bottom Middle' },
        { label: i18n._('Bottom Right'), value: 'Bottom Right' },
        { label: i18n._('Top Left'), value: 'Top Left' },
        { label: i18n._('Top Middle'), value: 'Top Middle' },
        { label: i18n._('Top Right'), value: 'Top Right' }
    ];
    return {
        source: state.laser.source,
        target: state.laser.target,
        params: state.laser.vectorMode,
        anchorOptions: anchorOptions
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        changeSourceImage: (image, filename, width, height) => dispatch(actions.changeSourceImage(image, filename, width, height)),
        setTarget: (params) => dispatch(actions.targetSetState(params)),
        changeTargetSize: (width, height) => dispatch(actions.changeTargetSize(width, height)),
        setParams: (state) => dispatch(actions.vectorModeSetState(state)),
        preview: () => dispatch(actions.vectorModePreview())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(VectorMode);

