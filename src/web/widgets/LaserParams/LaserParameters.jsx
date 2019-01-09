import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import ConfigRasterBW from './ConfigRasterBW';
import ConfigRasterGreyscale from './ConfigRasterGreyscale';
import ConfigRasterVector from './ConfigRasterVector';
import ConfigSvgVector from './ConfigSvgVector';
import ConfigTextVector from './ConfigTextVector';
import Transformation from './Transformation';
import GcodeConfig from './GcodeConfig';
import PrintPriority from './PrintPriority';
import styles from './styles.styl';
import { actions } from '../../reducers/modules/laser';

const getAccept = (uploadType) => {
    let accept = '';
    if (['bw', 'greyscale'].includes(uploadType)) {
        accept = '.png, .jpg, .jpeg, .bmp';
    } else if (['vector'].includes(uploadType)) {
        accept = '.svg, .png, .jpg, .jpeg, .bmp';
    }
    return accept;
};

class LaserParameters extends PureComponent {
    static propTypes = {
        model: PropTypes.object,
        modelType: PropTypes.string.isRequired,
        processMode: PropTypes.string.isRequired,
        uploadImage: PropTypes.func.isRequired,
        insertDefaultTextVector: PropTypes.func.isRequired
    };

    fileInputEl = null;

    state = {
        uploadType: '', // bw, greyscale, vector
        accept: ''
    };

    actions = {
        onClickToUpload: (uploadType) => {
            this.setState({
                uploadType: uploadType,
                accept: getAccept(uploadType)
            }, () => {
                this.fileInputEl.value = null;
                this.fileInputEl.click();
            });
        },
        onChangeFile: (event) => {
            const formData = new FormData();
            const file = event.target.files[0];
            formData.append('image', file);

            const processMode = this.state.uploadType;
            this.props.uploadImage(file, processMode, () => {
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
        const { model, modelType, processMode } = this.props;
        const actions = this.actions;

        const combinedMode = `${modelType}-${processMode}`;
        const isRasterBW = combinedMode === 'raster-bw';
        const isRasterGreyscale = combinedMode === 'raster-greyscale';
        const isRasterVector = combinedMode === 'raster-vector';
        const isSvgVector = combinedMode === 'svg-vector';
        const isTextVector = combinedMode === 'text-vector';

        const isAnyModelSelected = !!model;
        return (
            <React.Fragment>
                <input
                    ref={(node) => {
                        this.fileInputEl = node;
                    }}
                    type="file"
                    accept={accept}
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                <div className={styles['laser-modes']}>
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
                {isAnyModelSelected &&
                <div style={{ marginTop: '15px' }}>
                    <PrintPriority />
                </div>
                }
                {isAnyModelSelected &&
                <div style={{ marginTop: '15px' }}>
                    <Transformation />
                </div>
                }
                {isRasterBW &&
                <div style={{ marginTop: '15px' }}>
                    <ConfigRasterBW />
                </div>
                }
                {isRasterGreyscale &&
                <div style={{ marginTop: '15px' }}>
                    <ConfigRasterGreyscale />
                </div>
                }
                {isRasterVector &&
                <div style={{ marginTop: '15px' }}>
                    <ConfigRasterVector />
                </div>
                }
                {isSvgVector &&
                <div style={{ marginTop: '15px' }}>
                    <ConfigSvgVector />
                </div>
                }
                {isTextVector &&
                <div style={{ marginTop: '15px' }}>
                    <ConfigTextVector />
                </div>
                }
                {isAnyModelSelected &&
                <div style={{ marginTop: '15px' }}>
                    <GcodeConfig />
                </div>
                }
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const laser = state.laser;
    return {
        model: laser.model,
        modelType: laser.modelType,
        processMode: laser.processMode
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, processMode, onFailure) => dispatch(actions.uploadImage(file, processMode, onFailure)),
        insertDefaultTextVector: () => dispatch(actions.insertDefaultTextVector())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(LaserParameters);

