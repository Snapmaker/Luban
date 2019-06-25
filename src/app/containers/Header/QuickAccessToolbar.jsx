import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import semver from 'semver';
import controller from '../../lib/controller';
import Modal from '../../components/Modal';
import { Button } from '../../components/Buttons';
import i18n from '../../lib/i18n';
import styles from './styles.styl';

const reloadPage = (forcedReload = true) => {
    // Reload the current page, without using the cache
    window.location.reload(forcedReload);
};

class QuickAccessToolbar extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes,
        state: PropTypes.object
    };

    state = {
        halted: false
    };

    command = {
        cyclestart: () => {
            controller.command('cyclestart');
        },
        feedhold: () => {
            controller.command('feedhold');
        },
        homing: () => {
            controller.command('homing');
        },
        sleep: () => {
            controller.command('sleep');
        },
        unlock: () => {
            controller.command('unlock');
        },
        reset: () => {
            controller.command('reset');
        },
        stop: () => {
            controller.command('reset');
            this.setState({ halted: true });
        }
    };

    render() {
        const { location } = this.props;
        const { currentVersion, latestVersion } = this.props.state;
        const newUpdateAvailable = semver.lt(currentVersion, latestVersion);

        return (
            <div>
                {this.state.halted && (
                    <Modal
                        disableOverlay
                        showCloseButton={false}
                    >
                        <Modal.Body>
                            <div style={{ display: 'flex' }}>
                                <i className="fa fa-exclamation-circle fa-4x text-danger" />
                                <div style={{ marginLeft: 25 }}>
                                    <h5>{i18n._('Server has halted intentionally by you')}</h5>
                                    <p>{i18n._('Emergency stop triggered, Please restart the Snapmaker then reconnect.')}</p>
                                </div>
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                btnStyle="primary"
                                onClick={reloadPage}
                            >
                                {i18n._('Reload')}
                            </Button>
                        </Modal.Footer>
                    </Modal>
                )}
                <div className={styles.quickAccessToolbar}>
                    <ul className="nav navbar-nav">
                        {location.pathname === '/workspace' && (
                            <li className="btn-group btn-group-sm" role="group">
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={this.command.stop}
                                    title={i18n._('Reset')}
                                    disabled={this.state.halted}
                                >
                                    <i className="fa fa-undo" />
                                    <span className="space" />
                                    {i18n._('STOP')}
                                </button>
                            </li>
                        )}
                        {newUpdateAvailable && (
                            <li>
                                <a
                                    href="https://snapmaker.com/download"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ textDecoration: 'underline' }}
                                >
                                    {i18n._('New Update Available')}
                                </a>
                            </li>
                        )}
                        <li>
                            <a href="https://manual.snapmaker.com/" target="_blank" rel="noopener noreferrer">
                                {i18n._('User Manual & FAQ')}
                            </a>
                        </li>
                        <li>
                            <a href="http://forum.snapmaker.com/c/software-and-firmware/snapmakerjs-for-laser-engraving" target="_blank" rel="noopener noreferrer">
                                {i18n._('Forum')}
                            </a>
                        </li>
                        <li>
                            <a href="https://www.myminifactory.com" target="_blank" rel="noopener noreferrer">
                                <img
                                    width="20"
                                    height="20"
                                    src="/images/myminifactory-logo-64x64.png"
                                    alt="Go to MyMiniFactory to find printable objects."
                                />
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        );
    }
}

export default withRouter(QuickAccessToolbar);
