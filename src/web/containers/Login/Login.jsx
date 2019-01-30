import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { withRouter, Redirect } from 'react-router-dom';
import Notifications from '../../components/Notifications';
import settings from '../../config/settings';
import controller from '../../lib/controller';
import i18n from '../../lib/i18n';
import log from '../../lib/log';
import user from '../../lib/user';
import styles from './index.styl';

class Login extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes
    };

    state = this.getDefaultState();
    actions = {
        showAlertMessage: (msg) => {
            this.setState({ alertMessage: msg });
        },
        clearAlertMessage: () => {
            this.setState({ alertMessage: '' });
        },
        handleSignIn: (event) => {
            event.preventDefault();

            this.setState({
                alertMessage: '',
                authenticating: true,
                redirectToReferrer: false
            });

            const name = this.fields.name.value;
            const password = this.fields.password.value;

            user.signin({ name, password })
                .then(({ authenticated }) => {
                    if (!authenticated) {
                        this.setState({
                            alertMessage: i18n._('Authentication failed.'),
                            authenticating: false,
                            redirectToReferrer: false
                        });
                        return;
                    }

                    log.debug('Create and establish a WebSocket connection');

                    controller.connect(() => {
                        // @see "src/web/index.jsx"
                        this.setState({
                            alertMessage: '',
                            authenticating: false,
                            redirectToReferrer: true
                        });
                    });
                });
        }
    };
    fields = {
        name: null,
        password: null
    };

    getDefaultState() {
        return {
            alertMessage: '',
            authenticating: false,
            redirectToReferrer: false
        };
    }
    render() {
        const { from } = this.props.location.state || { from: { pathname: '/' } };
        const state = { ...this.state };
        const actions = { ...this.actions };
        const { alertMessage, authenticating } = state;

        if (state.redirectToReferrer) {
            log.debug('Redirect to referrer:', from);
            return (
                <Redirect to={from} />
            );
        }

        return (
            <div className={styles.container}>
                <div className={styles.login}>
                    <div className={styles.logo}>
                        <img src="images/snap-logo-square-256x256.png" role="presentation" alt="presentation" />
                    </div>
                    <div className={styles.title}>
                        {i18n._('Sign in to {{name}}', { name: settings.name })}
                    </div>
                    {alertMessage &&
                    <Notifications bsStyle="danger" onDismiss={actions.clearAlertMessage}>
                        {alertMessage}
                    </Notifications>
                    }
                    <form className={styles.form}>
                        <div className="form-group">
                            <input
                                ref={node => {
                                    this.fields.name = node;
                                }}
                                type="text"
                                className="form-control"
                                placeholder={i18n._('Username')}
                            />
                        </div>
                        <div className="form-group">
                            <input
                                ref={node => {
                                    this.fields.password = node;
                                }}
                                type="password"
                                className="form-control"
                                placeholder={i18n._('Password')}
                            />
                        </div>
                        <div className="form-group">
                            <button
                                type="button"
                                className="btn btn-block btn-primary"
                                onClick={this.actions.handleSignIn}
                            >
                                <i
                                    className={classNames(
                                        'fa',
                                        'fa-fw',
                                        { 'fa-spin': authenticating },
                                        { 'fa-circle-o-notch': authenticating },
                                        { 'fa-sign-in': !authenticating }
                                    )}
                                />
                                <span className="space" />
                                {i18n._('Sign In')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }
}

export default withRouter(Login);
