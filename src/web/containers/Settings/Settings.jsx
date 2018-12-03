import classNames from 'classnames';
import i18next from 'i18next';
import _ from 'lodash';
import camelCase from 'lodash/camelCase';
import Uri from 'jsuri';
import React, { PureComponent } from 'react';
import { Link, withRouter } from 'react-router-dom';
import api from '../../api';
import settings from '../../config/settings';
import Breadcrumbs from '../../components/Breadcrumbs';
import confirm from '../../lib/confirm';
import i18n from '../../lib/i18n';
import store from '../../store';
import General from './General';
import Workspace from './Workspace';
import Enclosure from './Enclosure';
import Commands from './Commands';
import Events from './Events';
import styles from './index.styl';
import {
    ERR_CONFLICT,
    ERR_PRECONDITION_FAILED
} from '../../api/constants';

const mapSectionPathToId = (path = '') => {
    return camelCase(path.split('/')[0] || '');
};

class Settings extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes
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
            title: i18n._('Enclosure'),
            component: (props) => <Enclosure {...props} />
        },
        {
            id: 'workspace',
            path: 'workspace',
            title: i18n._('Workspace'),
            component: (props) => <Workspace {...props} />
        },
        {
            id: 'commands',
            path: 'commands',
            title: i18n._('Commands'),
            component: (props) => <Commands {...props} />
        },
        {
            id: 'events',
            path: 'events',
            title: i18n._('Events'),
            component: (props) => <Events {...props} />
        }
    ];
    initialState = this.getInitialState();
    state = this.getInitialState();
    actions = {
        // General
        general: {
            load: (options) => {
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
                    i18next.changeLanguage(lang, (err, t) => {
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
        workspace: {
            restoreDefaults: () => {
                confirm({
                    title: i18n._('Restore Defaults'),
                    body: i18n._('Are you sure you want to restore the default settings?')
                }).then(() => {
                    store.clear();
                    window.location.reload();
                });
            }
        },
        // My Account
        account: {
            fetchRecords: (options) => {
                const state = this.state.account;
                const {
                    page = state.pagination.page,
                    pageLength = state.pagination.pageLength
                } = { ...options };

                this.setState({
                    account: {
                        ...this.state.account,
                        api: {
                            ...this.state.account.api,
                            err: false,
                            fetching: true
                        }
                    }
                });

                api.users.fetch({ page, pageLength })
                    .then((res) => {
                        const { pagination, records } = res.body;

                        this.setState({
                            account: {
                                ...this.state.account,
                                api: {
                                    ...this.state.account.api,
                                    err: false,
                                    fetching: false
                                },
                                pagination: {
                                    page: pagination.page,
                                    pageLength: pagination.pageLength,
                                    totalRecords: pagination.totalRecords
                                },
                                records: records
                            }
                        });
                    })
                    .catch((res) => {
                        this.setState({
                            account: {
                                ...this.state.account,
                                api: {
                                    ...this.state.account.api,
                                    err: true,
                                    fetching: false
                                },
                                records: []
                            }
                        });
                    });
            },
            createRecord: (options) => {
                const actions = this.actions.account;

                api.users.create(options)
                    .then((res) => {
                        actions.closeModal();
                        actions.fetchRecords();
                    })
                    .catch((res) => {
                        const fallbackMsg = i18n._('An unexpected error has occurred.');
                        const msg = {
                            [ERR_CONFLICT]: i18n._('The account name is already being used. Choose another name.')
                        }[res.status] || fallbackMsg;

                        actions.updateModalParams({ alertMessage: msg });
                    });
            },
            updateRecord: (id, options, forceReload = false) => {
                const actions = this.actions.account;

                api.users.update(id, options)
                    .then((res) => {
                        actions.closeModal();

                        if (forceReload) {
                            actions.fetchRecords();
                            return;
                        }

                        const records = this.state.account.records;
                        const index = _.findIndex(records, { id: id });

                        if (index >= 0) {
                            records[index] = {
                                ...records[index],
                                ...options
                            };

                            this.setState({
                                account: {
                                    ...this.state.account,
                                    records: records
                                }
                            });
                        }
                    })
                    .catch((res) => {
                        const fallbackMsg = i18n._('An unexpected error has occurred.');
                        const msg = {
                            [ERR_CONFLICT]: i18n._('The account name is already being used. Choose another name.'),
                            [ERR_PRECONDITION_FAILED]: i18n._('Passwords do not match.')
                        }[res.status] || fallbackMsg;

                        actions.updateModalParams({ alertMessage: msg });
                    });
            },
            deleteRecord: (id) => {
                const actions = this.actions.account;

                api.users.delete(id)
                    .then((res) => {
                        actions.fetchRecords();
                    })
                    .catch((res) => {
                        // Ignore error
                    });
            },
            openModal: (name = '', params = {}) => {
                this.setState({
                    account: {
                        ...this.state.account,
                        modal: {
                            name: name,
                            params: params
                        }
                    }
                });
            },
            closeModal: () => {
                this.setState({
                    account: {
                        ...this.state.account,
                        modal: {
                            name: '',
                            params: {}
                        }
                    }
                });
            },
            updateModalParams: (params = {}) => {
                this.setState({
                    account: {
                        ...this.state.account,
                        modal: {
                            ...this.state.account.modal,
                            params: {
                                ...this.state.account.modal.params,
                                ...params
                            }
                        }
                    }
                });
            }
        },
        // Commands
        commands: {
            fetchRecords: (options) => {
                const state = this.state.commands;
                const {
                    page = state.pagination.page,
                    pageLength = state.pagination.pageLength
                } = { ...options };

                this.setState({
                    commands: {
                        ...this.state.commands,
                        api: {
                            ...this.state.commands.api,
                            err: false,
                            fetching: true
                        }
                    }
                });

                api.commands.fetch({ page, pageLength })
                    .then((res) => {
                        const { pagination, records } = res.body;

                        this.setState({
                            commands: {
                                ...this.state.commands,
                                api: {
                                    ...this.state.commands.api,
                                    err: false,
                                    fetching: false
                                },
                                pagination: {
                                    page: pagination.page,
                                    pageLength: pagination.pageLength,
                                    totalRecords: pagination.totalRecords
                                },
                                records: records
                            }
                        });
                    })
                    .catch((res) => {
                        this.setState({
                            commands: {
                                ...this.state.commands,
                                api: {
                                    ...this.state.commands.api,
                                    err: true,
                                    fetching: false
                                },
                                records: []
                            }
                        });
                    });
            },
            createRecord: (options) => {
                const actions = this.actions.commands;

                api.commands.create(options)
                    .then((res) => {
                        actions.closeModal();
                        actions.fetchRecords();
                    })
                    .catch((res) => {
                        const fallbackMsg = i18n._('An unexpected error has occurred.');
                        const msg = {
                            // TODO
                        }[res.status] || fallbackMsg;

                        actions.updateModalParams({ alertMessage: msg });
                    });
            },
            updateRecord: (id, options, forceReload = false) => {
                const actions = this.actions.commands;

                api.commands.update(id, options)
                    .then((res) => {
                        actions.closeModal();

                        if (forceReload) {
                            actions.fetchRecords();
                            return;
                        }

                        const records = this.state.commands.records;
                        const index = _.findIndex(records, { id: id });

                        if (index >= 0) {
                            records[index] = {
                                ...records[index],
                                ...options
                            };

                            this.setState({
                                commands: {
                                    ...this.state.commands,
                                    records: records
                                }
                            });
                        }
                    })
                    .catch((res) => {
                        const fallbackMsg = i18n._('An unexpected error has occurred.');
                        const msg = {
                            // TODO
                        }[res.status] || fallbackMsg;

                        actions.updateModalParams({ alertMessage: msg });
                    });
            },
            deleteRecord: (id) => {
                const actions = this.actions.commands;

                api.commands.delete(id)
                    .then((res) => {
                        actions.fetchRecords();
                    })
                    .catch((res) => {
                        // Ignore error
                    });
            },
            openModal: (name = '', params = {}) => {
                this.setState({
                    commands: {
                        ...this.state.commands,
                        modal: {
                            name: name,
                            params: params
                        }
                    }
                });
            },
            closeModal: () => {
                this.setState({
                    commands: {
                        ...this.state.commands,
                        modal: {
                            name: '',
                            params: {}
                        }
                    }
                });
            },
            updateModalParams: (params = {}) => {
                this.setState({
                    commands: {
                        ...this.state.commands,
                        modal: {
                            ...this.state.commands.modal,
                            params: {
                                ...this.state.commands.modal.params,
                                ...params
                            }
                        }
                    }
                });
            }
        },
        // Events
        events: {
            fetchRecords: (options) => {
                const state = this.state.events;
                const {
                    page = state.pagination.page,
                    pageLength = state.pagination.pageLength
                } = { ...options };

                this.setState({
                    events: {
                        ...this.state.events,
                        api: {
                            ...this.state.events.api,
                            err: false,
                            fetching: true
                        }
                    }
                });

                api.events.fetch({ page, pageLength })
                    .then((res) => {
                        const { pagination, records } = res.body;

                        this.setState({
                            events: {
                                ...this.state.events,
                                api: {
                                    ...this.state.events.api,
                                    err: false,
                                    fetching: false
                                },
                                pagination: {
                                    page: pagination.page,
                                    pageLength: pagination.pageLength,
                                    totalRecords: pagination.totalRecords
                                },
                                records: records
                            }
                        });
                    })
                    .catch((res) => {
                        this.setState({
                            events: {
                                ...this.state.events,
                                api: {
                                    ...this.state.events.api,
                                    err: true,
                                    fetching: false
                                },
                                records: []
                            }
                        });
                    });
            },
            createRecord: (options) => {
                const actions = this.actions.events;

                api.events.create(options)
                    .then((res) => {
                        actions.closeModal();
                        actions.fetchRecords();
                    })
                    .catch((res) => {
                        const fallbackMsg = i18n._('An unexpected error has occurred.');
                        const msg = {
                            // TODO
                        }[res.status] || fallbackMsg;

                        actions.updateModalParams({ alertMessage: msg });
                    });
            },
            updateRecord: (id, options, forceReload = false) => {
                const actions = this.actions.events;

                api.events.update(id, options)
                    .then((res) => {
                        actions.closeModal();

                        if (forceReload) {
                            actions.fetchRecords();
                            return;
                        }

                        const records = this.state.events.records;
                        const index = _.findIndex(records, { id: id });

                        if (index >= 0) {
                            records[index] = {
                                ...records[index],
                                ...options
                            };

                            this.setState({
                                events: {
                                    ...this.state.events,
                                    records: records
                                }
                            });
                        }
                    })
                    .catch((res) => {
                        const fallbackMsg = i18n._('An unexpected error has occurred.');
                        const msg = {
                            // TODO
                        }[res.status] || fallbackMsg;

                        actions.updateModalParams({ alertMessage: msg });
                    });
            },
            deleteRecord: (id) => {
                const actions = this.actions.events;

                api.events.delete(id)
                    .then((res) => {
                        actions.fetchRecords();
                    })
                    .catch((res) => {
                        // Ignore error
                    });
            },
            openModal: (name = '', params = {}) => {
                this.setState({
                    events: {
                        ...this.state.events,
                        modal: {
                            name: name,
                            params: params
                        }
                    }
                });
            },
            closeModal: () => {
                this.setState({
                    events: {
                        ...this.state.events,
                        modal: {
                            name: '',
                            params: {}
                        }
                    }
                });
            },
            updateModalParams: (params = {}) => {
                this.setState({
                    events: {
                        ...this.state.events,
                        modal: {
                            ...this.state.events.modal,
                            params: {
                                ...this.state.events.modal.params,
                                ...params
                            }
                        }
                    }
                });
            }
        },
        // About
        about: {}
    };

    componentDidMount() {
        this.mounted = true;
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    getInitialState() {
        return {
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
            workspace: {},
            // My Account
            account: {
                // followed by api state
                api: {
                    err: false,
                    fetching: false
                },
                // followed by data
                pagination: {
                    page: 1,
                    pageLength: 10,
                    totalRecords: 0
                },
                records: [],
                // Modal
                modal: {
                    name: '',
                    params: {
                        alertMessage: '',
                        changePassword: false
                    }
                }
            },
            // Commands
            commands: {
                // followed by api state
                api: {
                    err: false,
                    fetching: false
                },
                // followed by data
                pagination: {
                    page: 1,
                    pageLength: 10,
                    totalRecords: 0
                },
                records: [],
                // Modal
                modal: {
                    name: '',
                    params: {}
                }
            },
            // Events
            events: {
                // followed by api state
                api: {
                    err: false,
                    fetching: false
                },
                // followed by data
                pagination: {
                    page: 1,
                    pageLength: 10,
                    totalRecords: 0
                },
                records: [],
                // Modal
                modal: {
                    name: '',
                    params: {}
                }
            },
            // About
            about: {
                version: {
                    current: settings.version,
                    latest: settings.version,
                    lastUpdate: ''
                }
            }
        };
    }

    render() {
        const state = {
            ...this.state
        };
        const actions = {
            ...this.actions
        };
        const { pathname = '' } = this.props.location;
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
                <Link to={`/settings/${section.path}`}>
                    {section.title}
                </Link>
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
                <Breadcrumbs>
                    <Breadcrumbs.Item active>{i18n._('Settings')}</Breadcrumbs.Item>
                </Breadcrumbs>
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

export default withRouter(Settings);
