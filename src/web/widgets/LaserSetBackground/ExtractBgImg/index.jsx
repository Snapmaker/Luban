import React, { PureComponent } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';
import ExtractingPreview from './ExtractingPreview';
import Anchor from '../../../components/Anchor';


class ExtractBgImg extends PureComponent {
    static propTypes = {
        state: PropTypes.shape({
            sideLength: PropTypes.number.isRequired
        }),
        actions: PropTypes.shape({
            changeBgImgFilename: PropTypes.func.isRequired
        })
    };

    extractingPreview = React.createRef();

    actions = {
        onClickToUpload: () => {
            this.fileInputEl.value = null;
            this.fileInputEl.click();
        },
        onChangeFile: (event) => {
            const file = event.target.files[0];
            this.extractingPreview.current.uploadPhoto(file);
        },
        reset: () => {
            this.extractingPreview.current.reset();
        },
        extract: () => {
            this.extractingPreview.current.extract(
                this.props.state.sideLength,
                (bgImgFilename) => {
                    this.props.actions.changeBgImgFilename(bgImgFilename);
                }
            );
        }
    };

    render() {
        const actions = { ...this.props.actions, ...this.actions };

        return (
            <React.Fragment>
                <input
                    ref={(node) => {
                        this.fileInputEl = node;
                    }}
                    type="file"
                    accept=".png, .jpg, .jpeg, .bmp"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                <div style={{ width: '100%', height: '100%' }}>
                    <ExtractingPreview ref={this.extractingPreview} />
                    <div className={styles['extract-bg-img']}>
                        <div className={classNames(styles['extract-actions'])}>
                            <Anchor
                                className={styles['extract-actions__btn']}
                                onClick={actions.onClickToUpload}
                            >
                                <i className={styles['extract-actions__icon-upload']} />
                            </Anchor>
                            <span className={styles['extract-actions__text']}>{i18n._('Upload')}</span>
                        </div>
                        <div className={classNames(styles['extract-actions'])}>
                            <Anchor
                                className={styles['extract-actions__btn']}
                                onClick={actions.reset}
                            >
                                <i className={styles['extract-actions__icon-reset']} />
                            </Anchor>
                            <span className={styles['extract-actions__text']}>{i18n._('Reset')}</span>
                        </div>
                        <div className={classNames(styles['extract-actions'])}>
                            <Anchor
                                className={styles['extract-actions__btn']}
                                onClick={actions.extract}
                            >
                                <i className={styles['extract-actions__icon-conform']} />
                            </Anchor>
                            <span className={styles['extract-actions__text']}>{i18n._('Extract')}</span>
                        </div>
                    </div>
                    <div style={{ width: '400px', margin: '0 auto', marginTop: '15px', padding: '20px' }}>
                        <button
                            type="button"
                            className={classNames(styles['btn-large'], styles['btn-default'])}
                            onClick={actions.displayPrintTrace}
                            style={{ width: '40%', float: 'left' }}
                        >
                            {i18n._('Previous')}
                        </button>
                        <button
                            type="button"
                            className={classNames(styles['btn-large'], styles['btn-primary'])}
                            onClick={actions.completeBgImgSetting}
                            style={{ width: '40%', float: 'right' }}
                        >
                            {i18n._('Complete')}
                        </button>
                    </div>
                </div>
            </React.Fragment>
        );
    }
}

export default ExtractBgImg;

