import cx from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';

import { connect } from 'react-redux';
import { EXPERIMENTAL_WIFI_CONTROL } from '../../constants';
import i18n from '../../lib/i18n';
import portal from '../../lib/portal';
import Space from '../../components/Space';
import Widget from '../../components/Widget';

import Settings from './Settings';
import styles from './index.styl';
import { MEDIA_SOURCE_LOCAL } from './constants';
import { actions as widgetActions } from '../../flux/widget';

class WebcamWidget extends PureComponent {
    static propTypes = {
        onRemove: PropTypes.func.isRequired,
        sortable: PropTypes.object,

        disabled: PropTypes.bool.isRequired,
        minimized: PropTypes.bool.isRequired,
        isFullscreen: PropTypes.bool.isRequired,
        mediaSource: PropTypes.string.isRequired,
        deviceId: PropTypes.string.isRequired,
        url: PropTypes.string.isRequired,
        scale: PropTypes.number.isRequired,
        rotation: PropTypes.number.isRequired,
        flipHorizontally: PropTypes.bool.isRequired,
        flipVertically: PropTypes.bool.isRequired,
        crosshair: PropTypes.bool.isRequired,
        muted: PropTypes.bool.isRequired,

        updateWidgetState: PropTypes.func.isRequired
    };

    state = this.getInitialState();

    actions = {
        toggleFullscreen: () => {
            const { minimized, isFullscreen } = this.state;
            this.setState({
                minimized: isFullscreen ? minimized : false,
                isFullscreen: !isFullscreen
            });
        },
        toggleMinimized: () => {
            const { minimized } = this.state;
            this.setState({ minimized: !minimized });
        },
        // changeImageScale: (value) => {
        //     this.setState({ scale: value });
        // },
        rotateLeft: () => {
            const { flipHorizontally, flipVertically, rotation } = this.state;
            const rotateLeft = (flipHorizontally && flipVertically) || (!flipHorizontally && !flipVertically);
            const modulus = 4;
            const i = rotateLeft ? -1 : 1;
            this.setState({ rotation: (Math.abs(Number(rotation || 0)) + modulus + i) % modulus });
        },
        rotateRight: () => {
            const { flipHorizontally, flipVertically, rotation } = this.state;
            const rotateRight = (flipHorizontally && flipVertically) || (!flipHorizontally && !flipVertically);
            const modulus = 4;
            const i = rotateRight ? 1 : -1;
            this.setState({ rotation: (Math.abs(Number(rotation || 0)) + modulus + i) % modulus });
        },
        toggleFlipHorizontally: () => {
            const { flipHorizontally } = this.state;
            this.setState({ flipHorizontally: !flipHorizontally });
        },
        toggleFlipVertically: () => {
            const { flipVertically } = this.state;
            this.setState({ flipVertically: !flipVertically });
        },
        toggleCrosshair: () => {
            const { crosshair } = this.state;
            this.setState({ crosshair: !crosshair });
        },
        toggleMute: () => {
            const { muted } = this.state;
            this.setState({ muted: !muted });
        }
    };

    webcam = null;

    video = React.createRef();

    getInitialState() {
        const {
            disabled,
            minimized,
            isFullscreen,
            mediaSource,
            deviceId,
            url,
            scale,
            rotation,
            flipHorizontally,
            flipVertically,
            crosshair,
            muted
        } = this.props;
        return {
            disabled,
            minimized,
            isFullscreen,
            mediaSource,
            deviceId,
            url,
            scale,
            rotation,
            flipHorizontally,
            flipVertically,
            crosshair,
            muted
        };
        // return {
        //     disabled: true, // this.config.get('disabled', true),
        //     minimized: this.config.get('minimized', false),
        //     isFullscreen: false,
        //     mediaSource: this.config.get('mediaSource', MEDIA_SOURCE_LOCAL),
        //     deviceId: this.config.get('deviceId', ''),
        //     url: this.config.get('url', ''),
        //     scale: this.config.get('geometry.scale', 1.0),
        //     rotation: this.config.get('geometry.rotation', 0),
        //     flipHorizontally: this.config.get('geometry.flipHorizontally', false),
        //     flipVertically: this.config.get('geometry.flipVertically', false),
        //     crosshair: this.config.get('crosshair', false),
        //     muted: this.config.get('muted', false)
        // };
    }

    componentDidMount() {
        const { disabled } = this.state;

        if (!disabled) {
            this.video.current.src = `${window.location.protocol}//${window.location.hostname}:8080/feed.webm`;
            this.video.current.play();
        }
    }

    componentDidUpdate(prevProps, prevState) {
        const {
            disabled,
            minimized,
            mediaSource,
            deviceId,
            url,
            scale,
            rotation,
            flipHorizontally,
            flipVertically,
            crosshair,
            muted
        } = this.props;

        // this.config.set('disabled', disabled);
        // this.config.set('minimized', minimized);
        // this.config.set('mediaSource', mediaSource);
        // this.config.set('deviceId', deviceId);
        // this.config.set('url', url);
        // this.config.set('geometry.scale', scale);
        // this.config.set('geometry.rotation', rotation);
        // this.config.set('geometry.flipHorizontally', flipHorizontally);
        // this.config.set('geometry.flipVertically', flipVertically);
        // this.config.set('crosshair', crosshair);
        // this.config.set('muted', muted);

        this.props.updateWidgetState(
            {
                disabled,
                minimized,
                mediaSource,
                deviceId,
                url,
                geometry: {
                    scale,
                    rotation,
                    flipHorizontally,
                    flipVertically
                },
                crosshair,
                muted
            }
        );

        if (!prevState.disabled && disabled) {
            this.video.current.pause();
            this.video.current.src = '';
        }
        if (prevState.disabled && !disabled) {
            this.video.current.src = `${window.location.protocol}//${window.location.hostname}:8080/feed.webm`;
            this.video.current.play();
        }
    }

    // Public methods
    collapse = () => {
        this.setState({ minimized: true });
    };

    expand = () => {
        this.setState({ minimized: false });
    };

    render() {
        const { disabled, minimized, isFullscreen } = this.state;
        const actions = {
            ...this.actions
        };
        const videoFeed = `${window.location.protocol}//${window.location.hostname}:8080/feed.webm`;

        if (!EXPERIMENTAL_WIFI_CONTROL) {
            return null;
        }

        return (
            <Widget fullscreen={isFullscreen}>
                <Widget.Header>
                    <Widget.Title>
                        <Widget.Sortable className={this.props.sortable.handleClassName}>
                            <i className="fa fa-bars" />
                            <Space width="8" />
                        </Widget.Sortable>
                        {i18n._('Webcam')}
                    </Widget.Title>
                    <Widget.Controls className={this.props.sortable.filterClassName}>
                        <Widget.Button
                            title={disabled ? i18n._('Enable') : i18n._('Disable')}
                            type="default"
                            onClick={() => this.setState({ disabled: !disabled })}
                        >
                            <i
                                className={cx('fa', 'fa-fw', {
                                    'fa-toggle-on': !disabled, // TODO
                                    'fa-toggle-off': disabled // TODO
                                })}
                            />
                        </Widget.Button>
                        <Widget.Button
                            title={i18n._('Edit')}
                            onClick={() => {
                                const { mediaSource, deviceId, url } = this.state;

                                portal(({ onClose }) => (
                                    <Settings
                                        mediaSource={mediaSource}
                                        deviceId={deviceId}
                                        url={url}
                                        onSave={(data) => {
                                            this.setState(data);
                                            onClose();
                                        }}
                                        onCancel={() => {
                                            onClose();
                                        }}
                                    />
                                ));
                            }}
                        >
                            <i className="fa fa-cog" />
                        </Widget.Button>
                        <Widget.Button
                            disabled={isFullscreen}
                            title={minimized ? i18n._('Expand') : i18n._('Collapse')}
                            onClick={actions.toggleMinimized}
                        >
                            <i
                                className={cx('fa', 'fa-fw', {
                                    'fa-chevron-up': !minimized,
                                    'fa-chevron-down': minimized
                                })}
                            />
                        </Widget.Button>
                        <Widget.DropdownButton
                            title={i18n._('More')}
                            toggle={<i className="fa fa-ellipsis-v" />}
                            onSelect={(eventKey) => {
                                if (eventKey === 'fullscreen') {
                                    actions.toggleFullscreen();
                                } else if (eventKey === 'remove') {
                                    this.props.onRemove();
                                }
                            }}
                        >
                            <Widget.DropdownMenuItem eventKey="fullscreen">
                                <i
                                    className={cx('fa', 'fa-fw', {
                                        'fa-expand': !isFullscreen,
                                        'fa-compress': isFullscreen
                                    })}
                                />
                                <Space width="4" />
                                {!isFullscreen ? i18n._('Enter Full Screen') : i18n._('Exit Full Screen')}
                            </Widget.DropdownMenuItem>
                            <Widget.DropdownMenuItem eventKey="remove">
                                <i className="fa fa-fw fa-times" />
                                <Space width="4" />
                                {i18n._('Remove Widget')}
                            </Widget.DropdownMenuItem>
                        </Widget.DropdownButton>
                    </Widget.Controls>
                </Widget.Header>
                <Widget.Content
                    className={cx(styles.widgetContent, {
                        [styles.hidden]: minimized,
                        [styles.fullscreen]: isFullscreen
                    })}
                >
                    <video
                        ref={this.video}
                        autoPlay
                        muted
                        loop
                        preload="auto"
                        style={{ width: '100%', display: 'block' }}
                    >
                        <source src={videoFeed} type="video/webm" />
                        <track kind="captions" />
                    </video>
                </Widget.Content>
            </Widget>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { widgets } = state.widget;
    const { widgetId } = ownProps;
    const {
        disabled = true, // this.config.get('disabled', true),
        minimized = false,
        isFullscreen = false,
        mediaSource = MEDIA_SOURCE_LOCAL,
        deviceId = '',
        url = '',

        crosshair = false,
        muted = false
    } = widgets[widgetId];
    const {
        scale = 1.0,
        rotation = 0,
        flipHorizontally = false,
        flipVertically = false
    } = widgets[widgetId].geometry;
    return {
        disabled,
        minimized,
        isFullscreen,
        mediaSource,
        deviceId,
        url,
        scale,
        rotation,
        flipHorizontally,
        flipVertically,
        crosshair,
        muted
    };
};
const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        updateWidgetState: (state) => dispatch(widgetActions.updateWidgetState(ownProps.widgetId, '', state))
    };
};
export default connect(mapStateToProps, mapDispatchToProps)(WebcamWidget);
