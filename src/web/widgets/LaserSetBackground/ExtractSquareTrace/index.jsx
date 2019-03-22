import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import styles from '../styles.styl';
import ExtractPreview from './ExtractPreview';
import Anchor from '../../../components/Anchor';


class ExtractSquareTrace extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        state: PropTypes.shape({
            sideLength: PropTypes.number.isRequired
        }),
        actions: PropTypes.shape({
            changeFilename: PropTypes.func.isRequired
        })
    };

    fileInput = React.createRef();

    extractingPreview = React.createRef();

    actions = {
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
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
                (filename) => {
                    this.props.actions.changeFilename(filename);
                }
            );
        }
    };

    render() {
        const actions = { ...this.props.actions, ...this.actions };

        return (
            <div>
                <input
                    ref={this.fileInput}
                    type="file"
                    accept=".png, .jpg, .jpeg, .bmp"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                <div className="clearfix" />
                <div className={styles['laser-set-background-modal-title']}>
                    {i18n._('Extract Square Trace')}
                </div>
                <div style={{ textAlign: 'center' }}>
                    <ExtractPreview
                        ref={this.extractingPreview}
                        size={this.props.size}
                        width={400}
                        height={400}
                    />
                </div>
                <div className={styles['extract-background']}>
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
                <div style={{ margin: '20px 60px' }}>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={actions.displayPrintTrace}
                        style={{ width: '40%', float: 'left' }}
                    >
                        {i18n._('Previous')}
                    </button>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={actions.completeBackgroundSetting}
                        style={{ width: '40%', float: 'right' }}
                    >
                        {i18n._('Complete')}
                    </button>
                </div>
            </div>
        );
    }
}
const mapStateToProps = (state) => {
    const machine = state.machine;
    return {
        size: machine.size
    };
};

export default connect(mapStateToProps)(ExtractSquareTrace);
