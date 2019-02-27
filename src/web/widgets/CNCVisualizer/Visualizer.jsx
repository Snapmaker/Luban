import isEqual from 'lodash/isEqual';
import React, { Component } from 'react';
import * as THREE from 'three';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { Canvas, PrintablePlate } from '../Canvas';
import PrimaryToolbar from '../CanvasToolbar/PrimaryToolbar';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import styles from './styles.styl';
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
        modelGroup: PropTypes.object.isRequired,
        selectModel: PropTypes.func.isRequired,
        unselectAllModels: PropTypes.func.isRequired,
        removeSelectedModel: PropTypes.func.isRequired,
        onModelTransform: PropTypes.func.isRequired
    };

    contextMenuDomElement = null;
    visualizerDomElement = null;

    printableArea = null;
    canvas = null;

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
            this.canvas.zoomIn();
        },
        zoomOut: () => {
            this.canvas.zoomOut();
        },
        autoFocus: () => {
            this.canvas.autoFocus();
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
            this.props.modelGroup.bringSelectedModelToFront();
        },
        sendToBack: () => {
            this.props.modelGroup.sendSelectedModelToBack();
        },
        deleteSelectedModel: () => {
            this.props.removeSelectedModel();
        },
        arrangeAllModels: () => {
        }
    };

    constructor(props) {
        super(props);

        const size = props.size;
        this.printableArea = new PrintablePlate(size);
    }

    keyEventHandlers = {
        'DELETE': (event) => {
            this.props.removeSelectedModel();
        }
    };

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

        this.addEventHandlers();

        this.canvas.resizeWindow();
        this.canvas.disable3D();

        window.addEventListener(
            'hashchange',
            (event) => {
                if (event.newURL.endsWith('cnc')) {
                    this.canvas.resizeWindow();
                }
            },
            false
        );
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

        // TODO: find better way
        this.canvas.updateTransformControl2D();
        const { model } = nextProps;
        if (!model) {
            this.canvas.detachSelectedModel();
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
                        ref={node => {
                            this.canvas = node;
                        }}
                        size={this.props.size}
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
                    id="cnc"
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
    // call canvas.updateTransformControl2D() when transformation changed or model selected changed
    const { modelGroup, transformation, model, hasModel } = state.cnc;
    return {
        size: machine.size,
        model,
        modelGroup,
        transformation,
        hasModel
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        selectModel: (model) => dispatch(actions.selectModel('cnc', model)),
        unselectAllModels: () => dispatch(actions.unselectAllModels('cnc')),
        removeSelectedModel: () => dispatch(actions.removeSelectedModel('cnc')),
        onModelTransform: () => dispatch(actions.onModelTransform('cnc'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
