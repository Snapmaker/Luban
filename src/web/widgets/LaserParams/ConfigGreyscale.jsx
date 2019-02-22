import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from 'rc-slider';
import Select from 'react-select';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import styles from './styles.styl';
import { actions } from '../../reducers/cncLaserShared';
import { ABSENT_VALUE } from '../../constants';

class ConfigGreyscale extends PureComponent {
    static propTypes = {
        contrast: PropTypes.number.isRequired,
        brightness: PropTypes.number.isRequired,
        whiteClip: PropTypes.number.isRequired,
        density: PropTypes.number.isRequired,
        algorithm: PropTypes.string.isRequired,
        movementMode: PropTypes.string.isRequired,
        updateSelectedModelConfig: PropTypes.func.isRequired,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired
    };

    actions = {
        onChangeContrast: (contrast) => {
            this.props.updateSelectedModelConfig({ contrast });
        },
        onChangeBrightness: (brightness) => {
            this.props.updateSelectedModelConfig({ brightness });
        },
        onChangeWhiteClip: (whiteClip) => {
            this.props.updateSelectedModelConfig({ whiteClip });
        },
        onChangeAlgorithm: (options) => {
            this.props.updateSelectedModelConfig({ algorithm: options.value });
        },
        onChangeMovementMode: (options) => {
            if (options.value === 'greyscale-line') {
                this.props.updateSelectedModelGcodeConfig({
                    dwellTime: ABSENT_VALUE,
                    workSpeed: 500
                });
            } else if (options.value === 'greyscale-dot') {
                this.props.updateSelectedModelGcodeConfig({
                    dwellTime: 42,
                    workSpeed: ABSENT_VALUE
                });
            }
            this.props.updateSelectedModelConfig({ movementMode: options.value });
        },
        onChangeDensity: (density) => {
            this.props.updateSelectedModelConfig({ density });
        }
    };

    render() {
        const { contrast, brightness, whiteClip, density, algorithm, movementMode } = this.props;
        const actions = this.actions;

        return (
            <div>
                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
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
                                                value={contrast}
                                                min={0}
                                                max={100}
                                                onChange={actions.onChangeContrast}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'left', width: '35px', marginLeft: '8px' }}
                                            className={classNames(styles.input, styles.inputNarrow)}
                                            value={contrast}
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
                                                value={brightness}
                                                min={0}
                                                max={100}
                                                onChange={actions.onChangeBrightness}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'left', width: '35px', marginLeft: '8px' }}
                                            className={classNames(styles.input, styles.inputNarrow)}
                                            value={brightness}
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
                                                value={whiteClip}
                                                min={0}
                                                max={255}
                                                onChange={actions.onChangeWhiteClip}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'left', width: '35px', marginLeft: '8px' }}
                                            className={classNames(styles.input, styles.inputNarrow)}
                                            value={whiteClip}
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
                                        value={algorithm}
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
                                            value={density}
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
                                {i18n._('Movement Mode')}
                            </td>
                            <td>
                                <Select
                                    backspaceRemoves={false}
                                    className="sm"
                                    clearable={false}
                                    menuContainerStyle={{ zIndex: 5 }}
                                    name="Movement"
                                    options={[{
                                        value: 'greyscale-line',
                                        label: i18n._('Line (Normal Quality)')
                                    }, {
                                        value: 'greyscale-dot',
                                        label: i18n._('Dot (High Quality)')
                                    }]}
                                    placeholder={i18n._('Choose movement mode')}
                                    searchable={false}
                                    value={movementMode}
                                    onChange={actions.onChangeMovementMode}
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
}


const mapStateToProps = (state) => {
    const { config } = state.cncLaserShared.laser;
    const { contrast, brightness, whiteClip, density, algorithm, movementMode } = config;
    return {
        contrast,
        brightness,
        whiteClip,
        density,
        algorithm,
        movementMode
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelConfig: (config) => dispatch(actions.updateSelectedModelConfig('laser', config)),
        updateSelectedModelGcodeConfig: (params) => dispatch(actions.updateSelectedModelGcodeConfig('laser', params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigGreyscale);
