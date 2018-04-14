import React from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import Select from 'react-select';
import { BOUND_SIZE, STAGE_IMAGE_LOADED, STAGE_PREVIEWED } from '../../constants';
import TipTrigger from '../../components/TipTrigger';
import { InputWithValidation as Input } from '../../components/Input';
import styles from './index.styl';


const Bwline = (props) => {
    const { state, actions } = { ...props };

    return (
        <div>
            <table className={styles.paramTable}>
                <tbody>
                    <tr>
                        <td>
                            B&W
                        </td>
                        <td>
                            <TipTrigger title="B&W" content="Set the proportion of the black color based on the original color of the image.">
                                <div className="text-center">{state.bwThreshold}</div>
                                <Slider
                                    style={{ padding: 0 }}
                                    defaultValue={state.bwThreshold}
                                    min={0}
                                    max={255}
                                    step={1}
                                    onChange={actions.changeBWThreshold}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
                            </TipTrigger>
                        </td>
                    </tr>

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
                            Line Direction
                        </td>
                        <td>
                            <TipTrigger title="Line Direction" content="Select the direction of the engraving path.">
                                <Select
                                    backspaceRemoves={false}
                                    className="sm"
                                    clearable={false}
                                    menuContainerStyle={{ zIndex: 5 }}
                                    name="line_direction"
                                    options={[{
                                        value: 'Horizontal',
                                        label: 'Horizontal'
                                    }, {
                                        value: 'Vertical',
                                        label: 'Vertical'
                                    }, {
                                        value: 'Diagonal',
                                        label: 'Diagonal'
                                    }, {
                                        value: 'Diagonal2',
                                        label: 'Diagonal2'
                                    }]}
                                    placeholder={'choose algorithms'}
                                    searchable={false}
                                    value={state.direction}
                                    onChange={actions.onChangeDirection}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
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
                                        value={state.density}
                                        min={1}
                                        max={10}
                                        step={1}
                                        onChange={actions.onChangeDensity}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'pixel/mm'}</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Jog Speed
                        </td>
                        <td>
                            <TipTrigger title="Jog Speed" content="Determines how fast the machine moves when it’s not engraving.">
                                <div className="input-group input-group-sm" style={{ width: '100%' }}>
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
                                <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                    <Input
                                        value={state.workSpeed}
                                        min={1}
                                        step={1}
                                        max={6000}
                                        onChange={actions.onChangeWorkSpeed}
                                        disabled={state.stage < STAGE_PREVIEWED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm/minute'}</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

Bwline.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Bwline;
