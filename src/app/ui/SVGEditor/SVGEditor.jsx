import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import styles from './index.styl';
import { SVG_EVENT_CONTEXTMENU, SVG_EVENT_MODE } from './constants';
import SVGCanvas from './SVGCanvas';
import SvgTool from './SvgTool';

import Cnc3DVisualizer from '../../views/Cnc3DVisualizer';
import { PAGE_EDITOR } from '../../constants';


class SVGEditor extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        materials: PropTypes.object.isRequired,
        SVGActions: PropTypes.object.isRequired,
        scale: PropTypes.number.isRequired,
        target: PropTypes.object,
        coordinateMode: PropTypes.object.isRequired,
        coordinateSize: PropTypes.object.isRequired,
        use3DVisualizer: PropTypes.bool,
        page: PropTypes.string, // add cnc, add isRequired

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
            rotateElementsFinish: PropTypes.func.isRequired
        }).isRequired,

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
            <div className={styles['laser-table']} style={{ position: 'relative' }}>
                <div className={styles['laser-table-row']}>
                    <div className={styles['view-space']}>
                        <SVGCanvas
                            className={styles['svg-content']}
                            page={this.props.page}
                            SVGActions={this.props.SVGActions}
                            size={this.props.size}
                            materials={this.props.materials}
                            scale={this.props.scale}
                            target={this.props.target}
                            updateScale={this.props.updateScale}
                            updateTarget={this.props.updateTarget}
                            coordinateMode={this.props.coordinateMode}
                            coordinateSize={this.props.coordinateSize}
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
                    {(this.props.page === PAGE_EDITOR) && (
                        <SvgTool
                            mode={this.state.mode}
                            insertDefaultTextVector={this.insertDefaultTextVector}
                            setMode={this.setMode}
                        />
                    )}

                </div>
                {this.props.use3DVisualizer && (
                    <Cnc3DVisualizer />
                )}
            </div>
        );
    }
}

export default SVGEditor;
