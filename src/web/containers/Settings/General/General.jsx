import classNames from 'classnames';
import get from 'lodash/get';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import FacebookLoading from 'react-facebook-loading';
import settings from '../../../config/settings';
import i18n from '../../../lib/i18n';
import Anchor from '../../../components/Anchor';
import Space from '../../../components/Space';
import styles from './index.styl';

const About = () => {
    return (
        <div className={styles['about-container']}>
            <img
                src="images/snap-logo-square-256x256.png"
                role="presentation"
                alt="presentation"
                className={styles['product-logo']}
            />
            <div className={styles['product-details']}>
                <div className={styles['about-product-name']}>
                    {`Snapmakerjs ${settings.version}`}
                </div>
                <div className={styles['about-product-description']}>
                    {i18n._('A web-based interface for Snapmaker which is able to do 3D Printing, laser engraving and CNC carving.')}
                    <Space width={8} />
                    <Anchor
                        className={styles['learn-more']}
                        href="https://snapmaker.com/support"
                        target="_blank"
                    >
                        {i18n._('Learn more')}
                        <i className="fa fa-arrow-circle-right" style={{ marginLeft: 5 }} />
                    </Anchor>
                </div>
            </div>
        </div>
    );
};

class General extends PureComponent {
    static propTypes = {
        initialState: PropTypes.object,
        state: PropTypes.object,
        stateChanged: PropTypes.bool,
        actions: PropTypes.object
    };

    handlers = {
        changeLanguage: (event) => {
            const { actions } = this.props;
            const target = event.target;
            actions.changeLanguage(target.value);
        },
        cancel: (event) => {
            const { actions } = this.props;
            actions.restoreSettings();
        },
        save: (event) => {
            const { actions } = this.props;
            actions.save();
        }
    };

    componentDidMount() {
        const { actions } = this.props;
        actions.load();
    }

    render() {
        const { state, stateChanged } = this.props;
        const lang = get(state, 'lang', 'en');

        if (state.api.loading) {
            return (
                <FacebookLoading
                    delay={400}
                    zoom={2}
                    style={{ margin: '15px auto' }}
                />
            );
        }

        return (
            <div style={{ marginBottom: '55px' }}>
                <About />

                <form>
                    <div className={styles['form-fields']}>
                        <div className={styles['form-group']}>
                            <label>{i18n._('Language')}</label>
                            <select
                                className={classNames(
                                    'form-control',
                                    styles['form-control'],
                                    styles.short
                                )}
                                value={lang}
                                onChange={this.handlers.changeLanguage}
                            >
                                <option value="de">Deutsch</option>
                                <option value="en">English (US)</option>
                                <option value="es">Español</option>
                                <option value="fr">Français (France)</option>
                                <option value="it">Italiano</option>
                                <option value="ru">Русский</option>
                                <option value="ko">한국어</option>
                                <option value="ja">日本語</option>
                                <option value="zh-cn">中文 (简体)</option>
                            </select>
                        </div>
                    </div>
                    <div className={styles['form-actions']}>
                        <div className="row">
                            <div className="col-md-12">
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={this.handlers.cancel}
                                >
                                    {i18n._('Cancel')}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={!stateChanged}
                                    onClick={this.handlers.save}
                                >
                                    {state.api.saving
                                        ? <i className="fa fa-circle-o-notch fa-spin" />
                                        : <i className="fa fa-save" />
                                    }
                                    <span className="space" />
                                    {i18n._('Save Changes')}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}

export default General;
