import React, { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import path from 'path';
import classNames from 'classnames';
import { noop } from 'lodash';
import PropTypes from 'prop-types';
import Menu from '../../components/Menu';
import { Button } from '../../components/Buttons';
import Dropdown from '../../components/Dropdown';

// import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import UniApi from '../../../lib/uni-api';
import { actions as printingActions, PRINTING_STAGE } from '../../../flux/printing';
import { actions as workspaceActions } from '../../../flux/workspace';
import { actions as projectActions } from '../../../flux/project';
import { actions as menuActions } from '../../../flux/appbar-menu';
import Thumbnail from './Thumbnail';
import { renderPopup } from '../../utils';

import Workspace from '../../pages/Workspace';
import SvgIcon from '../../components/SvgIcon';

class Output extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes,

        displayGcode: PropTypes.func.isRequired,
        displayModel: PropTypes.func.isRequired,

        modelGroup: PropTypes.object.isRequired,
        isGcodeOverstepped: PropTypes.bool.isRequired,
        workflowState: PropTypes.string.isRequired,
        gcodeLine: PropTypes.object,
        displayedType: PropTypes.string,
        gcodeFile: PropTypes.object,
        hasModel: PropTypes.bool.isRequired,
        hasAnyModelVisible: PropTypes.bool.isRequired,
        stage: PropTypes.number.isRequired,
        isAnyModelOverstepped: PropTypes.bool.isRequired,
        inProgress: PropTypes.bool.isRequired,
        generateGcode: PropTypes.func.isRequired,
        exportFile: PropTypes.func.isRequired,
        renderGcodeFile: PropTypes.func.isRequired
        // onRef: PropTypes.func
    };

    state = {
        showExportOptions: false
    };

    thumbnail = React.createRef();

    actions = {
        onToggleDisplayGcode: () => {
            if (this.props.displayedType === 'gcode') {
                this.props.displayModel();
                this.props.destroyGcodeLine();
            } else {
                this.props.displayGcode();
            }
        },
        handleMouseOver: () => {
            this.setState({
                showExportOptions: true
            });
        },
        handleMouseOut: () => {
            this.setState({
                showExportOptions: false
            });
        },
        onClickGenerateGcode: () => {
            const thumbnail = this.thumbnail.current.getThumbnail();
            this.props.generateGcode(thumbnail);
        },
        onClickLoadGcode: () => {
            if (this.props.isGcodeOverstepped) {
                modal({
                    title: 'Warning',
                    body: 'Generated G-code overstepped out of the cube, please modify your model and re-generate G-code.'
                });
                return;
            }
            const { gcodeFile } = this.props;

            gcodeFile.thumbnail = this.thumbnail.current.getDataURL();

            this.props.renderGcodeFile(gcodeFile);
            this.setState({ showWorkspace: true });

            window.scrollTo(0, 0);
        },
        changeFilenameExt: (filename) => {
            if (path.extname(filename) && ['.stl', '.obj'].includes(path.extname(filename).toLowerCase())) {
                const extname = path.extname(filename);
                filename = `${filename.slice(0, filename.lastIndexOf(extname))}.gcode`;
            }
            return filename;
        },
        onClickExportGcode: () => {
            if (this.props.isGcodeOverstepped) {
                modal({
                    title: 'Warning',
                    body: 'Generated G-code overstepped out of the cube, please modify your model and re-generate G-code.'
                });
                return;
            }

            const { gcodeFile } = this.props;
            const filename = path.basename(gcodeFile.name);
            this.props.exportFile(filename);
        }
    };

    componentDidMount() {
        // this.props.onRef(this);
        UniApi.Event.on('appbar-menu:printing.export-gcode', this.actions.onClickExportGcode);
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.inProgress !== nextProps.inProgress && nextProps.inProgress) {
            this.props.disableMenu();
        } else {
            this.props.enableMenu();
        }
    }

    componentWillUnmount() {
        UniApi.Event.off('appbar-menu:printing.export-gcode', this.actions.onClickExportGcode);
    }

    renderWorkspace() {
        const onClose = () => this.setState({ showWorkspace: false });
        return this.state.showWorkspace && renderPopup({
            onClose,
            component: Workspace
        });
    }

    render() {
        // const state = this.state;
        const actions = this.actions;
        const { workflowState, stage, gcodeLine, hasModel, hasAnyModelVisible, displayedType, inProgress } = this.props;

        const isSlicing = stage === PRINTING_STAGE.SLICING;
        const { isAnyModelOverstepped } = this.props;
        const menu = (
            <Menu>
                <Menu.Item
                    onClick={actions.onClickLoadGcode}
                    disabled={workflowState === 'running' || !gcodeLine || inProgress}
                >
                    <div className={classNames('align-c', 'padding-vertical-4')}>
                        {i18n._('Load G-code to Workspace')}
                    </div>
                </Menu.Item>
                <Menu.Item
                    disabled={!gcodeLine || inProgress}
                    onClick={actions.onClickExportGcode}
                >
                    <div className={classNames('align-c', 'padding-vertical-4')}>
                        {i18n._('Export G-code to File')}
                    </div>
                </Menu.Item>
            </Menu>
        );

        return (
            <div className={classNames('position-fixed', 'border-radius-bottom-8', 'bottom-8', 'background-color-white', 'width-360', 'module-default-shadow', 'print-output-intro')}>
                <div className={classNames('position-re', 'margin-horizontal-16', 'margin-vertical-16')}>
                    {!gcodeLine && (
                        <Button
                            type="primary"
                            priority="level-one"
                            onClick={actions.onClickGenerateGcode}
                            disabled={!hasModel || !hasAnyModelVisible || isSlicing || isAnyModelOverstepped || inProgress}
                        >
                            {i18n._('Generate G-code')}
                        </Button>
                    )}
                    {gcodeLine && !this.state.showExportOptions && (
                        <Button
                            type="default"
                            priority="level-one"
                            disabled={inProgress}
                            onClick={actions.onToggleDisplayGcode}
                            className={classNames('position-re', 'bottom-0', 'left-0')}
                        >
                            {displayedType === 'gcode' ? i18n._('Close Preview') : i18n._('Preview ')}
                        </Button>
                    )}
                    {gcodeLine && (
                        <div
                            onKeyDown={noop}
                            role="button"
                            className={classNames('position-re', 'height-40', 'margin-top-10')}
                            tabIndex={0}
                            // onMouseEnter={actions.handleMouseOver}
                            // onMouseLeave={actions.handleMouseOut}
                        >
                            <Dropdown
                                overlay={menu}
                                trigger="click"
                            >
                                <Button
                                    type="primary"
                                    priority="level-one"
                                    disabled={inProgress}
                                    className={classNames(
                                        'position-ab',
                                        // 'bottom-ne-8',
                                        // 'margin-top-10',
                                        displayedType === gcodeLine ? 'display-block' : 'display-none'
                                    )}
                                    suffixIcon={<SvgIcon name="DropdownOpen" type="static" color="#D5D6D9" />}
                                >
                                    {i18n._('Export')}
                                </Button>
                            </Dropdown>
                        </div>
                    )}
                </div>
                <Thumbnail
                    ref={this.thumbnail}
                    modelGroup={this.props.modelGroup}
                />
                {this.renderWorkspace()}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const printing = state.printing;
    const { workflowState } = state.machine;
    const {
        stage,
        modelGroup, hasModel, isAnyModelOverstepped,
        isGcodeOverstepped, gcodeLine, gcodeFile, displayedType, inProgress
    } = printing;

    return {
        workflowState,
        stage,
        modelGroup,
        hasAnyModelVisible: modelGroup.hasAnyModelVisible(),
        hasModel,
        isAnyModelOverstepped,
        isGcodeOverstepped,
        gcodeLine,
        displayedType,
        gcodeFile,
        inProgress
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        enableMenu: () => dispatch(menuActions.enableMenu()),
        disableMenu: () => dispatch(menuActions.disableMenu()),
        generateGcode: (thumbnail) => dispatch(printingActions.generateGcode(thumbnail)),
        renderGcodeFile: (file) => dispatch(workspaceActions.renderGcodeFile(file)),
        displayGcode: () => dispatch(printingActions.displayGcode()),
        displayModel: () => dispatch(printingActions.displayModel()),
        destroyGcodeLine: () => dispatch(printingActions.destroyGcodeLine()),
        exportFile: (targetFile) => dispatch(projectActions.exportFile(targetFile))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(Output));
