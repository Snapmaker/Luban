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
        svgModelGroup: PropTypes.object,
        showContextMenu: PropTypes.func

        // insertDefaultTextVector: PropTypes.func.isRequired
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
            this.props.svgModelGroup.emit(SVG_EVENT_SELECT, elem);
        });

        // this.canvas.current.on(SVG_EVENT_ADD, (elem) => {
        //     console.log('aa', elem);
        //     // this.props.svgModelGroup.emit(SVG_EVENT_ADD, elem);
        //     this.props.svgModelGroup.addModel('laser', elem);
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

        this.props.svgModelGroup.init(this.canvas.current.svgContentGroup, this.props.size);
    }

    componentWillReceiveProps(nextProps) {
        // if (nextProps.importTime !== this.props.importTime) {
        //     this.canvas.current.loadSVGString(nextProps.import.content);
        // }
        if (nextProps.size !== this.props.size) {
            this.props.svgModelGroup.updateSize(nextProps.size);
        }
    }


    setMode(mode, extShape) {
        // this.mode = mode;
        this.canvas.current.setMode(mode, extShape);
    }

    insertDefaultTextVector = () => {
        const elem = this.props.svgModelGroup.svgContentGroup.addSVGElement({
            element: 'text',
            attr: {
                x: 200,
                y: 250,
                fill: '#000000',
                'font-size': 12,
                'font-family': 'Arial',
                'stroke-width': 0.25,
                opacity: 1,
                textContent: 'Snapmaker'
            }
        });
        this.props.svgModelGroup.addModel(elem);
        this.canvas.current.selectOnly([elem]);
        this.setMode('select');
    }

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
                            svgModelGroup={this.props.svgModelGroup}
                            size={this.props.size}
                            ref={this.canvas}
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
