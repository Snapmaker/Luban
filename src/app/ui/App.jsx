import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { HashRouter, Route, Switch } from 'react-router-dom';
import { connect } from 'react-redux';
import ReactGA from 'react-ga';
import { /* shortcutActions, */ priorities, ShortcutManager } from '../lib/shortcut';
import { ToastContainer } from './components/Toast';
import { actions as machineActions } from '../flux/machine';
import { actions as developToolsActions } from '../flux/develop-tools';
import { actions as laserActions } from '../flux/laser';
import { actions as editorActions } from '../flux/editor';
import { actions as cncActions } from '../flux/cnc';
import { actions as printingActions } from '../flux/printing';
import { actions as workspaceActions } from '../flux/workspace';
import { actions as textActions } from '../flux/text';
import HomePage from './Pages/HomePage';
import Workspace from './Pages/Workspace';
import Printing from './Pages/Printing';
import Cnc from './Pages/Cnc';
import Laser from './Pages/Laser';
import Settings from './Pages/Settings';
import UniApi from '../lib/uni-api';
import AppLayout from './Layouts/AppLayout';

class App extends PureComponent {
    static propTypes = {
        machineInit: PropTypes.func.isRequired,
        developToolsInit: PropTypes.func.isRequired,
        functionsInit: PropTypes.func.isRequired,
        workspaceInit: PropTypes.func.isRequired,
        textInit: PropTypes.func.isRequired,
        shouldCheckForUpdate: PropTypes.bool.isRequired
    };

    router = React.createRef();

    shortcutHandler = {
        title: this.constructor.name,
        isActive: () => true,
        // active: false,
        priority: priorities.APP,
        shortcuts: {
            // TODO: implement file menu actions
            // [shortcutActions.OPEN]: () => { console.log('app.open'); },
            'LISTALLSHORTCUTS': {
                keys: ['mod+alt+k l'],
                callback: () => {
                    ShortcutManager.printList();
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
        this.props.developToolsInit();

        this.props.functionsInit();
        this.props.workspaceInit();
        this.props.textInit();
        UniApi.Window.initWindow();
        // auto update
        setTimeout(() => {
            if (this.props.shouldCheckForUpdate) {
                UniApi.Update.checkForUpdate();
            }
        }, 200);

        ShortcutManager.register(this.shortcutHandler);
    }

    logPageView() {
        const path = window.location.pathname + window.location.search + window.location.hash;
        ReactGA.set({ page: path });
        ReactGA.pageview(path);
    }

    render() {
        return (
            <HashRouter ref={this.router}>
                <AppLayout>
                    <Switch>
                        <Route path="/" exact component={HomePage} />
                        <Route path="/workspace" component={Workspace} />
                        <Route path="/3dp" component={Printing} />
                        <Route path="/laser" component={Laser} />
                        <Route path="/cnc" component={Cnc} />
                        <Route path="/settings" component={Settings} />
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
                </AppLayout>
            </HashRouter>
        );
    }
}

const mapStateToProps = (state) => {
    const machineInfo = state.machine;
    const { shouldCheckForUpdate } = machineInfo;
    return {
        shouldCheckForUpdate
    };
};
const mapDispatchToProps = (dispatch) => {
    return {
        machineInit: () => dispatch(machineActions.init()),
        developToolsInit: () => dispatch(developToolsActions.init()),
        workspaceInit: () => dispatch(workspaceActions.init()),
        laserInit: () => dispatch(laserActions.init()),
        cncInit: () => dispatch(cncActions.init()),
        printingInit: () => dispatch(printingActions.init()),
        textInit: () => dispatch(textActions.init()),
        functionsInit: () => {
            dispatch(editorActions.initSelectedModelListener('laser'));
            dispatch(editorActions.initSelectedModelListener('cnc'));
        }
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(App);
