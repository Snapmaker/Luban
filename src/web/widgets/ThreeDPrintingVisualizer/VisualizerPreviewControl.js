import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import { STAGE_GENERATED } from '../../constants';


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
            onChangeShowLayer: PropTypes.func.isRequired,
            setModelMeshVisibility: PropTypes.func.isRequired,
            setGcodeRenderedObjectVisibility: PropTypes.func.isRequired
        }),
        state: PropTypes.shape({
            stage: PropTypes.number.isRequired
        })
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
        },
        onChangeShowLayer: (value, max) => {
            if (value === max) {
                this.props.actions.setModelMeshVisibility(true);
                this.props.actions.setGcodeRenderedObjectVisibility(false);
            } else {
                this.props.actions.setModelMeshVisibility(false);
                this.props.actions.setGcodeRenderedObjectVisibility(true);
            }
            this.props.actions.onChangeShowLayer(value);
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

    togglePreviewOptionFactory(option, type) {
        const actions = this.props.actions;
        return (event) => {
            this.setState((state) => ({
                [option]: !state[option]
            }));
            if (event.target.checked) {
                actions.previewShow(type);
            } else {
                actions.previewHide(type);
            }
        };
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.state.stage === STAGE_GENERATED && this.props.state.stage !== STAGE_GENERATED) {
            this.setState({
                showPreviewPanel: true,
                showWallInner: true,
                showWallOuter: true,
                showSkin: true,
                showSkirt: true,
                showSupport: true,
                showFill: true,
                showTravel: false,
                showUnknown: true
            });
        }
    }

    render() {
        const state = this.state;
        const actions = this.actions;

        const parentState = this.props.state;

        if (parentState.stage !== STAGE_GENERATED) {
            return null;
        }

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
                        onChange={ (value) => {
                            actions.onChangeShowLayer(value, parentState.layerCount);
                        }}
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
                {state.showPreviewPanel &&
                <div className={styles['preview-panel']}>
                    <div className={styles['preview-title']}>Line Type</div>
                    <div className={styles['preview-type']}>
                        <input
                            type="checkbox"
                            checked={state.showWallInner}
                            onChange={actions.onTogglePreviewWallInner}
                        />
                        Inner Wall
                        <span className={styles['preview-brick']} style={{ backgroundColor: '#00ff00' }} />
                    </div>
                    <div className={styles['preview-type']}>
                        <input
                            type="checkbox"
                            checked={state.showWallOuter}
                            onChange={actions.onTogglePreviewWallOuter}
                        />
                        Outer Wall
                        <span className={styles['preview-brick']} style={{ backgroundColor: '#ff2121' }} />
                    </div>
                    <div className={styles['preview-type']}>
                        <input
                            type="checkbox"
                            checked={state.showSkin}
                            onChange={actions.onTogglePreviewSkin}
                        />
                        Skin
                        <span className={styles['preview-brick']} style={{ backgroundColor: '#ffff00' }} />
                    </div>
                    <div className={styles['preview-type']}>
                        <input
                            type="checkbox"
                            checked={state.showSkirt}
                            onChange={actions.onTogglePreviewSkirt}
                        />
                        Skirt
                        <span className={styles['preview-brick']} style={{ backgroundColor: '#fa8c35' }} />
                    </div>
                    <div className={styles['preview-type']}>
                        <input
                            type="checkbox"
                            checked={state.showSupport}
                            onChange={actions.onTogglePreviewSupport}
                        />
                        Support
                        <span className={styles['preview-brick']} style={{ backgroundColor: '#4b0082' }} />
                    </div>
                    <div className={styles['preview-type']}>
                        <input
                            type="checkbox"
                            checked={state.showFill}
                            onChange={actions.onTogglePreviewFill}
                        />
                        Fill
                        <span className={styles['preview-brick']} style={{ backgroundColor: '#8d4bbb' }} />
                    </div>
                    <div className={styles['preview-type']}>
                        <input
                            type="checkbox"
                            checked={state.showTravel}
                            onChange={actions.onTogglePreviewTravel}
                        />
                        Travel
                        <span className={styles['preview-brick']} style={{ backgroundColor: '#44cef6' }} />
                    </div>
                    <div className={styles['preview-type']}>
                        <input
                            type="checkbox"
                            checked={state.showUnknown}
                            onChange={actions.onTogglePreviewUnknown}
                        />
                        Unknown
                        <span className={styles['preview-brick']} style={{ backgroundColor: '#4b0082' }} />
                    </div>
                </div>
                }
            </React.Fragment>
        );
    }
}

export default VisualizerPreviewControl;
