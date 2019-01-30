import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import { actions } from '../../reducers/cnc';
import styles from './styles.styl';
import Transformation from './Transformation';
import ConfigRasterGreyscale from './ConfigRasterGreyscale';
import ConfigSvgVector from './ConfigSvgVector';
import GcodeConfig from './GcodeConfig';
import Anchor from '../../components/Anchor';
import modal from '../../lib/modal';
import { STAGE_PREVIEWING } from '../../constants';

const getAccept = (uploadType) => {
    let accept = '';
    if (['greyscale'].includes(uploadType)) {
        accept = '.png, .jpg, .jpeg, .bmp';
    } else if (['vector'].includes(uploadType)) {
        accept = '.svg';
    }
    return accept;
};

class PathParameters extends PureComponent {
    static propTypes = {
        stage: PropTypes.number.isRequired,
        model: PropTypes.object,
        modelType: PropTypes.string.isRequired,
        mode: PropTypes.string.isRequired,
        generateToolPath: PropTypes.func.isRequired,
        uploadImage: PropTypes.func.isRequired
    };

    fileInputEl = null;

    state = {
        uploadType: '', // raster, vector
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

            const mode = this.state.uploadType;
            this.props.uploadImage(file, mode, () => {
                modal({
                    title: i18n._('Parse Image Error'),
                    body: i18n._('Failed to parse image file {{filename}}', { filename: file.name })
                });
            });
        },
        onClickPreview: () => {
            if (this.props.stage === STAGE_PREVIEWING) {
                modal({
                    title: i18n._('Alert'),
                    body: i18n._('Please wait preview complete.')
                });
                return;
            }
            if (!this.props.model) {
                modal({
                    title: i18n._('Alert'),
                    body: i18n._('Please upload model first.')
                });
                return;
            }
            this.props.generateToolPath();
        }
    };

    render() {
        const actions = this.actions;
        const { accept } = this.state;
        const { model, modelType, mode } = this.props;

        const isAnyModelSelected = !!model;

        const combinedMode = `${modelType}-${mode}`;
        const isRasterGreyscale = combinedMode === 'raster-greyscale';
        const isSvgVector = combinedMode === 'svg-vector';

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
                    <p><b>{i18n._('Select mode to upload:')}</b></p>
                    <div className={classNames(styles['laser-mode'])} >
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
                </div>
                {isAnyModelSelected &&
                <div style={{ marginTop: '15px' }} >
                    <Transformation />
                    { isRasterGreyscale && <ConfigRasterGreyscale /> }
                    { isSvgVector && <ConfigSvgVector /> }
                    <div style={{ marginTop: '15px' }} >
                        <GcodeConfig />
                    </div>
                </div>
                }
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-primary'])}
                    onClick={actions.onClickPreview}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    {i18n._('Preview')}
                </button>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { stage, model, modelType } = state.cnc;
    const mode = model ? model.modelInfo.mode : '';
    return {
        stage,
        model,
        modelType,
        mode
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, mode, onFailure) => dispatch(actions.uploadImage(file, mode, onFailure)),
        generateToolPath: () => dispatch(actions.generateToolPath())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(PathParameters);
