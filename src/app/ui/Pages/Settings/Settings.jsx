import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18next from 'i18next';
import _ from 'lodash';
import camelCase from 'lodash/camelCase';
import Uri from 'jsuri';
import React, { PureComponent } from 'react';
// import { Link } from 'react-router-dom';
import settings from '../../../config/settings';
// import Breadcrumbs from '../../components/Breadcrumbs';
import confirm from '../../../lib/confirm';
import i18n from '../../../lib/i18n';
// import storeManager from '../../store/local-storage';
import General from './General';
// import FirmwareTool from './FirmwareTool';
// import Workspace from './Workspace';
import MachineSettings from './MachineSettings';
import styles from './index.styl';

const mapSectionPathToId = (path = '') => {
    return camelCase(path.split('/')[0] || '');
};

class Settings extends PureComponent {
    static propTypes = {
        // resetAllUserSettings: PropTypes.func.isRequired,
        location: PropTypes.object.isRequired
    };

    sections = [
        {
            id: 'general',
            path: 'general',
            title: i18n._('General'),
            component: (props) => <General {...props} />
        },
        {
            id: 'machine',
            path: 'machine',
            title: i18n._('Machine Settings'),
            component: (props) => <MachineSettings {...props} />
        }
        // {
        //     id: 'config',
        //     path: 'config',
        //     title: i18n._('Config'),
        //     component: (props) => <Workspace {...props} />
        // },
        // {
        //     id: 'firmware',
        //     path: 'firmware',
        //     title: i18n._('Firmware Tool'),
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
                    title: i18n._('Reset All User Settings'),
                    body: i18n._('Are you sure you want to restore the default settings?')
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
        firmware: {}
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
        const pathname = state.activePathname || this.props.location.pathname;
        const initialSectionPath = this.sections[0].path;
        const sectionPath = pathname.replace(/^\/settings(\/)?/, ''); // TODO
        const id = mapSectionPathToId(sectionPath || initialSectionPath);
        const activeSection = _.find(this.sections, { id: id }) || this.sections[0];
        const sectionItems = this.sections.map((section) => (
            <li
                key={section.id}
                className={classNames(
                    { [styles.active]: activeSection.id === section.id }
                )}
            >
                <span
                    role="button"
                    tabIndex="-1"
                    onKeyPress={() => {}}
                    onClick={(e) => {
                        e.preventDefault();
                        this.switchTab(`/settings/${section.path}`);
                    }}
                >
                    {section.title}
                </span>
            </li>
        ));

        // Section component
        const Section = activeSection.component;
        const sectionInitialState = this.initialState[activeSection.id];
        const sectionState = state[activeSection.id];
        const sectionStateChanged = !_.isEqual(sectionInitialState, sectionState);
        const sectionActions = actions[activeSection.id];

        return (
            <div className={styles.settings}>
                {/* <Breadcrumbs>
                    <Breadcrumbs.Item active>{i18n._('Settings')}</Breadcrumbs.Item>
                </Breadcrumbs> */}
                <div className={classNames(styles.container, styles.border)}>
                    <div className={styles.row}>
                        <div className={classNames(styles.col, styles.sidenav)}>
                            <nav className={styles.navbar}>
                                <ul className={styles.nav}>
                                    {sectionItems}
                                </ul>
                            </nav>
                        </div>
                        <div className={classNames(styles.col, styles.splitter)} />
                        <div className={classNames(styles.col, styles.section)}>
                            <div className={styles.heading}>{activeSection.title}</div>
                            <div className={styles.content}>
                                <Section
                                    {...this.props}
                                    initialState={sectionInitialState}
                                    state={sectionState}
                                    stateChanged={sectionStateChanged}
                                    actions={sectionActions}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default Settings;
