import React, { PureComponent } from 'react';
import Slider from 'rc-slider';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Select from 'react-select';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import styles from './styles.styl';
import { actions } from '../../reducers/cncLaserShared';


class ConfigRasterBW extends PureComponent {
    static propTypes = {
        invertGreyscale: PropTypes.bool,
        bwThreshold: PropTypes.number,
        density: PropTypes.number,
        direction: PropTypes.string,
        updateSelectedModelConfig: PropTypes.func.isRequired
    };

    actions = {
        onInverseBW: () => {
            this.props.updateSelectedModelConfig({ invertGreyscale: !this.props.invertGreyscale });
        },
        onChangeBWThreshold: (bwThreshold) => {
            this.props.updateSelectedModelConfig({ bwThreshold });
        },
        onChangeDirection: (option) => {
            this.props.updateSelectedModelConfig({ direction: option.value });
        },
        onChangeDensity: (density) => {
            this.props.updateSelectedModelConfig({ density });
        }
    };

    render() {
        const { invertGreyscale, bwThreshold, density, direction } = this.props;
        const actions = this.actions;

        return (
            <React.Fragment>
                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td>
                            </td>
                            <td>
                                <label style={{ width: '100%', align: 'center' }}>
                                    <input
                                        type="checkbox"
                                        style={{ marginTop: '0px', marginDown: '0px', marginLeft: '20px', marginRight: '5px' }}
                                        value={invertGreyscale}
                                        onClick={actions.onInverseBW}
                                    />
                                    Invert Greyscale
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('B&W')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('B&W')}
                                    content={i18n._('Set the proportion of the black color based on the original color of the image.')}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'inline-block', width: '75%', marginTop: '10px' }}>
                                            <Slider
                                                value={bwThreshold}
                                                min={0}
                                                max={255}
                                                onChange={actions.onChangeBWThreshold}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'right', width: '45px' }}
                                            className={classNames(styles.input, styles['input-narrow'])}
                                            value={bwThreshold}
                                            min={0}
                                            max={255}
                                            onChange={actions.onChangeBWThreshold}
                                        />
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Line Direction')}
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
                                            label: i18n._('Horizontal')
                                        }, {
                                            value: 'Vertical',
                                            label: i18n._('Vertical')
                                        }, {
                                            value: 'Diagonal',
                                            label: i18n._('Diagonal')
                                        }, {
                                            value: 'Diagonal2',
                                            label: i18n._('Diagonal2')
                                        }]}
                                        placeholder={i18n._('Choose an algorithm')}
                                        searchable={false}
                                        value={direction}
                                        onChange={actions.onChangeDirection}
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
                                    content={i18n._('Determines how fine and smooth the engraved picture will be. \
The bigger this value is, the better quality you will get. The range is 1-10 dot/mm and 10 is recommended.')}
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
                    </tbody>
                </table>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { config } = state.laser;
    const { invertGreyscale, bwThreshold, density, direction } = config;
    return {
        invertGreyscale,
        bwThreshold,
        density,
        direction
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelConfig: (config) => dispatch(actions.updateSelectedModelConfig('laser', config))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigRasterBW);
