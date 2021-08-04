import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Slider from '../../components/Slider';
import Checkbox from '../../components/Checkbox';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import { actions as printingActions } from '../../../flux/printing';
import i18n from '../../../lib/i18n';

// custom handle
// const Handle = (props) => {
//     const { offset, dragging } = props;
//     const bottom = offset === 100 ? '114%' : `${offset}%`;
//
//     const elStyle = {
//         bottom: bottom,
//         opacity: dragging ? '.5' : '1'
//     };
//
//     return (
//         <div
//             style={elStyle}
//             className={classNames('fa', 'fa-bars', styles['vertical-handle'])}
//         />
//     );
// };
// Handle.propTypes = {
//     offset: PropTypes.number,
//     dragging: PropTypes.bool
// };


class VisualizerPreviewControl extends PureComponent {
    static propTypes = {
        layerCount: PropTypes.number.isRequired,
        layerCountDisplayed: PropTypes.number.isRequired,
        gcodeLine: PropTypes.object,
        gcodeTypeInitialVisibility: PropTypes.object.isRequired,
        showGcodeLayers: PropTypes.func.isRequired,
        setGcodeVisibilityByType: PropTypes.func.isRequired,
        displayedType: PropTypes.string.isRequired
    };

    state = {
        showPreviewPanel: true,
        showToggleBtn: true,
        // preview options
        showWallInner: false,
        showWallOuter: false,
        showSkin: false,
        showSkirt: false,
        showSupport: false,
        showFill: false,
        showTravel: false,
        showUnknown: false
    };

    actions = {
        onTogglePreviewPanel: () => {
            this.setState((state) => ({
                showPreviewPanel: !state.showPreviewPanel
            }));
        },
        onChangeShowLayer: (value) => {
            this.props.showGcodeLayers(value);
        }
    };

    constructor(props) {
        super(props);

        this.actions = Object.assign(
            this.actions,
            {
                onTogglePreviewWallInner: this.togglePreviewOptionFactory('showWallInner', 'WALL-INNER'),
                onTogglePreviewWallOuter: this.togglePreviewOptionFactory('showWallOuter', 'WALL-OUTER'),
                onTogglePreviewSkin: this.togglePreviewOptionFactory('showSkin', 'SKIN'),
                onTogglePreviewSkirt: this.togglePreviewOptionFactory('showSkirt', 'SKIRT'),
                onTogglePreviewSupport: this.togglePreviewOptionFactory('showSupport', 'SUPPORT'),
                onTogglePreviewFill: this.togglePreviewOptionFactory('showFill', 'FILL'),
                onTogglePreviewTravel: this.togglePreviewOptionFactory('showTravel', 'TRAVEL'),
                onTogglePreviewUnknown: this.togglePreviewOptionFactory('showUnknown', 'UNKNOWN')
            }
        );
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.displayedType !== this.props.displayedType) {
            this.setState({
                showPreviewPanel: nextProps.displayedType === 'gcode',
                showToggleBtn: nextProps.displayedType === 'gcode'
            });
        }

        if (nextProps.gcodeTypeInitialVisibility !== this.props.gcodeTypeInitialVisibility) {
            const visibility = nextProps.gcodeTypeInitialVisibility;
            this.setState({
                showPreviewPanel: true,
                showWallInner: visibility['WALL-INNER'],
                showWallOuter: visibility['WALL-OUTER'],
                showSkin: visibility.SKIN,
                showSkirt: visibility.SKIRT,
                showSupport: visibility.SUPPORT,
                showFill: visibility.FILL,
                showTravel: visibility.TRAVEL,
                showUnknown: visibility.UNKNOWN
            });
        }
    }

    togglePreviewOptionFactory(option, type) {
        return (event) => {
            this.setState((state) => ({
                [option]: !state[option]
            }));
            this.props.setGcodeVisibilityByType(type, event.target.checked);
        };
    }

    render() {
        if (!this.props.gcodeLine) {
            return null;
        }
        const { layerCount, layerCountDisplayed } = this.props;
        const state = this.state;
        const actions = this.actions;

        return (
            <React.Fragment>
                <span className={styles['layer-label']}>{layerCountDisplayed}</span>
                <div
                    style={{
                        position: 'relative',
                        marginLeft: '2px'
                    }}
                >
                    <img src="/resources/images/3dp/preview-slider.png" alt="" />
                    <Slider
                        className={styles['vertical-slider']}
                        vertical
                        min={0}
                        max={layerCount}
                        step={1}
                        value={layerCountDisplayed}
                        onChange={(value) => {
                            actions.onChangeShowLayer(value);
                        }}
                    />
                </div>
                {state.showToggleBtn && (
                    <Anchor
                        className={classNames(
                            'fa',
                            state.showPreviewPanel ? 'fa-chevron-right' : 'fa-chevron-left',
                            styles['toggle-btn']
                        )}
                        onClick={actions.onTogglePreviewPanel}
                    />
                )}
                {state.showPreviewPanel && (
                    <div
                        className={classNames(
                            styles['preview-panel'],
                            'position-ab',
                            'width-200',
                            'border-default-grey-1',
                            'border-radius-8',
                            'background-color-white',
                        )}
                    >
                        <div className="border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40 heading-3">
                            {i18n._('Line Type')}
                        </div>
                        <div className="padding-vertical-16 padding-horizontal-16">
                            <div className="sm-flex justify-space-between height-24 margin-bottom-8">
                                <div>
                                    <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#00ff00' }} />
                                    <span className="v-align-m margin-left-8">
                                            Inner Wall
                                    </span>
                                </div>
                                <Checkbox
                                    checked={state.showWallInner}
                                    onChange={actions.onTogglePreviewWallInner}
                                />
                            </div>
                            <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                <div>
                                    <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#ff2121' }} />
                                    <span className="v-align-m margin-left-8">
                                            Outer Wall
                                    </span>
                                </div>
                                <Checkbox
                                    checked={state.showWallOuter}
                                    onChange={actions.onTogglePreviewWallOuter}
                                />
                            </div>
                            <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                <div>
                                    <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#ffff00' }} />
                                    <span className="v-align-m margin-left-8">
                                            Skin
                                    </span>
                                </div>
                                <Checkbox
                                    checked={state.showSkin}
                                    onChange={actions.onTogglePreviewSkin}
                                />
                            </div>
                            <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                <div>
                                    <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#4b0082' }} />
                                    <span className="v-align-m margin-left-8">
                                            Helper
                                    </span>
                                </div>
                                <Checkbox
                                    checked={state.showSupport}
                                    onChange={actions.onTogglePreviewSupport}
                                />
                            </div>
                            <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                <div>
                                    <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#8d4bbb' }} />
                                    <span className="v-align-m margin-left-8">
                                            Fill
                                    </span>
                                </div>
                                <Checkbox
                                    checked={state.showFill}
                                    onChange={actions.onTogglePreviewFill}
                                />
                            </div>
                            <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                <div>
                                    <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#44cef6' }} />
                                    <span className="v-align-m margin-left-8">
                                            Travel
                                    </span>
                                </div>
                                <Checkbox
                                    checked={state.showTravel}
                                    onChange={actions.onTogglePreviewTravel}
                                />
                            </div>
                            <div className="sm-flex justify-space-between height-24 margin-top-8">
                                <div>
                                    <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#4b0082' }} />
                                    <span className="v-align-m margin-left-8">
                                            Unknown
                                    </span>
                                </div>
                                <Checkbox
                                    checked={state.showUnknown}
                                    onChange={actions.onTogglePreviewUnknown}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const printing = state.printing;
    const { layerCount, layerCountDisplayed, gcodeLine, displayedType, gcodeTypeInitialVisibility } = printing;

    return {
        layerCount,
        layerCountDisplayed,
        gcodeLine,
        displayedType,
        gcodeTypeInitialVisibility
    };
};

const mapDispatchToProps = (dispatch) => ({
    showGcodeLayers: (count) => dispatch(printingActions.showGcodeLayers(count)),
    setGcodeVisibilityByType: (type, visible) => dispatch(printingActions.setGcodeVisibilityByType(type, visible)),
    displayModel: () => dispatch(printingActions.displayModel()),
    displayGcode: () => dispatch(printingActions.displayGcode())
});


export default connect(mapStateToProps, mapDispatchToProps)(VisualizerPreviewControl);
