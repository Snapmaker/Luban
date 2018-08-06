import React from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import Select from 'react-select';
import { BOUND_SIZE, STAGE_IMAGE_LOADED } from '../../constants';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import styles from './styles.styl';


const Vector = ({ stage, state, actions }) => {
    return (
        <div>
            <table className={styles['parameter-table']}>
                <tbody>
                    {state.subMode === 'raster' &&
                    <tr>
                        <td>
                            {i18n._('B&W')}
                        </td>
                        <td>
                            <TipTrigger
                                title={i18n._('B&W')}
                                content={i18n._('Set the proportion of the black color based on the original color of the image.')}
                            >
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
                            {i18n._('Impurity Size')}
                        </td>
                        <td>
                            <TipTrigger
                                title={i18n._('Impurity Size')}
                                content={i18n._('Determines the minimum size of impurity which allows to be showed.')}
                            >
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
                            <TipTrigger
                                title={i18n._('Invert')}
                                content={i18n._('Inverts black to white and vise versa.')}
                            >
                                <input type="checkbox" defaultChecked={state.isInvert} onChange={actions.onToggleInvert} /> <span>Invert</span>
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
                                    value={state.sizeWidth}
                                    min={1}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangeWidth}
                                    disabled={stage < STAGE_IMAGE_LOADED}
                                />
                                <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                <Input
                                    style={{ width: '45%' }}
                                    value={state.sizeHeight}
                                    min={1}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangeHeight}
                                    disabled={stage < STAGE_IMAGE_LOADED}
                                />
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            {i18n._('Alignment')}
                        </td>
                        <td>
                            <TipTrigger
                                title={i18n._('Alignment')}
                                content={i18n._('Alignment of generated G-code.')}
                            >
                                <Select
                                    options={[{
                                        value: 'none',
                                        label: i18n._('None')
                                    }, {
                                        value: 'clip',
                                        label: i18n._('Clip to axes')
                                    }, {
                                        value: 'center',
                                        label: i18n._('Align center to origin')
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
                    <tr>
                        <td />
                        <td>
                            <TipTrigger
                                title={i18n._('Optimize Path')}
                                content={i18n._('Optimizes the path based on the proximity of the lines in the image.')}
                            >
                                <input
                                    type="checkbox"
                                    defaultChecked={state.optimizePath}
                                    onChange={actions.onToggleOptimizePath}
                                />
                                <span>{i18n._('Optimize Path')}</span>
                            </TipTrigger>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

Vector.propTypes = {
    stage: PropTypes.number.isRequired,
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Vector;
