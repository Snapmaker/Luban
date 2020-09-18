import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Select from 'react-select';

import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';
import { NumberInput } from '../../../components/Input';
import { actions } from '../../../flux/editor';
import Anchor from '../../../components/Anchor';


class GcodeConfigRasterBW extends PureComponent {
    static propTypes = {
        density: PropTypes.number,
        direction: PropTypes.string,
        disabled: PropTypes.bool,

        updateSelectedModelGcodeConfig: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        onChangeDirection: (option) => {
            this.props.updateSelectedModelGcodeConfig({ direction: option.value });
        },
        onChangeDensity: (density) => {
            this.props.updateSelectedModelGcodeConfig({ density });
        }
    };

    render() {
        const { density, direction, disabled } = this.props;

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-image sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('B&W')}</span>
                    <span className={classNames(
                        'fa',
                        this.state.expanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {this.state.expanded && (
                    <React.Fragment>
                        <TipTrigger
                            title={i18n._('Line Direction')}
                            content={i18n._('Select the direction of the engraving path.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Line Direction')}</span>
                                <Select
                                    disabled={disabled}
                                    backspaceRemoves={false}
                                    className="sm-parameter-row__select"
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
                                    onChange={this.actions.onChangeDirection}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Density')}
                            content={i18n._('Determines how fine and smooth the engraved picture will be. \
The bigger this value is, the better quality you will get. The range is 1-10 dot/mm and 10 is recommended.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Density')}</span>
                                <NumberInput
                                    disabled={disabled}
                                    className="sm-parameter-row__input"
                                    value={density}
                                    min={1}
                                    max={10}
                                    step={1}
                                    onChange={this.actions.onChangeDensity}
                                />
                                <span className="sm-parameter-row__input-unit">dot/mm</span>
                            </div>
                        </TipTrigger>
                    </React.Fragment>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    // const { toolPathModelGroup } = state.laser;
    // const toolPathModel = toolPathModelGroup.getSelectedModel();
    const toolPathModelGroup = state.laser.toolPathModelGroup;
    const toolPathModel = toolPathModelGroup.getSelectedModel();
    const { gcodeConfig } = toolPathModel;
    const { density, direction } = gcodeConfig;
    return {
        density,
        direction
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelGcodeConfig: (gcodeConfig) => dispatch(actions.updateSelectedModelGcodeConfig('laser', gcodeConfig))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(GcodeConfigRasterBW);
