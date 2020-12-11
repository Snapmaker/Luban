import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { actions as textActions } from '../../flux/text';
import TipTrigger from '../../components/TipTrigger';
import { DIRECTION_BACK, DIRECTION_DOWN, DIRECTION_FRONT, DIRECTION_LEFT, DIRECTION_RIGHT, DIRECTION_UP } from '../../constants';
import { actions as editorActions } from '../../flux/editor';

class Image3dParameters extends PureComponent {
    static propTypes = {
        disabled: PropTypes.bool,
        config: PropTypes.shape({
            direction: PropTypes.string,
            minGray: PropTypes.number,
            maxGray: PropTypes.number,
            sliceDensity: PropTypes.number
        }),
        updateSelectedModelConfig: PropTypes.func.isRequired,
        processSelectedModel: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        onChangeFace: (option) => {
            this.props.updateSelectedModelConfig({ direction: option.value });
        },
        onChangeMinGray: (minGray) => {
            this.props.updateSelectedModelConfig({ minGray });
        },
        onChangeMaxGray: (maxGray) => {
            this.props.updateSelectedModelConfig({ maxGray });
        },
        onChangeSliceDensityGray: (sliceDensity) => {
            this.props.updateSelectedModelConfig({ sliceDensity });
        }
    };

    render() {
        const { config, disabled } = this.props;
        const { direction } = config;
        const directionOptions = [{
            value: DIRECTION_FRONT,
            label: DIRECTION_FRONT
        }, {
            value: DIRECTION_BACK,
            label: DIRECTION_BACK
        }, {
            value: DIRECTION_LEFT,
            label: DIRECTION_LEFT
        }, {
            value: DIRECTION_RIGHT,
            label: DIRECTION_RIGHT
        }, {
            value: DIRECTION_UP,
            label: DIRECTION_UP
        }, {
            value: DIRECTION_DOWN,
            label: DIRECTION_DOWN
        }];
        const actions = this.actions;

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-gears sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Model')}</span>
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
                            title={i18n._('Projection Direction')}
                            content={i18n._('Select the orientation of the model\'s projection direction')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Projection Direction')}</span>
                                <Select
                                    disabled={disabled}
                                    className="sm-parameter-row__select"
                                    backspaceRemoves={false}
                                    clearable={false}
                                    searchable={false}
                                    options={directionOptions}
                                    value={direction}
                                    onChange={(option) => {
                                        actions.onChangeFace(option);
                                        this.props.processSelectedModel();
                                    }}
                                />
                            </div>
                        </TipTrigger>
                    </React.Fragment>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { fonts } = state.text;
    const fontOptions = fonts.map((font) => ({
        label: font.displayName,
        value: font.fontFamily
    }));
    fontOptions.unshift({
        label: `+ ${i18n._('Add Fonts')}`,
        value: 'AddFonts'
    });
    return {
        fontOptions
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadFont: (file) => dispatch(textActions.uploadFont(file)),
        processSelectedModel: () => dispatch(editorActions.processSelectedModel('cnc'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Image3dParameters);
