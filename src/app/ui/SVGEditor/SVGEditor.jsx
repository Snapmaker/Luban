import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';


import { shortcutActions, priorities, ShortcutManager } from '../../lib/shortcut';
import styles from './index.styl';
import { SVG_EVENT_CONTEXTMENU, SVG_EVENT_MODE } from './constants';
import SVGCanvas from './SVGCanvas';
import SvgTool from './SvgTool';

import Cnc3DVisualizer from '../../views/Cnc3DVisualizer';


class SVGEditor extends PureComponent {
    static propTypes = {
        // eslint-disable-next-line react/no-unused-prop-types
        isActive: PropTypes.bool,
        size: PropTypes.object.isRequired,
        materials: PropTypes.object.isRequired,
        SVGActions: PropTypes.object.isRequired,
        scale: PropTypes.number.isRequired,
        target: PropTypes.object,
        use3DVisualizer: PropTypes.bool,

        updateScale: PropTypes.func.isRequired,
        updateTarget: PropTypes.func.isRequired,

        initContentGroup: PropTypes.func.isRequired,
        showContextMenu: PropTypes.func,

        // insertDefaultTextVector: PropTypes.func.isRequired

        // editor actions
        onCreateElement: PropTypes.func.isRequired,
        onSelectElements: PropTypes.func.isRequired,
        onClearSelection: PropTypes.func.isRequired,
        onMoveSelectedElementsByKey: PropTypes.func.isRequired,
        updateTextTransformationAfterEdit: PropTypes.func.isRequired,
        getSelectedElementsUniformScalingState: PropTypes.func.isRequired,

        elementActions: PropTypes.shape({
            moveElementsStart: PropTypes.func.isRequired,
            moveElements: PropTypes.func.isRequired,
            moveElementsFinish: PropTypes.func.isRequired,
            resizeElementsStart: PropTypes.func.isRequired,
            resizeElements: PropTypes.func.isRequired,
            resizeElementsFinish: PropTypes.func.isRequired,
            rotateElementsStart: PropTypes.func.isRequired,
            rotateElements: PropTypes.func.isRequired,
            rotateElementsFinish: PropTypes.func.isRequired,
            moveElementsOnKeyDown: PropTypes.func.isRequired
        }).isRequired,
        editorActions: PropTypes.object.isRequired,

        createText: PropTypes.func.isRequired
    };

    flag = (Math.random() * 100).toFixed();

    canvas = React.createRef();

    state = {
        mode: 'select'
    };

    /**
     * responder.active probably decided by component status,
     * so we use get property to get active status.
     * but get property function is binded to responder,
     * we use closure function or define in constructor to solve this problem.
     *  */
    shortcutResponder = (() => {
        const that = this;
        return {
            title: that.constructor.name,
            get active() {
                return that.props.isActive;
            },
            priority: priorities.VIEW,
            shortcuts: {
                // [shortcutActions.SELECTALL]: this.props.editorActions.selectAll,
                [shortcutActions.UNSELECT]: () => { this.props.onClearSelection(); },
                [shortcutActions.DELETE]: this.props.editorActions.deleteSelectedModel,
                // [shortcutActions.COPY]: this.props.editorActions.copy,
                // [shortcutActions.PASTE]: this.props.editorActions.paste,
                // [shortcutActions.DUPLICATE]: this.props.editorActions.duplicate,
                // optimize: accelerate when continuous click
                'MOVE-UP': {
                    keys: ['alt+up'],
                    callback: () => {
                        this.props.elementActions.moveElementsOnKeyDown({ dx: 0, dy: -1 });
                    }
                },
                'MOVE-DOWM': {
                    keys: ['alt+down'],
                    callback: () => {
                        this.props.elementActions.moveElementsOnKeyDown({ dx: 0, dy: 1 });
                    }
                },
                'MOVE-LEFT': {
                    keys: ['alt+left'],
                    callback: () => {
                        this.props.elementActions.moveElementsOnKeyDown({ dx: -1, dy: 0 });
                    }
                },
                'MOVE-RIGHT': {
                    keys: ['alt+right'],
                    callback: () => {
                        this.props.elementActions.moveElementsOnKeyDown({ dx: 1, dy: 0 });
                    }
                }

            }
        };
    })()

    constructor(props) {
        super(props);

        this.setMode = this.setMode.bind(this);
        ShortcutManager.register(this.shortcutResponder);
    }

    componentDidMount() {
        this.canvas.current.on(SVG_EVENT_MODE, (mode) => {
            this.setState({
                mode: mode
            });
        });

        this.canvas.current.on(SVG_EVENT_CONTEXTMENU, (event) => {
            this.props.showContextMenu(event);
        });

        // Init, Setup SVGContentGroup
        this.props.initContentGroup(this.canvas.current.svgContentGroup);
    }

    setMode(mode, extShape) {
        // this.mode = mode;
        this.canvas.current.setMode(mode, extShape);
    }

    insertDefaultTextVector = async () => {
        const element = await this.props.createText('Snapmaker');
        this.props.onCreateElement(element);

        // todo, select text after create
        // this.canvas.current.selectOnly([elem]);
        this.setMode('select');
    };

    zoomIn() {
        this.canvas.current.zoomIn();
    }

    zoomOut() {
        this.canvas.current.zoomOut();
    }

    autoFocus() {
        this.canvas.current.autoFocus();
    }

    render() {
        return (
            <div className={styles['laser-table']} style={{ position: 'relative' }}>
                <div className={styles['laser-table-row']}>
                    <div className={styles['view-space']}>
                        <SVGCanvas
                            className={styles['svg-content']}
                            SVGActions={this.props.SVGActions}
                            size={this.props.size}
                            materials={this.props.materials}
                            scale={this.props.scale}
                            target={this.props.target}
                            updateScale={this.props.updateScale}
                            updateTarget={this.props.updateTarget}
                            ref={this.canvas}
                            onCreateElement={this.props.onCreateElement}
                            onSelectElements={this.props.onSelectElements}
                            onClearSelection={this.props.onClearSelection}
                            onMoveSelectedElementsByKey={this.props.onMoveSelectedElementsByKey}
                            updateTextTransformationAfterEdit={this.props.updateTextTransformationAfterEdit}
                            getSelectedElementsUniformScalingState={this.props.getSelectedElementsUniformScalingState}
                            elementActions={this.props.elementActions}
                        />
                    </div>
                    <SvgTool
                        mode={this.state.mode}
                        insertDefaultTextVector={this.insertDefaultTextVector}
                        setMode={this.setMode}
                    />

                </div>
                {this.props.use3DVisualizer && (
                    <Cnc3DVisualizer />
                )}
            </div>
        );
    }
}

export default SVGEditor;
