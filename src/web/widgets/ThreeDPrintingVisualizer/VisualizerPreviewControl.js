import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import { ACTION_3DP_GCODE_RENDERED } from '../../constants';


class VisualizerPreviewControl extends PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
            previewShow: PropTypes.func.isRequired,
            previewHide: PropTypes.func.isRequired
        }),
        state: PropTypes.object.isRequired
    };

    state = {
        showPreviewPanel: false,
        'WALL-INNER': false,
        'WALL-OUTER': false,
        'SKIN': false,
        'SKIRT': false,
        'SUPPORT': false,
        'FILL': false,
        'Travel': false,
        'UNKNOWN': false
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
                onTogglePreviewWallInner: this.togglePreviewOptionFactory('WALL-INNER'),
                onTogglePreviewWallOuter: this.togglePreviewOptionFactory('WALL-OUTER'),
                onTogglePreviewSkin: this.togglePreviewOptionFactory('SKIN'),
                onTogglePreviewSkirt: this.togglePreviewOptionFactory('SKIRT'),
                onTogglePreviewSupport: this.togglePreviewOptionFactory('SUPPORT'),
                onTogglePreviewFill: this.togglePreviewOptionFactory('FILL'),
                onTogglePreviewUnknown: this.togglePreviewOptionFactory('UNKNOWN')
            }
        );
    }

    togglePreviewOptionFactory = (option) => {
        const actions = this.props.actions;
        return (event) => {
            this.state[option] = !this.state[option];
            this.forceUpdate();
            if (event.target.checked) {
                actions.previewShow(option);
            } else {
                actions.previewHide(option);
            }
            console.log('state:' + JSON.stringify(this.state));
        };
    }

    render() {
        const state = this.state;
        const actions = this.actions;
        return (
            <React.Fragment>
                <div
                    style={{
                        position: 'relative',
                        marginLeft: '6px'
                    }}
                >
                    <img
                        width="16px"
                        height="360px"
                        src="images/preview-slider.png"
                        alt=""
                    />
                    <Slider
                        className={styles['vertical-slider']}
                        vertical={true}
                        trackStyle={{
                            width: '16px'
                        }}
                        railStyle={{
                            backgroundColor: 'red'
                        }}
                        min={0}
                        max={this.props.state.layerCount}
                        step={1}
                        onChange={this.props.actions.onChangeShowLayer}
                    />
                </div>
                <Anchor
                    className={classNames('fa', 'fa-angle-left', styles['toggle-left'])}
                    onClick={actions.onTogglePreviewPanel}
                />
                { state.showPreviewPanel &&
                <div className={styles['preview-panel']}>
                    <p>Line Type</p>
                    <input type="checkbox" checked={this.state['WALL-INNER']} onChange={actions.onTogglePreviewWallInner} /> Inner Wall <br />
                    <input type="checkbox" checked={this.state['WALL-OUTER']} onChange={actions.onTogglePreviewWallOuter} /> Outer Wall <br />
                    <input type="checkbox" checked={this.state.SKIN} onChange={actions.onTogglePreviewSkin} /> Skin<br />
                    <input type="checkbox" checked={this.state.SKIRT} onChange={actions.onTogglePreviewSkirt} /> Skirt<br />
                    <input type="checkbox" checked={this.state.SUPPORT} onChange={actions.onTogglePreviewSupport} /> Support<br />
                    <input type="checkbox" checked={this.state.FILL} onChange={actions.onTogglePreviewFill} /> Fill<br />
                    <input type="checkbox" checked={this.state.UNKNOWN} onChange={actions.onTogglePreviewUnknown} /> Unknown<br />
                </div>
                }
            </React.Fragment>
        );
    }

    componentDidMount() {
        this.subscribe();
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    subscribe() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_3DP_GCODE_RENDERED, (msg, data) => {
                this.setState({
                    'WALL-INNER': true,
                    'WALL-OUTER': true,
                    'SKIN': true,
                    'SKIRT': true,
                    'SUPPORT': true,
                    'FILL': true,
                    'Travel': true,
                    'UNKNOWN': true
                });
            })
        ];
    }
}

export default VisualizerPreviewControl;
