import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { toFixed } from '../../lib/numeric-utils';
import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { actions } from '../../reducers/modules/laser';
import BWMode from './BWMode';
import GreyscaleMode from './GreyscaleMode';
import VectorMode from './VectorMode';
import TextMode from './TextMode';
import styles from './styles.styl';


class LaserParameters extends PureComponent {
    static propTypes = {
        mode: PropTypes.string.isRequired,
        stage: PropTypes.number.isRequired,
        source: PropTypes.object.isRequired,

        // redux actions
        switchMode: PropTypes.func.isRequired,
        uploadImage: PropTypes.func.isRequired,
        changeTargetSize: PropTypes.func.isRequired
    };

    actions = {
        // common actions shared by all modes
        onChangeFile: (event) => {
            const file = event.target.files[0];
            this.props.uploadImage(file, () => {
                modal({
                    title: i18n._('Parse Image Error'),
                    body: i18n._('Failed to parse image file {{}}', { filename: file.name })
                });
            });
        },
        onChangeWidth: (width) => {
            const ratio = this.props.source.width / this.props.source.height;
            const height = toFixed(width / ratio, 2);
            this.props.changeTargetSize(width, height);
        },
        onChangeHeight: (height) => {
            const ratio = this.props.source.width / this.props.source.height;
            const width = toFixed(height * ratio, 2);
            this.props.changeTargetSize(width, height);
        }
    };

    render() {
        const { mode, switchMode } = this.props;

        return (
            <React.Fragment>
                <div>
                    <div className={styles['laser-mode']}>
                        <Anchor
                            className={classNames(styles['laser-mode-btn'], { [styles.selected]: mode === 'bw' })}
                            onClick={() => switchMode('bw')}
                        >
                            <img
                                src="/images/laser/laser-mode-bw-88x88.png"
                                role="presentation"
                                alt="laser mode B&W"
                            />
                        </Anchor>
                        <span className={styles['laser-mode-text']}>{i18n._('B&W')}</span>
                    </div>
                    <div className={styles['laser-mode']}>
                        <Anchor
                            className={classNames(styles['laser-mode-btn'], { [styles.selected]: mode === 'greyscale' })}
                            onClick={() => switchMode('greyscale')}
                        >
                            <img
                                src="/images/laser/laser-mode-greyscale-88x88.png"
                                role="presentation"
                                alt="laser mode greyscale"
                            />
                        </Anchor>
                        <span className={styles['laser-mode-text']}>{i18n._('GREYSCALE')}</span>
                    </div>
                    <div className={styles['laser-mode']}>
                        <Anchor
                            className={classNames(styles['laser-mode-btn'], { [styles.selected]: mode === 'vector' })}
                            onClick={() => switchMode('vector')}
                        >
                            <img
                                src="/images/laser/laser-mode-vector-88x88.png"
                                role="presentation"
                                alt="laser mode vector"
                            />
                        </Anchor>
                        <span className={styles['laser-mode-text']}>{i18n._('VECTOR')}</span>
                    </div>
                    <div className={styles['laser-mode']} style={{ marginRight: '0' }}>
                        <Anchor
                            className={classNames(styles['laser-mode-btn'], { [styles.selected]: mode === 'text' })}
                            onClick={() => switchMode('text')}
                        >
                            <img
                                src="/images/laser/laser-mode-text-88x88.png"
                                role="presentation"
                                alt="laser mode vector"
                            />
                        </Anchor>
                        <span className={styles['laser-mode-text']}>{i18n._('TEXT')}</span>
                    </div>
                </div>

                <div style={{ marginTop: '15px' }}>
                    {mode === 'bw' &&
                    <BWMode
                        onChangeFile={this.actions.onChangeFile}
                        onChangeWidth={this.actions.onChangeWidth}
                        onChangeHeight={this.actions.onChangeHeight}
                    />
                    }

                    {mode === 'greyscale' &&
                    <GreyscaleMode
                        onChangeFile={this.actions.onChangeFile}
                        onChangeWidth={this.actions.onChangeWidth}
                        onChangeHeight={this.actions.onChangeHeight}
                    />
                    }

                    {mode === 'vector' &&
                    <VectorMode
                        onChangeFile={this.actions.onChangeFile}
                        onChangeWidth={this.actions.onChangeWidth}
                        onChangeHeight={this.actions.onChangeHeight}
                    />
                    }

                    {mode === 'text' &&
                    <TextMode />
                    }
                </div>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const laser = state.laser;
    return {
        mode: laser.mode,
        stage: laser.stage,
        source: state.laser.source
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        switchMode: (mode) => dispatch(actions.switchMode(mode)),
        uploadImage: (file, onFailure) => dispatch(actions.uploadImage(file, onFailure)),
        changeTargetSize: (width, height) => dispatch(actions.changeTargetSize(width, height))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(LaserParameters);
