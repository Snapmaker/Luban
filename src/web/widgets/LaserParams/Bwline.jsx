import React from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import Select from 'react-select';
import classNames from 'classnames';
import { BOUND_SIZE } from '../../constants';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import styles from './styles.styl';


const Bwline = (props) => {
    const { state, actions } = props;

    return (
        <React.Fragment>
            <table className={styles.parameterTable}>
                <tbody>
                    <tr>
                        <td>
                            B&W
                        </td>
                        <td>
                            <TipTrigger
                                title={i18n._('B&W')}
                                content={i18n._('Set the proportion of the black color based on the original color of the image.')}
                            >
                                <div style={{ position: 'relative' }}>
                                    <div style={{ display: 'inline-block', float: 'left', width: '148px', marginTop: '10px' }}>
                                        <Slider
                                            value={state.bwThreshold}
                                            min={0}
                                            max={255}
                                            onChange={actions.changeBWThreshold}
                                        />
                                    </div>
                                    <Input
                                        style={{ float: 'left', width: '35px', marginLeft: '8px' }}
                                        className={classNames(styles.input, styles.inputNarrow)}
                                        value={state.bwThreshold}
                                        min={0}
                                        max={255}
                                        onChange={actions.changeBWThreshold}
                                    />
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Size (mm)
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
                                />
                                <span className={styles.descriptionText} style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                <Input
                                    style={{ width: '45%' }}
                                    value={state.sizeHeight}
                                    min={1}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangeHeight}
                                />
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Line Direction
                        </td>
                        <td>
                            <TipTrigger
                                title={i18n._('Line Direction')}
                                content={i18n._('Select the direction of the engraving path.')}
                            >
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
                                    placeholder="choose algorithms"
                                    searchable={false}
                                    value={state.direction}
                                    onChange={actions.onChangeDirection}
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
                                title={i18n._('Density')}
                                content={i18n._('Determines how fine and smooth the engraved picture will be.'
                                    + 'The bigger this value is, the better quality you will get. The range is 1-10 pixel/mm and 10 is recommended.')}
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
                            <TipTrigger
                                title={i18n._('Alignment')}
                                content={i18n._('Alignment of generated G-code.')}
                            >
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
        </React.Fragment>
    );
};

Bwline.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Bwline;
