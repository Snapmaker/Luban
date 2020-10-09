import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import map from 'lodash/map';

import styles from './index.styl';
import SVGCanvas from './SVGCanvas';
import SvgTool from './SvgTool';
import { SVG_EVENT_CONTEXTMENU, SVG_EVENT_MODE, SVG_EVENT_SELECT } from '../../constants/svg-constants';


// import { createSVGElement } from './element-utils';

class SVGEditor extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        SVGActions: PropTypes.object.isRequired,

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

        createText: PropTypes.func.isRequired
    };

    canvas = React.createRef();

    state = {
        mode: 'select'
    };

    colors = [
        'none',
        '#000000', '#3f3f3f', '#bfbfbf', '#ffffff',
        '#aa00ff', '#6a00ff', '#0050ef', '#1ba1e2',
        '#00aba9', '#a4c400', '#60a917', '#008a00',
        '#fa6800', '#f0a30a', '#e3c800', '#f472d0',
        '#d80073', '#e51400', '#a20025', '#825a2c'
    ];

    palette = null;

    constructor(props) {
        super(props);

        this.setMode = this.setMode.bind(this);
        this.palette = map(this.colors, (color) => (
            <button
                className={styles['palette-item']}
                type="button"
                key={color}
                style={{ border: 'none', backgroundColor: `${color}` }}
                onClick={(event) => {
                    if (event.ctrlKey) {
                        // ctrl + leftClick: change stroke color
                        this.canvas.current.setSelectedAttribute('stroke', color);
                    } else {
                        // leftClick: change fill color
                        this.canvas.current.setSelectedAttribute('fill', color);
                    }
                }}
            />
        ));
    }

    componentDidMount() {
        this.canvas.current.on(SVG_EVENT_SELECT, (selectedElements) => {
            const elem = selectedElements.length === 1 ? selectedElements[0] : null;
            this.props.SVGActions.emit(SVG_EVENT_SELECT, elem);
        });

        // this.canvas.current.on(SVG_EVENT_ADD, (elem) => {
        //     console.log('aa', elem);
        //     // this.props.svgModelGroup.emit(SVG_EVENT_ADD, elem);
        // });

        // this.canvas.current.on(SVG_EVENT_MOVE, (elem) => {
        //     console.log(elem);
        //     this.props.svgModelGroup.emit(SVG_EVENT_MOVE, elem);
        // });

        this.canvas.current.on(SVG_EVENT_MODE, (mode) => {
            this.setState({
                mode: mode
            });
        });

        this.canvas.current.on(SVG_EVENT_CONTEXTMENU, (event) => {
            this.props.showContextMenu(event);
        });

        this.props.SVGActions.init(this.canvas.current.svgContentGroup, this.props.size);

        this.props.initContentGroup(this.canvas.current.svgContentGroup);
    }

    componentWillReceiveProps(nextProps) {
        // if (nextProps.importTime !== this.props.importTime) {
        //     this.canvas.current.loadSVGString(nextProps.import.content);
        // }
        if (nextProps.size !== this.props.size) {
            console.log('receive size', nextProps.size, this.props.size);
            this.props.SVGActions.updateSize(nextProps.size);
        }
    }

    setMode(mode, extShape) {
        // this.mode = mode;
        this.canvas.current.setMode(mode, extShape);
    }

    insertDefaultTextVector = () => {
        const element = this.props.createText('Snapmaker');
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
                            ref={this.canvas}
                            onCreateElement={this.props.onCreateElement}
                            onSelectElements={this.props.onSelectElements}
                            onClearSelection={this.props.onClearSelection}
                            onResizeElement={this.props.onResizeElement}
                            onAfterResizeElement={this.props.onAfterResizeElement}
                            onMoveElement={this.props.onMoveElement}
                            onRotateElement={this.props.onRotateElement}
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
