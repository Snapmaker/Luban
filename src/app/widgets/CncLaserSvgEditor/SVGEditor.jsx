import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import map from 'lodash/map';

import styles from './index.styl';
import SVGCanvas from './SVGCanvas';
import SvgTool from './SvgTool';
import { SVG_EVENT_ADD, SVG_EVENT_CONTEXTMENU, SVG_EVENT_MODE, SVG_EVENT_MOVE, SVG_EVENT_SELECT } from '../../constants/svg-constatns';
import { actions as editorActions } from '../../flux/editor';


class SVGEditor extends PureComponent {
    static propTypes = {
        svgModelGroup: PropTypes.object,
        size: PropTypes.object.isRequired,
        showContextMenu: PropTypes.func,
        uploadImage: PropTypes.func.isRequired,
        importTime: PropTypes.number.isRequired,
        import: PropTypes.object.isRequired,

        insertDefaultTextVector: PropTypes.func.isRequired
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
        this.export = this.export.bind(this);
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

        this.canvas.current.on(SVG_EVENT_ADD, (elem) => {
            this.props.svgModelGroup.emit(SVG_EVENT_ADD, elem);
        });

        this.canvas.current.on(SVG_EVENT_MOVE, (elem) => {
            this.props.svgModelGroup.emit(SVG_EVENT_MOVE, elem);
        });

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
        if (nextProps.importTime !== this.props.importTime) {
            this.canvas.current.loadSVGString(nextProps.import.content);
        }
        if (nextProps.size !== this.props.size) {
            this.props.svgModelGroup.size = nextProps.size;
        }
    }

    setMode(mode, extShape) {
        // this.mode = mode;
        this.canvas.current.setMode(mode, extShape);
    }

    // updateSelectedInfo(elem) {
    //     // xy_panel, selected_x, selected_y
    //     this.setState({
    //         showInfoXY: false,
    //         showInfoRect: false,
    //         showInfoCircle: false,
    //         showInfoEllipse: false
    //     });
    //
    //     // x & y
    //     if (['line', 'circle', 'ellipse'].includes(elem.tagName)) {
    //         // hide
    //         // this.setState({ showInfoXY: false });
    //     } else {
    //         this.setState({
    //             showInfoXY: true,
    //             x: Number(elem.getAttribute('x')),
    //             y: Number(elem.getAttribute('y'))
    //         });
    //     }
    //
    //     switch (elem.tagName) {
    //         case 'rect':
    //             this.setState({
    //                 showInfoRect: true,
    //                 width: Number(elem.getAttribute('width')),
    //                 height: Number(elem.getAttribute('height'))
    //                 // rx?
    //             });
    //             break;
    //         case 'circle': {
    //             this.setState({
    //                 showInfoCircle: true,
    //                 cx: Number(elem.getAttribute('cx')),
    //                 cy: Number(elem.getAttribute('cy')),
    //                 r: Number(elem.getAttribute('r'))
    //             });
    //             break;
    //         }
    //         case 'ellipse': {
    //             this.setState({
    //                 showInfoEllipse: true,
    //                 cx: Number(elem.getAttribute('cx')),
    //                 cy: Number(elem.getAttribute('cy')),
    //                 rx: Number(elem.getAttribute('rx')),
    //                 ry: Number(elem.getAttribute('ry'))
    //             });
    //             break;
    //         }
    //         default:
    //             break;
    //     }
    // }

    export() {
        // L3596
        const output = this.canvas.current.svgToString();

        const blob = new Blob([output], { type: 'image/svg+xml' });
        const file = new File([blob], 'drawing.svg');
        this.props.uploadImage(file, 'vector', () => {
            // onError
        });

        document.location.href = '/#/laser';
        window.scrollTo(0, 0);
    }

    render() {
        return (
            <div className={styles['laser-table']}>
                <div className={styles['laser-table-row']}>
                    <div className={styles['view-space']}>
                        <SVGCanvas
                            className={styles['svg-content']}
                            size={this.props.size}
                            ref={this.canvas}
                        />
                    </div>
                    <SvgTool
                        mode={this.state.mode}
                        insertDefaultTextVector={this.props.insertDefaultTextVector}
                        setMode={this.setMode}
                    />
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const svgState = state.svgeditor;
    return {
        importTime: svgState.import.time,
        import: svgState.import,
        size: state.machine.size
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, mode, onFailure) => dispatch(editorActions.uploadImage('laser', file, mode, onFailure))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SVGEditor);
