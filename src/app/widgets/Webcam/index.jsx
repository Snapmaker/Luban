import cx from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';

import { EXPERIMENTAL_WIFI_CONTROL } from '../../constants';
import i18n from '../../lib/i18n';
import portal from '../../lib/portal';
import Space from '../../components/Space';
import Widget from '../../components/Widget';
import { WidgetConfig } from '../../components/SMWidget';

import Settings from './Settings';
import styles from './index.styl';
import { MEDIA_SOURCE_LOCAL } from './constants';

class WebcamWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        onFork: PropTypes.func.isRequired,
        onRemove: PropTypes.func.isRequired,
        sortable: PropTypes.object
    };

    config = new WidgetConfig(this.props.widgetId);

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
        changeImageScale: (value) => {
            this.setState({ scale: value });
        },
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
        return {
            disabled: true, // this.config.get('disabled', true),
            minimized: this.config.get('minimized', false),
            isFullscreen: false,
            mediaSource: this.config.get('mediaSource', MEDIA_SOURCE_LOCAL),
            deviceId: this.config.get('deviceId', ''),
            url: this.config.get('url', ''),
            scale: this.config.get('geometry.scale', 1.0),
            rotation: this.config.get('geometry.rotation', 0),
            flipHorizontally: this.config.get('geometry.flipHorizontally', false),
            flipVertically: this.config.get('geometry.flipVertically', false),
            crosshair: this.config.get('crosshair', false),
            muted: this.config.get('muted', false)
        };
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
        } = this.state;

        this.config.set('disabled', disabled);
        this.config.set('minimized', minimized);
        this.config.set('mediaSource', mediaSource);
        this.config.set('deviceId', deviceId);
        this.config.set('url', url);
        this.config.set('geometry.scale', scale);
        this.config.set('geometry.rotation', rotation);
        this.config.set('geometry.flipHorizontally', flipHorizontally);
        this.config.set('geometry.flipVertically', flipVertically);
        this.config.set('crosshair', crosshair);
        this.config.set('muted', muted);

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
        const { widgetId } = this.props;
        const { disabled, minimized, isFullscreen } = this.state;
        const isForkedWidget = widgetId.match(/\w+:[\w-]+/);
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
                        {isForkedWidget && (
                            <i className="fa fa-code-fork" style={{ marginRight: 5 }} />
                        )}
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
                                } else if (eventKey === 'fork') {
                                    this.props.onFork();
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
                            <Widget.DropdownMenuItem eventKey="fork">
                                <i className="fa fa-fw fa-code-fork" />
                                <Space width="4" />
                                {i18n._('Fork Widget')}
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

export default WebcamWidget;
