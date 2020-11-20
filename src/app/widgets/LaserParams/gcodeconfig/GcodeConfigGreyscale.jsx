import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Select from 'react-select';
import classNames from 'classnames';
import Anchor from '../../../components/Anchor';
import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import TipTrigger from '../../../components/TipTrigger';
import { actions } from '../../../flux/editor';
import { ABSENT_VALUE } from '../../../constants';

class GcodeConfigGreyscale extends PureComponent {
    static propTypes = {
        density: PropTypes.number,
        movementMode: PropTypes.string,
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
        onChangeMovementMode: (options) => {
            if (options.value === 'greyscale-line') {
                this.props.updateSelectedModelGcodeConfig({
                    dwellTime: ABSENT_VALUE,
                    jogSpeed: 1500,
                    workSpeed: 500
                });
            } else if (options.value === 'greyscale-dot') {
                this.props.updateSelectedModelGcodeConfig({
                    dwellTime: 42,
                    jogSpeed: ABSENT_VALUE,
                    workSpeed: 1500
                });
            }
            this.props.updateSelectedModelGcodeConfig({ movementMode: options.value });
        },
        onChangeDensity: (density) => {
            this.props.updateSelectedModelGcodeConfig({ density });
        }
    };

    render() {
        const { density, movementMode, disabled } = this.props;

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-image sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Greyscale')}</span>
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
                        <div>
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Movement Mode')}</span>
                                <Select
                                    disabled={disabled}
                                    backspaceRemoves={false}
                                    className="sm-parameter-row__select-lg"
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
                                    onChange={this.actions.onChangeMovementMode}
                                />
                            </div>
                            <TipTrigger
                                title={i18n._('Density')}
                                content={i18n._('Determines how fine and smooth the engraved picture will be.'
                                + 'The bigger this value is, the better quality you will get. The range is 1-10 dot/mm and 10 is recommended.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Density')}</span>
                                    <Input
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
                        </div>
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
    const { density, movementMode } = gcodeConfig;
    return {
        density,
        movementMode
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelGcodeConfig: (params) => dispatch(actions.updateSelectedModelGcodeConfig('laser', params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(GcodeConfigGreyscale);
