import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from 'rc-slider';
import Select from 'react-select';
import classNames from 'classnames';
import { BOUND_SIZE } from '../../constants';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions } from '../../reducers/modules/laser';
import UploadControl from './UploadControl';
import styles from './styles.styl';


class GreyscaleMode extends PureComponent {
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
        setTarget: PropTypes.func.isRequired,
        setParams: PropTypes.func.isRequired,
        preview: PropTypes.func.isRequired
    };

    actions = {
        onChangeContrast: (contrast) => {
            this.props.setParams({ contrast });
        },
        onChangeBrightness: (brightness) => {
            this.props.setParams({ brightness });
        },
        onChangeWhiteClip: (whiteClip) => {
            this.props.setParams({ whiteClip });
        },
        onChangeAlgorithm: (options) => {
            this.props.setParams({ algorithm: options.value });
        },
        onChangeDensity: (density) => {
            this.props.setParams({ density });
        },
        onChangeAnchor: (option) => {
            this.props.setTarget({ anchor: option.value });
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
                <UploadControl
                    accept=".png, .jpg, .jpeg, .bmp"
                    onChangeFile={onChangeFile}
                    filename={source.filename}
                    width={source.width}
                    height={source.height}
                />
                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
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
                                {i18n._('Contrast')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Contrast')}
                                    content={i18n._('The difference between the lightest color and the darkest color.')}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'inline-block', float: 'left', width: '148px', marginTop: '10px' }}>
                                            <Slider
                                                value={params.contrast}
                                                min={0}
                                                max={100}
                                                onChange={actions.onChangeContrast}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'left', width: '35px', marginLeft: '8px' }}
                                            className={classNames(styles.input, styles.inputNarrow)}
                                            value={params.contrast}
                                            min={0}
                                            max={100}
                                            onChange={actions.onChangeContrast}
                                        />
                                        <span className={styles['description-text']} style={{ float: 'left', margin: '8px 0 6px 4px' }}>%</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Brightness')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Brightness')}
                                    content={i18n._('The engraved picture is brighter when this value is bigger.')}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'inline-block', float: 'left', width: '148px', marginTop: '10px' }}>
                                            <Slider
                                                value={params.brightness}
                                                min={0}
                                                max={100}
                                                onChange={actions.onChangeBrightness}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'left', width: '35px', marginLeft: '8px' }}
                                            className={classNames(styles.input, styles.inputNarrow)}
                                            value={params.brightness}
                                            min={0}
                                            max={100}
                                            onChange={actions.onChangeBrightness}
                                        />
                                        <span className={styles['description-text']} style={{ float: 'left', margin: '8px 0 6px 4px' }}>%</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('White Clip')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('White Clip')}
                                    content={i18n._('Set the threshold to turn the color that is not pure white into pure white.')}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'inline-block', float: 'left', width: '148px', marginTop: '10px' }}>
                                            <Slider
                                                value={params.whiteClip}
                                                min={0}
                                                max={255}
                                                onChange={actions.onChangeWhiteClip}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'left', width: '35px', marginLeft: '8px' }}
                                            className={classNames(styles.input, styles.inputNarrow)}
                                            value={params.whiteClip}
                                            min={0}
                                            max={255}
                                            onChange={actions.onChangeWhiteClip}
                                        />
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Algorithm')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Algorithm')}
                                    content={i18n._('Choose an algorithm for image processing.')}
                                >
                                    <Select
                                        backspaceRemoves={false}
                                        className="sm"
                                        clearable={false}
                                        menuContainerStyle={{ zIndex: 5 }}
                                        name="algorithm"
                                        options={[{
                                            value: 'Atkinson',
                                            label: 'Atkinson'
                                        }, {
                                            value: 'Burks',
                                            label: 'Burks'
                                        }, {
                                            value: 'FloyedSteinburg',
                                            label: 'FloyedSteinburg'
                                        }, {
                                            value: 'JarvisJudiceNinke',
                                            label: 'JarvisJudiceNinke'
                                        }, {
                                            value: 'Sierra2',
                                            label: 'Sierra2'
                                        }, {
                                            value: 'Sierra3',
                                            label: 'Sierra3'
                                        }, {
                                            value: 'SierraLite',
                                            label: 'SierraLite'
                                        }, {
                                            value: 'Stucki',
                                            label: 'Stucki'
                                        }]}
                                        placeholder={i18n._('Choose algorithms')}
                                        searchable={false}
                                        value={params.algorithm}
                                        onChange={actions.onChangeAlgorithm}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Density')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Density')}
                                    content={i18n._('Determines how fine and smooth the engraved picture will be.'
                                        + 'The bigger this value is, the better quality you will get. The range is 1-10 dot/mm and 10 is recommended.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={params.density}
                                            min={1}
                                            max={10}
                                            step={1}
                                            onChange={actions.onChangeDensity}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>dot/mm</span>
                                    </div>
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
                    </tbody>
                </table>
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
        stage: state.laser.stage,
        source: state.laser.source,
        target: state.laser.target,
        params: state.laser.greyscaleMode,
        anchorOptions: anchorOptions
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setTarget: (params) => dispatch(actions.targetSetState(params)),
        setParams: (state) => dispatch(actions.greyscaleSetState(state)),
        preview: () => dispatch(actions.greyscaleModePreview())
    };
};


export default connect(mapStateToProps, mapDispatchToProps)(GreyscaleMode);
