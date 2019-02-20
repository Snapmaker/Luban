import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';

import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { actions } from '../../reducers/laser';

import ConfigRasterBW from './ConfigRasterBW';
import ConfigGreyscale from './ConfigGreyscale';
import ConfigRasterVector from './ConfigRasterVector';
import ConfigSvgVector from './ConfigSvgVector';
import ConfigTextVector from './ConfigTextVector';
import Transformation from './Transformation';
import GcodeConfig from './GcodeConfig';
import PrintOrder from './PrintOrder';
import styles from './styles.styl';

const getAccept = (mode) => {
    let accept = '';
    if (['bw', 'greyscale'].includes(mode)) {
        accept = '.png, .jpg, .jpeg, .bmp';
    } else if (['vector'].includes(mode)) {
        accept = '.svg, .png, .jpg, .jpeg, .bmp';
    }
    return accept;
};

class LaserParameters extends PureComponent {
    static propTypes = {
        model: PropTypes.object,
        modelType: PropTypes.string,
        mode: PropTypes.string.isRequired,
        uploadImage: PropTypes.func.isRequired,
        insertDefaultTextVector: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    state = {
        mode: '', // bw, greyscale, vector
        accept: ''
    };

    actions = {
        onClickToUpload: (mode) => {
            this.setState({
                uploadMode: mode,
                accept: getAccept(mode)
            }, () => {
                this.fileInput.current.value = null;
                this.fileInput.current.click();
            });
        },
        onChangeFile: (event) => {
            const file = event.target.files[0];

            const uploadMode = this.state.uploadMode;
            this.props.uploadImage(file, uploadMode, () => {
                modal({
                    title: i18n._('Parse Image Error'),
                    body: i18n._('Failed to parse image file {{filename}}', { filename: file.name })
                });
            });
        },
        onClickInsertText: () => {
            this.props.insertDefaultTextVector();
        }
    };

    render() {
        const { accept } = this.state;
        const { model, modelType, mode } = this.props;
        const actions = this.actions;

        const isBW = (modelType === 'raster' && mode === 'bw');
        const isGreyscale = (modelType === 'raster' && mode === 'greyscale');
        const isRasterVector = (modelType === 'raster' && mode === 'vector');
        const isSvgVector = (modelType === 'svg' && mode === 'vector');
        const isTextVector = (modelType === 'text' && mode === 'vector');

        return (
            <React.Fragment>
                <input
                    ref={this.fileInput}
                    type="file"
                    accept={accept}
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                <div className={styles['laser-modes']}>
                    <p><b>{i18n._('Select mode to upload:')}</b></p>
                    <div className={classNames(styles['laser-mode'])}>
                        <Anchor
                            className={styles['laser-mode__btn']}
                            onClick={() => actions.onClickToUpload('bw')}
                        >
                            <i className={styles['laser-mode__icon-bw']} />
                        </Anchor>
                        <span className={styles['laser-mode__text']}>{i18n._('B&W')}</span>
                    </div>
                    <div className={classNames(styles['laser-mode'])}>
                        <Anchor
                            className={styles['laser-mode__btn']}
                            onClick={() => actions.onClickToUpload('greyscale')}
                        >
                            <i className={styles['laser-mode__icon-greyscale']} />
                        </Anchor>
                        <span className={styles['laser-mode__text']}>{i18n._('GREYSCALE')}</span>
                    </div>
                    <div className={classNames(styles['laser-mode'])}>
                        <Anchor
                            className={styles['laser-mode__btn']}
                            onClick={() => actions.onClickToUpload('vector')}
                        >
                            <i className={styles['laser-mode__icon-vector']} />
                        </Anchor>
                        <span className={styles['laser-mode__text']}>{i18n._('VECTOR')}</span>
                    </div>
                    <div className={classNames(styles['laser-mode'])} style={{ marginRight: '0' }}>
                        <Anchor
                            className={classNames(styles['laser-mode__btn'])}
                            onClick={() => actions.onClickInsertText()}
                        >
                            <i className={styles['laser-mode__icon-text']} />
                        </Anchor>
                        <span className={styles['laser-mode__text']}>{i18n._('TEXT')}</span>
                    </div>
                </div>
                {model &&
                <div>
                    <div className={styles.separator} />
                    <div style={{ marginTop: '15px' }}>
                        <PrintOrder />
                    </div>
                    <div style={{ marginTop: '15px' }}>
                        <Transformation />
                    </div>

                    <div style={{ marginTop: '15px' }}>
                        {isBW && <ConfigRasterBW />}
                        {isGreyscale && <ConfigGreyscale />}
                        {isRasterVector && <ConfigRasterVector />}
                        {isSvgVector && <ConfigSvgVector />}
                        {isTextVector && <ConfigTextVector />}
                    </div>
                    <div style={{ marginTop: '15px' }}>
                        <GcodeConfig />
                    </div>
                </div>
                }
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const laser = state.laser;
    const { model } = laser;
    const modelType = model ? model.modelInfo.source.type : '';
    const mode = model ? model.modelInfo.mode : '';

    return {
        model: model,
        modelType,
        mode
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, mode, onFailure) => dispatch(actions.uploadImage(file, mode, onFailure)),
        insertDefaultTextVector: () => dispatch(actions.insertDefaultTextVector())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(LaserParameters);

