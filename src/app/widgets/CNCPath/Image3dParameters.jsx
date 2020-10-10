import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { actions as textActions } from '../../flux/text';
import { PLANE_XY, PLANE_XZ, PLANE_YZ } from '../../../server/constants';
import TipTrigger from '../../components/TipTrigger';

class Image3dParameters extends PureComponent {
    static propTypes = {
        disabled: PropTypes.bool,
        config: PropTypes.shape({
            plane: PropTypes.string,
            minGray: PropTypes.number,
            maxGray: PropTypes.number,
            sliceDensity: PropTypes.number
        }),
        updateSelectedModelConfig: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        onChangePlane: (option) => {
            this.props.updateSelectedModelConfig({ plane: option.value });
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
        const { plane } = config;
        const planeOptions = [{
            value: PLANE_XY,
            label: PLANE_XY
        }, {
            value: PLANE_XZ,
            label: PLANE_XZ
        }, {
            value: PLANE_YZ,
            label: PLANE_YZ
        }];
        const actions = this.actions;

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-gears sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('3D Model')}</span>
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
                            title={i18n._('Plane')}
                            content={i18n._('Select the plane coordinate system of the generated gray graph')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Plane')}</span>
                                <Select
                                    disabled={disabled}
                                    className="sm-parameter-row__select"
                                    backspaceRemoves={false}
                                    clearable={false}
                                    searchable={false}
                                    options={planeOptions}
                                    value={plane}
                                    onChange={actions.onChangePlane}
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
        uploadFont: (file) => dispatch(textActions.uploadFont(file))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Image3dParameters);
