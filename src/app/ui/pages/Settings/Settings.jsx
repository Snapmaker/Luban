import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18next from 'i18next';
import _ from 'lodash';
import camelCase from 'lodash/camelCase';
import Uri from 'jsuri';
import React, { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';
// import { Link } from 'react-router-dom';
import isElectron from 'is-electron';
import settings from '../../../config/settings';
import Anchor from '../../components/Anchor';
import confirm from '../../../lib/confirm';
import i18n from '../../../lib/i18n';
// import storeManager from '../../store/local-storage';
import General from './General';
// import FirmwareTool from './FirmwareTool';
// import Workspace from './Workspace';
import MachineSettings from './MachineSettings';
import styles from './index.styl';
import Download from './Download';

const mapSectionPathToId = (path = '') => {
    return camelCase(path.split('/')[0] || '');
};

class Settings extends PureComponent {
    static propTypes = {
        ...withRouter,
        // resetAllUserSettings: PropTypes.func.isRequired,
        pathname: PropTypes.string.isRequired
    };

    sections = [
        {
            id: 'general',
            path: 'general',
            title: i18n._('key-App/Settings/Settings-General'),
            component: (props) => <General {...props} />
        },
        {
            id: 'machine',
            path: 'machine',
            title: i18n._('key-App/Settings/Settings-Machine Settings'),
            component: (props) => <MachineSettings {...props} />
        },
        isElectron() && {
            id: 'download',
            path: 'download',
            title: i18n._('key-App/Settings/Settings-Download'),
            component: (props) => <Download {...props} />
        }
        // {
        //     id: 'config',
        //     path: 'config',
        //     title: i18n._('key-App/Settings/Settings-Config'),
        //     component: (props) => <Workspace {...props} />
        // },
        // {
        //     id: 'firmware',
        //     path: 'firmware',
        //     title: i18n._('key-App/Settings/Settings-Firmware Tool'),
        //     component: (props) => <FirmwareTool {...props} />
        // }
    ];

    initialState = this.getInitialState();

    state = this.getInitialState();

    actions = {
        // General
        general: {
            load: () => {
                const general = {
                    ...this.state.general,
                    api: {
                        ...this.state.general.api,
                        err: false,
                        loading: false
                    },
                    // followed by data
                    lang: i18next.language
                };

                this.initialState.general = general;
                this.setState({ general: general });
            },
            save: () => {
                const { lang = 'en' } = this.state.general;

                this.setState({
                    general: {
                        ...this.state.general,
                        api: {
                            ...this.state.general.api,
                            err: false,
                            saving: false
                        }
                    }
                });

                if (lang !== i18next.language) {
                    i18next.changeLanguage(lang, () => {
                        this.props.history.push('/');
                        const uri = new Uri(window.location.search);
                        uri.replaceQueryParam('lang', lang);
                        window.location.search = uri.toString();
                    });
                }
            },
            restoreSettings: () => {
                // Restore settings from initialState
                this.setState({
                    general: this.initialState.general
                });
            },
            changeLanguage: (lang) => {
                this.setState({
                    general: {
                        ...this.state.general,
                        lang: lang
                    }
                });
            }
        },
        // Workspace
        config: {
            restoreDefaults: async () => {
                const confirmed = await confirm({
                    title: i18n._('key-App/Settings/Settings-Reset All User Settings'),
                    body: i18n._('key-App/Settings/Settings-Are you sure you want to restore the default settings?')
                });
                if (!confirmed) {
                    return;
                }
                // await this.props.resetAllUserSettings();
                window.location.reload();
            }
        },
        // About
        about: {},
        // Firmware
        firmware: {},
        // download manager
        download: {
            onChangeFile: () => { }
        }
    };

    getInitialState() {
        return {
            activePathname: null,
            // General
            general: {
                // followed by api state
                api: {
                    err: false,
                    loading: true, // defaults to true
                    saving: false
                },
                // followed by data
                lang: i18next.language
            },
            // Workspace
            config: {},
            // About
            about: {
                version: {
                    current: settings.version,
                    latest: settings.version,
                    lastUpdate: ''
                }
            },
            // Firmware
            firmware: {
            }
        };
    }

    switchTab(pathname) {
        this.setState({
            activePathname: pathname
        });
    }

    render() {
        const state = {
            ...this.state
        };
        const actions = {
            ...this.actions
        };
        const pathname = state.activePathname || this.props.pathname;
        const initialSectionPath = this.sections[0].path;
        const sectionPath = pathname.replace(/^\/settings(\/)?/, ''); // TODO
        const id = mapSectionPathToId(sectionPath || initialSectionPath);
        const activeSection = _.find(this.sections, { id: id }) || this.sections[0];
        const sectionItems = this.sections.map((section) => (
            <div
                key={section.id}
            >
                <Anchor
                    className={classNames(styles.item, { [styles.selected]: activeSection.id === section.id })}
                    onClick={(e) => {
                        e.preventDefault();
                        this.switchTab(`/settings/${section.path}`);
                    }}
                >
                    <span className="sm-parameter-header__title">{i18n._(section.title)}</span>

                </Anchor>
            </div>
        ));

        // Section component
        const Section = activeSection.component;
        const sectionInitialState = this.initialState[activeSection.id];
        const sectionState = state[activeSection.id];
        const sectionStateChanged = !_.isEqual(sectionInitialState, sectionState);
        const sectionActions = actions[activeSection.id];

        return (
            <div className={classNames(styles['manager-wrapper'], 'sm-flex')}>
                <div className={classNames(styles['manager-grouplist'], 'width-percent-30')}>
                    <div className="sm-parameter-container">
                        {sectionItems}
                    </div>
                </div>
                <div className={classNames(styles['manager-details'])}>
                    <Section
                        {...this.props}
                        initialState={sectionInitialState}
                        state={sectionState}
                        stateChanged={sectionStateChanged}
                        actions={sectionActions}
                    />
                </div>
            </div>
        );
    }
}

export default withRouter(Settings);
