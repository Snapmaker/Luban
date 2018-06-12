import React from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import Select from 'react-select';
import classNames from 'classnames';
import { BOUND_SIZE, STAGE_IMAGE_LOADED } from '../../constants';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import styles from './styles.styl';


const Greyscale = (props) => {
    const { state, actions } = props;

    return (
        <div>
            <table className={styles.parameterTable}>
                <tbody>
                    <tr>
                        <td>
                            Size (mm)
                        </td>
                        <td>
                            <TipTrigger
                                title="Size"
                                content="Enter the size of the engraved picture. The size cannot be larger than 125 x 125 mm or the size of your material."
                            >
                                <Input
                                    style={{ width: '45%' }}
                                    value={state.sizeWidth}
                                    min={1}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangeWidth}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
                                <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                <Input
                                    style={{ width: '45%' }}
                                    value={state.sizeHeight}
                                    min={1}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangeHeight}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Contrast
                        </td>
                        <td>
                            <TipTrigger title="Contrast" content="The difference between the lightest color and the darkest color.">
                                <div style={{ position: 'relative' }}>
                                    <div style={{ display: 'inline-block', float: 'left', width: '148px', marginTop: '10px' }}>
                                        <Slider
                                            defaultValue={state.contrast}
                                            min={0}
                                            max={100}
                                            onChange={actions.onChangeContrast}
                                        />
                                    </div>
                                    <Input
                                        style={{ float: 'left', width: '35px', marginLeft: '8px' }}
                                        className={classNames(styles.input, styles.inputNarrow)}
                                        value={state.contrast}
                                        min={0}
                                        max={100}
                                        onChange={actions.onChangeContrast}
                                    />
                                    <span className={styles.descriptionText} style={{ float: 'left', margin: '8px 0 6px 4px' }}>%</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Brightness
                        </td>
                        <td>
                            <TipTrigger title="Brightness" content="The engraved picture is brighter when this value is bigger.">
                                <div style={{ position: 'relative' }}>
                                    <div style={{ display: 'inline-block', float: 'left', width: '148px', marginTop: '10px' }}>
                                        <Slider
                                            defaultValue={state.brightness}
                                            min={0}
                                            max={100}
                                            onChange={actions.onChangeBrightness}
                                        />
                                    </div>
                                    <Input
                                        style={{ float: 'left', width: '35px', marginLeft: '8px' }}
                                        className={classNames(styles.input, styles.inputNarrow)}
                                        value={state.brightness}
                                        min={0}
                                        max={100}
                                        onChange={actions.onChangeBrightness}
                                    />
                                    <span className={styles.descriptionText} style={{ float: 'left', margin: '8px 0 6px 4px' }}>%</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            White Clip
                        </td>
                        <td>
                            <TipTrigger title="White Clip" content="Set the threshold to turn the color that is not pure white into pure white.">
                                <div style={{ position: 'relative' }}>
                                    <div style={{ display: 'inline-block', float: 'left', width: '148px', marginTop: '10px' }}>
                                        <Slider
                                            defaultValue={state.whiteClip}
                                            min={0}
                                            max={255}
                                            onChange={actions.onChangeWhiteClip}
                                        />
                                    </div>
                                    <Input
                                        style={{ float: 'left', width: '35px', marginLeft: '8px' }}
                                        className={classNames(styles.input, styles.inputNarrow)}
                                        value={state.whiteClip}
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
                            Algorithm
                        </td>
                        <td>
                            <TipTrigger title="Algorithm" content="Choose an algorithm for image processing.">
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
                                    placeholder="choose algorithms"
                                    searchable={false}
                                    value={state.algorithm}
                                    onChange={actions.onChangeAlgorithm}
                                />
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Density
                        </td>
                        <td>
                            <TipTrigger
                                title="Density"
                                content="Determines how fine and smooth the engraved picture will be.
                                The bigger this value is, the better quality you will get. The range is 1-10 pixel/mm and 10 is recommended."
                            >
                                <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                    <Input
                                        style={{ width: '45%' }}
                                        value={state.density}
                                        min={1}
                                        max={10}
                                        step={1}
                                        onChange={actions.onChangeDensity}
                                    />
                                    <span className={styles.descriptionText} style={{ margin: '8px 0 6px 4px' }}>pixel/mm</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Alignment
                        </td>
                        <td>
                            <TipTrigger title="Alignment" content="Alignment of generated G-code.">
                                <Select
                                    options={[{
                                        value: 'none',
                                        label: 'None'
                                    }, {
                                        value: 'center',
                                        label: 'Align center to origin'
                                    }]}
                                    value={state.alignment}
                                    searchable={false}
                                    clearable={false}
                                    backspaceRemoves={false}
                                    onChange={actions.onSelectAlignment}
                                />
                            </TipTrigger>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

Greyscale.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Greyscale;
