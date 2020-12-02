import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import styles from './index.styl';
import { SVG_EVENT_CONTEXTMENU, SVG_EVENT_MODE } from './constants';
import SVGCanvas from './SVGCanvas';
import SvgTool from './SvgTool';


class SVGEditor extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        materials: PropTypes.object.isRequired,
        SVGActions: PropTypes.object.isRequired,
        scale: PropTypes.number.isRequired,
        target: PropTypes.object,

        updateScale: PropTypes.func.isRequired,
        updateTarget: PropTypes.func.isRequired,

        initContentGroup: PropTypes.func.isRequired,
        showContextMenu: PropTypes.func,
        // insertDefaultTextVector: PropTypes.func.isRequired

        // editor actions
        onCreateElement: PropTypes.func.isRequired,
        onSelectElements: PropTypes.func.isRequired,
        onClearSelection: PropTypes.func.isRequired,
        onResizeElement: PropTypes.func.isRequired,
        onAfterResizeElement: PropTypes.func.isRequired,
        onMoveElement: PropTypes.func.isRequired,
        onRotateElement: PropTypes.func.isRequired,
        updateTextTransformationAfterEdit: PropTypes.func.isRequired,

        createText: PropTypes.func.isRequired
    };

    canvas = React.createRef();

    state = {
        mode: 'select'
    };

    constructor(props) {
        super(props);

        this.setMode = this.setMode.bind(this);
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
            <div className={styles['laser-table']}>
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
                            onResizeElement={this.props.onResizeElement}
                            onAfterResizeElement={this.props.onAfterResizeElement}
                            onMoveElement={this.props.onMoveElement}
                            onRotateElement={this.props.onRotateElement}
                            updateTextTransformationAfterEdit={this.props.updateTextTransformationAfterEdit}
                        />
                    </div>
                    <SvgTool
                        mode={this.state.mode}
                        insertDefaultTextVector={this.insertDefaultTextVector}
                        setMode={this.setMode}
                    />
                </div>
            </div>
        );
    }
}

export default SVGEditor;
