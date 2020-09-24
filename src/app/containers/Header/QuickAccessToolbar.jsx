import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import semver from 'semver';
import { Nav } from 'react-bootstrap';
import { connect } from 'react-redux';
import { controller } from '../../lib/controller';
import i18n from '../../lib/i18n';
import { actions as machineActions } from '../../flux/machine';


class QuickAccessToolbar extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes,
        state: PropTypes.object,
        stopServerGcode: PropTypes.func.isRequired
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
            this.props.stopServerGcode();
        }
    };

    render() {
        const { currentVersion, latestVersion } = this.props.state;
        const newUpdateAvailable = semver.lt(currentVersion, latestVersion);

        return (
            <React.Fragment>
                {newUpdateAvailable && (
                    <Nav.Item>
                        <Nav.Link
                            href="https://snapmaker.com/download"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'underline' }}
                        >
                            {i18n._('New Update Available')}
                        </Nav.Link>
                    </Nav.Item>
                )}
                <Nav.Item>
                    <Nav.Link href="https://snapmaker.zendesk.com/hc/en-us" target="_blank" rel="noopener noreferrer">
                        {i18n._('User Manual & FAQ')}
                    </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                    <Nav.Link href="https://forum.snapmaker.com/c/snapmaker-luban" target="_blank" rel="noopener noreferrer">
                        {i18n._('Forum')}
                    </Nav.Link>
                </Nav.Item>
            </React.Fragment>
        );
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        stopServerGcode: () => dispatch(machineActions.stopServerGcode())
    };
};


export default connect(null, mapDispatchToProps)(withRouter(QuickAccessToolbar));
