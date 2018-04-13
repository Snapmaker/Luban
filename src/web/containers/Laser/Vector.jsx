import React from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import Select from 'react-select';
import { BOUND_SIZE, STAGE_IMAGE_LOADED, STAGE_PREVIEWED } from '../../constants';
import { InputWithValidation as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import styles from './index.styl';


const Vector = (props) => {
    const { state, actions } = { ...props };

    return (
        <div>
            <table className={styles.paramTable}>
                <tbody>
                    <tr>
                        <td>
                            Source Type
                        </td>
                        <td>
                            <TipTrigger
                                title="Source Type"
                                content="Select the type of the image you want to upload.
                                Raster supports PNG and JPEG images, while SVG only supports SVG images.
                                The Raster images will be transferred into SVG automatically."
                            >
                                <Select
                                    options={[{
                                        value: 'raster',
                                        label: 'Raster'
                                    }, {
                                        value: 'svg',
                                        label: 'SVG'
                                    }]}
                                    value={state.subMode}
                                    searchable={false}
                                    clearable={false}
                                    backspaceRemoves={false}
                                    onChange={actions.onChangeSubMode}
                                />
                            </TipTrigger>
                        </td>
                    </tr>
                    {state.subMode === 'raster' &&
                    <tr>
                        <td>
                            B&W
                        </td>
                        <td>
                            <TipTrigger title="B&W" content="Set the proportion of the black color based on the original color of the image.">
                                <div className="text-center">{state.vectorThreshold}</div>
                                <Slider
                                    style={{ padding: 0 }}
                                    defaultValue={state.vectorThreshold}
                                    min={0}
                                    max={255}
                                    step={1}
                                    onChange={actions.changeVectorThreshold}
                                />
                            </TipTrigger>
                        </td>
                    </tr>}
                    {state.subMode === 'raster' &&
                    <tr>
                        <td>
                            Impurity Size
                        </td>
                        <td>
                            <TipTrigger title="Impurity Size" content="Determines the minimum size of impurity which allows to be showed.">
                                <Input
                                    value={state.turdSize}
                                    min={0}
                                    max={10000}
                                    onChange={actions.onChangeTurdSize}
                                />
                            </TipTrigger>
                        </td>
                    </tr>}
                    {state.subMode === 'raster' &&
                    <tr>
                        <td />
                        <td>
                            <TipTrigger title="Invert" content="Inverts black to white and vise versa.">
                                <input type="checkbox" defaultChecked={state.isInvert} onChange={actions.onToggleInvert} /> <span>Invert</span>
                            </TipTrigger>
                        </td>
                    </tr>}
                    <tr>
                        <td>
                            Resolution
                        </td>
                        <td>
                            <TipTrigger title="Resolution" content="The detected resolution of the loaded image.">
                                <Input
                                    style={{ width: '45%' }}
                                    value={state.originWidth}
                                    disabled="disabled"
                                />
                                <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                <Input
                                    style={{ width: '45%' }}
                                    value={state.originHeight}
                                    disabled="disabled"
                                />
                            </TipTrigger>
                        </td>
                    </tr>
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
                            Jog Speed
                        </td>
                        <td>
                            <TipTrigger title="Jog Speed" content="Determines how fast the machine moves when it’s not engraving.">
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <Input
                                        value={state.jogSpeed}
                                        min={1}
                                        max={6000}
                                        step={1}
                                        onChange={actions.onChangeJogSpeed}
                                        disabled={state.stage < STAGE_PREVIEWED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm/minute'}</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Work Speed
                        </td>
                        <td>
                            <TipTrigger title="Work Speed" content="Determines how fast the machine moves when it’s engraving.">
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <Input
                                        value={state.workSpeed}
                                        min={1}
                                        max={6000}
                                        step={1}
                                        onChange={actions.onChangeWorkSpeed}
                                        disabled={state.stage < STAGE_PREVIEWED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm/minute'}</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td />
                        <td>
                            <TipTrigger title="Optimize Path" content="Optimizes the path based on the proximity of the lines in the image.">
                                <input type="checkbox" defaultChecked={state.optimizePath} onChange={actions.onToggleOptimizePath} /> <span>Optimize Path</span>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td />
                        <td>
                            <TipTrigger title="Clip" content="Moves the image to align to the X-axis and Y-axis automatically.">
                                <input type="checkbox" defaultChecked={state.clip} onChange={actions.onToggleClip} /> <span>Clip</span>
                            </TipTrigger>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

Vector.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Vector;
