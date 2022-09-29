import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { HashRouter, Route, Switch } from 'react-router-dom';
import { connect } from 'react-redux';
import { shortcutActions, priorities, ShortcutManager } from '../lib/shortcut';
import { ToastContainer } from './components/Toast';
import DonwloadList from './widgets/DonwloadList';
import { actions as machineActions } from '../flux/machine';
import { actions as appGlobalActions } from '../flux/app-global';
import { actions as editorActions } from '../flux/editor';
import { actions as textActions } from '../flux/text';
import { actions as settingActions } from '../flux/setting';
import RenderCustomIframe from './utils/renderCustomIframe';
import HomePage from './pages/HomePage';
import Workspace from './pages/Workspace';
import Printing from './pages/Printing';
import Cnc from './pages/Cnc';
import Laser from './pages/Laser';
import UniApi from '../lib/uni-api';
import AppLayout from './layouts/AppLayout';
import { Server } from '../flux/machine/Server';
import { logErrorToGA } from '../lib/gaEvent';

class App extends PureComponent {
    static propTypes = {
        resetUserConfig: PropTypes.func.isRequired,
        machineInit: PropTypes.func.isRequired,
        functionsInit: PropTypes.func.isRequired,
        textInit: PropTypes.func.isRequired,
        updateShowOnlineCase: PropTypes.func.isRequired,
        updateShowDownloadPopup: PropTypes.func.isRequired,
        showOnlineCase: PropTypes.bool.isRequired,
        showDownloadPopup: PropTypes.bool.isRequired,
        shouldCheckForUpdate: PropTypes.bool.isRequired,
        enableShortcut: PropTypes.bool.isRequired,
        updateMultipleEngine: PropTypes.func.isRequired,
        menuDisabledCount: PropTypes.number
    };

    state = {
        hasError: false,
    };

    router = React.createRef();

    shortcutHandler = {
        title: this.constructor.name,
        isActive: () => this.props.enableShortcut,
        // active: false,
        priority: priorities.APP,
        shortcuts: {
            // TODO: implement file menu actions
            [shortcutActions.OPEN]: () => {
                if (this.props.menuDisabledCount <= 0) {
                    UniApi.Event.emit('appbar-menu:open-file');
                }
            },
            [shortcutActions.SAVE]: () => {
                if (this.props.menuDisabledCount <= 0) {
                    UniApi.Event.emit('appbar-menu:save');
                }
            },
            [shortcutActions.SAVE_AS]: () => {
                if (this.props.menuDisabledCount <= 0) {
                    UniApi.Event.emit('appbar-menu:save-as-file');
                }
            },
            [shortcutActions.IMPORT]: () => {
                if (this.props.menuDisabledCount <= 0) {
                    UniApi.Event.emit('appbar-menu:import');
                }
            },
            [shortcutActions.EXPORT_MODELS]: () => {
                if (this.props.menuDisabledCount <= 0) {
                    UniApi.Event.emit('appbar-menu:export-model');
                }
            },
            [shortcutActions.EXPORT_GCODE]: () => {
                if (this.props.menuDisabledCount <= 0) {
                    UniApi.Event.emit('appbar-menu:export-gcode');
                }
            },
            'RESETUSERCONFIG': { // reset user config, which equivalent to fully reinstallation
                keys: ['alt+shift+r'],
                callback: () => {
                    this.props.resetUserConfig();
                }
            },
            'LISTALLSHORTCUTS': {
                keys: ['mod+alt+k l'],
                callback: () => {
                    ShortcutManager.printList();
                }
            },
            'MULTIPLEENGINE': {
                keys: ['mod+alt+k e'],
                callback: () => {
                    this.props.updateMultipleEngine();
                }
            }
        }
    };

    componentDidMount() {
        // disable select text on document
        document.onselectstart = () => {
            return false;
        };
        // init machine module
        // TODO: move init to proper page
        this.props.machineInit();

        this.props.functionsInit();
        this.props.textInit();
        UniApi.Window.initWindow();
        // auto update
        setTimeout(() => {
            if (this.props.shouldCheckForUpdate) {
                UniApi.Update.checkForUpdate();
            }
        }, 200);

        ShortcutManager.register(this.shortcutHandler);
        Server.closeServerAfterWindowReload();
    }

    static getDerivedStateFromError() {
        // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('error', error, errorInfo);
        logErrorToGA(errorInfo);
    }

    onClose = () => {
        this.props.updateShowOnlineCase(false);
    };

    onShowDownloadPopup = () => {
        this.props.updateShowDownloadPopup(true);
    };

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return <h1>Something went wrong. Please reload the app</h1>;
        }
        return (
            <HashRouter ref={this.router}>
                <AppLayout>
                    <Switch>
                        <Route path="/" exact component={HomePage} />
                        <Route path="/workspace" component={Workspace} />
                        <Route path="/printing" component={Printing} />
                        <Route path="/laser" component={Laser} />
                        <Route path="/cnc" component={Cnc} />
                        <Route component={HomePage} />
                    </Switch>
                    <ToastContainer
                        position="top-center"
                        autoClose={5000}
                        hideProgressBar
                        newestOnTop
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                    />
                    <RenderCustomIframe
                        onClose={this.onClose}
                        visible={this.props.showOnlineCase}
                        showDownloadPopup={this.onShowDownloadPopup}
                    />
                    {this.props.showDownloadPopup && (
                        <DonwloadList onClose={() => this.props.updateShowDownloadPopup(false)} />
                    )}
                </AppLayout>
            </HashRouter>
        );
    }
}

const mapStateToProps = (state) => {
    const machineInfo = state.machine;
    const { menuDisabledCount } = state.appbarMenu;
    const { showOnlineCase, showDownloadPopup } = state.appGlobal;
    let enableShortcut = state[window.location.hash.slice(2)]?.enableShortcut;
    enableShortcut = (typeof enableShortcut === 'undefined' ? true : enableShortcut);
    const { shouldCheckForUpdate } = machineInfo;
    return {
        enableShortcut,
        menuDisabledCount,
        shouldCheckForUpdate,
        showOnlineCase,
        showDownloadPopup
    };
};
const mapDispatchToProps = (dispatch) => {
    return {
        resetUserConfig: () => dispatch(settingActions.resetUserConfig()),
        machineInit: () => dispatch(machineActions.init()),
        textInit: () => dispatch(textActions.init()),
        updateShowOnlineCase: (show) => dispatch(appGlobalActions.updateShowOnlineCase(show)),
        updateShowDownloadPopup: (show) => dispatch(appGlobalActions.updateShowDownloadPopup(show)),
        functionsInit: () => {
            dispatch(editorActions.initSelectedModelListener('laser'));
            dispatch(editorActions.initSelectedModelListener('cnc'));
        },
        updateMultipleEngine: () => dispatch(machineActions.updateMultipleEngine())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(App);
