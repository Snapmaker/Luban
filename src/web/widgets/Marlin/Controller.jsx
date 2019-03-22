import PropTypes from 'prop-types';
import React from 'react';
import { Button } from '../../components/Buttons';
import Modal from '../../components/Modal';
import { Nav, NavItem } from '../../components/Navs';
import controller from '../../lib/controller';
import i18n from '../../lib/i18n';
import styles from './index.styl';

const Controller = (props) => {
    const { state, actions } = props;
    const { activeTab = 'state' } = state.modal.params;
    const height = Math.max(window.innerHeight / 2, 200);

    return (
        <Modal
            onClose={actions.closeModal}
            size="lg"
        >
            <Modal.Body style={{ paddingTop: 24 }}>
                <Nav
                    navStyle="tabs"
                    activeKey={activeTab}
                    onSelect={(eventKey, event) => {
                        actions.updateModalParams({ activeTab: eventKey });
                    }}
                    style={{ marginBottom: 10 }}
                >
                    <NavItem eventKey="state">{i18n._('Controller State')}</NavItem>
                    <NavItem eventKey="settings">{i18n._('Controller Settings')}</NavItem>
                </Nav>
                <div className={styles.navContent} style={{ height: height }}>
                    {activeTab === 'state' && (
                        <pre className={styles.pre}>
                            <code>{JSON.stringify(state.controller.state, null, 4)}</code>
                        </pre>
                    )}
                    {activeTab === 'settings' && (
                        <div>
                            <Button
                                btnSize="xs"
                                btnStyle="flat"
                                style={{
                                    position: 'absolute',
                                    right: 10,
                                    top: 10
                                }}
                                onClick={event => {
                                    controller.writeln('$#'); // Settings
                                }}
                            >
                                <i className="fa fa-refresh" />
                                {i18n._('Refresh')}
                            </Button>
                            <pre className={styles.pre}>
                                <code>{JSON.stringify(state.controller.settings, null, 4)}</code>
                            </pre>
                        </div>
                    )}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button onClick={actions.closeModal}>
                    {i18n._('Close')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

Controller.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Controller;
