import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';


class VisualizerPreviewControl extends PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
            previewShow: PropTypes.func.isRequired,
            previewHide: PropTypes.func.isRequired
        }),
        state: PropTypes.object.isRequired
    };

    state = {
        showPreviewPanel: false
    };

    actions = {
        onChangeShowLayer: (l) => {
            // the slider is reversed
            const layer = -l;
            console.log('layer', layer);
            // TODO: pubsub send `layer` to the Canvas
        },
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
                onTogglePreviewSkin: this.togglePreviewOptionFactory('WALL-SKIN'),
                onTogglePreviewSkirt: this.togglePreviewOptionFactory('WALL-SKIRT'),
                onTogglePreviewSupport: this.togglePreviewOptionFactory('WALL-SUPPORT'),
                onTogglePreviewFill: this.togglePreviewOptionFactory('WALL-FILL'),
                onTogglePreviewUnknown: this.togglePreviewOptionFactory('WALL-UNKNOWN')
            }
        );
    }

    togglePreviewOptionFactory(option) {
        const actions = this.props.actions;
        return (event) => {
            if (event.target.checked) {
                actions.previewShow(option);
            } else {
                actions.previewHide(option);
            }
        };
    }

    render() {
        const state = this.state;
        const actions = this.actions;
        const numberOfLayers = 100;

        return (
            <React.Fragment>
                <div
                    style={{
                        height: '250px'
                    }}
                >
                    <Slider
                        vertical={true}
                        railStyle={{
                            backgroundColor: 'red'
                        }}
                        min={-numberOfLayers}
                        max={-1}
                        step={1}
                        onChange={actions.onChangeShowLayer}
                    />
                </div>
                <Anchor
                    className={classNames('fa', 'fa-angle-left', styles['toggle-left'])}
                    onClick={actions.onTogglePreviewPanel}
                />
                { state.showPreviewPanel &&
                <div className={styles['preview-panel']}>
                    <p>hello</p>
                    <input type="checkbox" onChange={actions.onTogglePreviewWallInner} /> Inner Wall <br />
                    <input type="checkbox" onChange={actions.onTogglePreviewWallOuter} /> Outer Wall <br />
                    <input type="checkbox" onChange={actions.onTogglePreviewSkin} /> Skin<br />
                    <input type="checkbox" onChange={actions.onTogglePreviewSkirt} /> Skirt<br />
                    <input type="checkbox" onChange={actions.onTogglePreviewSupport} /> Support<br />
                    <input type="checkbox" onChange={actions.onTogglePreviewFill} /> Fill<br />
                    <input type="checkbox" onChange={actions.onTogglePreviewUnknown} /> Unknown<br />
                </div>
                }
            </React.Fragment>
        );
    }
}

export default VisualizerPreviewControl;
