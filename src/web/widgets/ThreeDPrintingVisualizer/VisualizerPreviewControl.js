import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import { ACTION_3DP_GCODE_RENDERED } from '../../constants';


// custom handle
const Handle = (props) => {
    const { offset, dragging } = props;
    const bottom = offset === 100 ? '114%' : `${offset}%`;

    const elStyle = {
        bottom: bottom,
        opacity: dragging ? '.5' : '1'
    };

    return (
        <div
            style={elStyle}
            className={classNames('fa', 'fa-bars', styles['vertical-handle'])}
        />
    );
};
Handle.propTypes = {
    offset: PropTypes.number,
    dragging: PropTypes.bool
};


class VisualizerPreviewControl extends PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
            previewShow: PropTypes.func.isRequired,
            previewHide: PropTypes.func.isRequired,
            onChangeShowLayer: PropTypes.func.isRequired
        }),
        state: PropTypes.object.isRequired
    };

    state = {
        showPreviewPanel: false,
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
        }
    };

    constructor(props) {
        super(props);

        this.actions = Object.assign(
            this.actions,
            {
                onTogglePreviewWallInner: this.togglePreviewOptionFactory('showWallInner'),
                onTogglePreviewWallOuter: this.togglePreviewOptionFactory('showWallOuter'),
                onTogglePreviewSkin: this.togglePreviewOptionFactory('showSkin'),
                onTogglePreviewSkirt: this.togglePreviewOptionFactory('showSkirt'),
                onTogglePreviewSupport: this.togglePreviewOptionFactory('showSupport'),
                onTogglePreviewFill: this.togglePreviewOptionFactory('showFill'),
                onTogglePreviewUnknown: this.togglePreviewOptionFactory('showUnknown')
            }
        );
    }

    togglePreviewOptionFactory(option) {
        const actions = this.props.actions;
        return (event) => {
            // this.state[option] = !this.state[option];
            if (event.target.checked) {
                actions.previewShow(option);
            } else {
                actions.previewHide(option);
            }
        };
    }

    componentDidMount() {
        this.subscribe();
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    subscribe() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_3DP_GCODE_RENDERED, () => {
                this.setState({
                    showWallInner: true,
                    showWallOuter: true,
                    showSkin: true,
                    showSkirt: true,
                    showSupport: true,
                    showFill: true,
                    showTravel: true,
                    showUnknown: true
                });
            })
        ];
    }

    render() {
        const state = this.state;
        const actions = this.actions;

        const parentState = this.props.state;
        const parentActions = this.props.actions;

        return (
            <React.Fragment>
                <div
                    style={{
                        position: 'relative',
                        marginLeft: '2px'
                    }}
                >
                    <img src="images/3dp/preview-slider.png" alt="" />
                    <Slider
                        className={styles['vertical-slider']}
                        vertical={true}
                        handle={Handle}
                        trackStyle={{
                            backgroundColor: '#eaeaea'
                        }}
                        railStyle={{
                            backgroundColor: '#eaeaea'
                        }}
                        min={0}
                        max={parentState.layerCount}
                        step={1}
                        onChange={parentActions.onChangeShowLayer}
                    />
                </div>
                <Anchor
                    className={classNames(
                        'fa',
                        state.showPreviewPanel ? 'fa-chevron-right' : 'fa-chevron-left',
                        styles['toggle-btn']
                    )}
                    onClick={actions.onTogglePreviewPanel}
                />
                { state.showPreviewPanel &&
                <div className={styles['preview-panel']}>
                    <p>Line Type</p>
                    <input type="checkbox" checked={state.showWallInner} onChange={actions.onTogglePreviewWallInner} /> Inner Wall <br />
                    <input type="checkbox" checked={state.showWallOuter} onChange={actions.onTogglePreviewWallOuter} /> Outer Wall <br />
                    <input type="checkbox" checked={state.showSkin} onChange={actions.onTogglePreviewSkin} /> Skin<br />
                    <input type="checkbox" checked={state.showSkirt} onChange={actions.onTogglePreviewSkirt} /> Skirt<br />
                    <input type="checkbox" checked={state.showSupport} onChange={actions.onTogglePreviewSupport} /> Support<br />
                    <input type="checkbox" checked={state.showFill} onChange={actions.onTogglePreviewFill} /> Fill<br />
                    <input type="checkbox" checked={state.showUnknown} onChange={actions.onTogglePreviewUnknown} /> Unknown<br />
                </div>
                }
            </React.Fragment>
        );
    }
}

export default VisualizerPreviewControl;
