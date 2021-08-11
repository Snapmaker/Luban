import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from '../../components/Select';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import { actions as textActions } from '../../../flux/text';
import TipTrigger from '../../components/TipTrigger';
import { actions as editorActions } from '../../../flux/editor';
import { NumberInput as Input } from '../../components/Input';
import { BACK, BOTTOM, FRONT, LEFT, RIGHT, TOP } from '../../../constants';
import styles from '../CncLaserShared/styles.styl';
import SvgIcon from '../../components/SvgIcon';

class Image3dParameters extends PureComponent {
    static propTypes = {
        disabled: PropTypes.bool,
        materials: PropTypes.object.isRequired,
        config: PropTypes.shape({
            direction: PropTypes.string,
            placement: PropTypes.string,
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
        onChangeDirectionFace: (option) => {
            this.props.updateSelectedModelConfig({ direction: option.value });
        },
        onChangePlacementFace: (option) => {
            this.props.updateSelectedModelConfig({ placement: option.value });
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
        const { direction, placement, sliceDensity } = config;
        const Options = [{
            value: FRONT,
            label: 'Front'
        }, {
            value: BACK,
            label: 'Back'
        }, {
            value: LEFT,
            label: 'Left'
        }, {
            value: RIGHT,
            label: 'Right'
        }, {
            value: TOP,
            label: 'Top'
        }, {
            value: BOTTOM,
            label: 'Bottom'
        }];
        const actions = this.actions;

        return (
            <div className={styles['cnc-mode']}>
                <Anchor className="sm-flex height-32 margin-vertical-8" onClick={this.actions.onToggleExpand}>
                    <span className="sm-flex-width">{i18n._('Model')}</span>
                    <SvgIcon
                        name="DropdownLine"
                        className={classNames(
                            this.state.expanded ? '' : 'rotate180'
                        )}
                    />
                </Anchor>
                {this.state.expanded && (
                    <div className="margin-vertical-8">
                        <React.Fragment>
                            {!this.props.materials.isRotate && (
                                <TipTrigger
                                    title={i18n._('Projection Direction')}
                                    content={i18n._('Set the projection orientation of the 3D model. ')}
                                >
                                    <div className="sm-flex height-32 margin-vertical-8">
                                        <span className="sm-flex-auto sm-flex-order-negative width-56">{i18n._('Orientation')}</span>
                                        <Select
                                            disabled={disabled}
                                            className="sm-flex-width align-r"
                                            size="120px"
                                            backspaceRemoves={false}
                                            clearable={false}
                                            options={Options}
                                            value={direction}
                                            onChange={(option) => {
                                                actions.onChangeDirectionFace(option);
                                                this.props.processSelectedModel();
                                            }}
                                        />
                                    </div>
                                </TipTrigger>
                            )}
                            {this.props.materials.isRotate && (
                                <TipTrigger
                                    title={i18n._('Placement Face')}
                                    content={i18n._('Set the placement orientation of the 3D model.')}
                                >
                                    <div className="sm-flex height-32 margin-vertical-8">
                                        <span className="sm-flex-auto sm-flex-order-negative width-56">{i18n._('Orientation')}</span>
                                        <Select
                                            disabled={disabled}
                                            className="sm-flex-width align-r"
                                            size="120px"
                                            clearable={false}
                                            options={Options}
                                            value={placement}
                                            onChange={(option) => {
                                                actions.onChangePlacementFace(option);
                                                this.props.processSelectedModel();
                                            }}
                                        />
                                    </div>
                                </TipTrigger>
                            )}
                            <TipTrigger
                                title={i18n._('Image Density')}
                                content={i18n._('Set the resolution of the grayscale image generated by the 3D model. ')}
                            >
                                <div className="sm-flex height-32 margin-vertical-8">
                                    <span className="sm-flex-auto sm-flex-order-negative">{i18n._('Image Density')}</span>
                                    <Input
                                        disabled={disabled}
                                        className="sm-flex-width align-r"
                                        value={sliceDensity}
                                        min={1}
                                        max={20}
                                        step={1}
                                        onChange={(option) => {
                                            actions.onChangeSliceDensityGray(option);
                                            this.props.processSelectedModel();
                                        }}
                                    />
                                </div>
                            </TipTrigger>
                        </React.Fragment>
                    </div>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { materials } = state.cnc;
    return { materials };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadFont: (file) => dispatch(textActions.uploadFont(file)),
        processSelectedModel: () => dispatch(editorActions.processSelectedModel('cnc'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Image3dParameters);
