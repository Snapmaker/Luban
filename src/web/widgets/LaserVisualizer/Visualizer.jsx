import React, { Component } from 'react';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import isEqual from 'lodash/isEqual';
import { Canvas, PrintablePlate } from '../Canvas';
import PrimaryToolbar from '../CanvasToolbar/PrimaryToolbar';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import styles from '../styles.styl';
import { actions } from '../../reducers/cncLaserShared';
import combokeys from '../../lib/combokeys';
import ContextMenu from '../../components/ContextMenu';
import i18n from '../../lib/i18n';


class Visualizer extends Component {
    static propTypes = {
        hasModel: PropTypes.bool.isRequired,
        size: PropTypes.object.isRequired,
        model: PropTypes.object,
        transformation: PropTypes.object,
        backgroundGroup: PropTypes.object.isRequired,
        modelGroup: PropTypes.object.isRequired,
        selectModel: PropTypes.func.isRequired,
        unselectAllModels: PropTypes.func.isRequired,
        removeSelectedModel: PropTypes.func.isRequired,
        onModelTransform: PropTypes.func.isRequired
    };

    contextMenuDomElement = null;
    visualizerDomElement = null;

    printableArea = null;
    canvas = React.createRef();

    state = {
        coordinateVisible: true
    };

    actions = {
        // canvas header
        switchCoordinateVisibility: () => {
            const visible = !this.state.coordinateVisible;
            this.setState(
                { coordinateVisible: visible },
                () => {
                    this.printableArea.changeCoordinateVisibility(visible);
                }
            );
        },
        // canvas footer
        zoomIn: () => {
            this.canvas.current.zoomIn();
        },
        zoomOut: () => {
            this.canvas.current.zoomOut();
        },
        autoFocus: () => {
            this.canvas.current.autoFocus();
        },
        onSelectModel: (model) => {
            this.props.selectModel(model);
        },
        onUnselectAllModels: () => {
            this.props.unselectAllModels();
        },
        onModelAfterTransform: () => {
        },
        onModelTransform: () => {
            this.props.onModelTransform();
        },
        // context menu
        bringToFront: () => {
        },
        sendToBack: () => {
        },
        deleteSelectedModel: () => {
        },
        arrangeAllModels: () => {
        }
    };

    keyEventHandlers = {
        'DELETE': (event) => {
            this.props.removeSelectedModel();
        }
    };

    constructor(props) {
        super(props);

        const size = props.size;
        this.printableArea = new PrintablePlate(size);
    }

    addEventHandlers() {
        Object.keys(this.keyEventHandlers).forEach(eventName => {
            const callback = this.keyEventHandlers[eventName];
            combokeys.on(eventName, callback);
        });
    }

    removeEventHandlers() {
        Object.keys(this.keyEventHandlers).forEach(eventName => {
            const callback = this.keyEventHandlers[eventName];
            combokeys.removeListener(eventName, callback);
        });
    }

    hideContextMenu = () => {
        ContextMenu.hide();
    };

    onMouseUp = (event) => {
        if (event.button === THREE.MOUSE.RIGHT) {
            this.contextMenuDomElement.show(event);
        }
    };

    componentDidMount() {
        this.visualizerDomElement.addEventListener('mouseup', this.onMouseUp, false);
        this.visualizerDomElement.addEventListener('wheel', this.hideContextMenu, false);

        this.canvas.current.resizeWindow();
        this.canvas.current.disable3D();

        window.addEventListener(
            'hashchange',
            (event) => {
                if (event.newURL.endsWith('laser')) {
                    this.canvas.current.resizeWindow();
                } else {
                    // Unselect all models when switch to other tabs
                    this.props.unselectAllModels();
                }
            },
            false
        );

        this.addEventHandlers();
    }

    componentWillUnmount() {
        this.removeEventHandlers();
        this.visualizerDomElement.removeEventListener('mouseup', this.onMouseUp, false);
        this.visualizerDomElement.removeEventListener('wheel', this.hideContextMenu, false);
    }

    componentWillReceiveProps(nextProps) {
        if (!isEqual(nextProps.size, this.props.size)) {
            const size = nextProps.size;
            this.printableArea.updateSize(size);
        }

        // TODO: fix
        this.canvas.current.updateTransformControl2D();
        const { model } = nextProps;
        if (!model) {
            this.canvas.current.detachSelectedModel();
        } else {
            const sourceType = model.modelInfo.source.type;
            if (sourceType === 'text') {
                this.canvas.current.setTransformControls2DState({ enabledScale: false });
            } else {
                this.canvas.current.setTransformControls2DState({ enabledScale: true });
            }
            this.canvas.current.transformControls.attach(model);
        }
    }

    render() {
        const actions = this.actions;
        const isModelSelected = !!this.props.model;
        const hasModel = this.props.hasModel;
        return (
            <div
                ref={(node) => {
                    this.visualizerDomElement = node;
                }}
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
            >
                <div className={styles['canvas-header']}>
                    <PrimaryToolbar actions={this.actions} state={this.state} />
                </div>
                <div className={styles['canvas-content']}>
                    <Canvas
                        ref={this.canvas}
                        size={this.props.size}
                        backgroundGroup={this.props.backgroundGroup}
                        modelGroup={this.props.modelGroup}
                        printableArea={this.printableArea}
                        enabledTransformModel={true}
                        modelInitialRotation={new THREE.Euler()}
                        cameraInitialPosition={new THREE.Vector3(0, 0, 70)}
                        onSelectModel={actions.onSelectModel}
                        onUnselectAllModels={actions.onUnselectAllModels}
                        onModelAfterTransform={actions.onModelAfterTransform}
                        onModelTransform={actions.onModelTransform}
                        transformModelType="2D"
                    />
                </div>
                <div className={styles['canvas-footer']}>
                    <SecondaryToolbar actions={this.actions} />
                </div>
                <ContextMenu
                    ref={node => {
                        this.contextMenuDomElement = node;
                    }}
                    id="laser"
                    items={
                        [
                            {
                                str: i18n._('Bring to Front'),
                                disabled: !isModelSelected,
                                onClick: actions.bringToFront
                            },
                            {
                                str: i18n._('Send to Back'),
                                disabled: !isModelSelected,
                                onClick: actions.sendToBack
                            },
                            'separator',
                            {
                                str: i18n._('Delete Selected Model'),
                                disabled: !isModelSelected,
                                onClick: actions.deleteSelectedModel
                            },
                            {
                                str: i18n._('Arrange All Models'),
                                disabled: !hasModel,
                                onClick: actions.arrangeAllModels
                            }
                        ]
                    }
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    const { background } = state.laser;
    // call canvas.updateTransformControl2D() when transformation changed or model selected changed
    const { modelGroup, transformation, model, hasModel } = state.cncLaserShared.laser;
    return {
        size: machine.size,
        model,
        modelGroup,
        transformation,
        backgroundGroup: background.group,
        hasModel
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        selectModel: (model) => dispatch(actions.selectModel('laser', model)),
        unselectAllModels: () => dispatch(actions.unselectAllModels('laser')),
        removeSelectedModel: () => dispatch(actions.removeSelectedModel('laser')),
        onModelTransform: () => dispatch(actions.onModelTransform('laser'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
