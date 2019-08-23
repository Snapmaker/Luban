import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import _ from 'lodash';

import { NumberInput } from '../../components/Input';
import { actions as sharedActions } from '../../flux/cncLaserShared';
import styles from './index.styl';
import SVGCanvas from './SVGCanvas';


class SVGEditor extends PureComponent {
    static propTypes = {
        uploadImage: PropTypes.func.isRequired
    };

    canvas = React.createRef();

    state = {
        showInfoXY: false,
        showInfoRect: false,
        showInfoCircle: false,
        showInfoEllipse: false,
        // showInfoLine: false

        x: 0,
        y: 0,
        width: 0,
        height: 0,
        cx: 0,
        cy: 0,
        r: 0,
        rx: 0,
        ry: 0,

        paletteColor: null
    };

    colors = [
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
        this.palette = _.map(this.colors, (color) => (
            <button
                className={styles['palette-item']}
                type="button"
                key={color}
                style={{ border: 'none', backgroundColor: `${color}` }}
                onClick={() => {
                    this.setSelectedColor(color);
                }}
            />
        ));
    }

    componentDidMount() {
        this.canvas.current.on('selected', (selectedElements) => {
            const elem = selectedElements.length === 1 ? selectedElements[0] : null;

            console.log('selected elements', selectedElements, elem);

            // angle
            // blur
            // show selected panel

            // show
            // xy_panel, selected_x, selected_y
            this.setState({
                showInfoXY: false,
                showInfoRect: false,
                showInfoCircle: false,
                showInfoEllipse: false
            });

            // x & y
            if (['line', 'circle', 'ellipse'].includes(elem.tagName)) {
                // hide
                // this.setState({ showInfoXY: false });
            } else {
                this.setState({
                    showInfoXY: true,
                    x: elem.getAttribute('x'),
                    y: elem.getAttribute('y')
                });
            }

            switch (elem.tagName) {
                case 'rect':
                    this.setState({
                        showInfoRect: true,
                        width: elem.getAttribute('width'),
                        height: elem.getAttribute('height')
                        // rx?
                    });
                    break;
                case 'circle': {
                    this.setState({
                        showInfoCircle: true,
                        cx: elem.getAttribute('cx'),
                        cy: elem.getAttribute('cy'),
                        r: elem.getAttribute('r')
                    });
                    break;
                }
                case 'ellipse': {
                    this.setState({
                        showInfoEllipse: true,
                        cx: elem.getAttribute('cx'),
                        cy: elem.getAttribute('cy'),
                        rx: elem.getAttribute('rx'),
                        ry: elem.getAttribute('ry')
                    });
                    break;
                }
                default:
                    break;
            }
        });
    }

    setMode(mode) {
        // this.mode = mode;
        this.canvas.current.setMode(mode);
    }

    setSelectedColor(color) {
        this.setState({
            paletteColor: color
        });
    }

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
        const { showInfoXY, showInfoRect, showInfoCircle, showInfoEllipse } = this.state;

        return (
            <div className={styles['laser-table']}>
                <div className={styles['laser-table-row']}>
                    <div className={styles['view-space']}>
                        <SVGCanvas
                            className={styles['svg-content']}
                            ref={this.canvas}
                            paletteColor={this.state.paletteColor}
                        />
                    </div>
                    <form className={styles['control-bar']} noValidate>
                        <div className={styles['svg-control-bar']}>
                            <p>Tool bar</p>
                            <button type="button" onClick={() => this.setMode('select')}>Select</button>
                            <button type="button" onClick={() => this.setMode('line')}>Line</button>
                            <button type="button" onClick={() => this.setMode('rect')}>Rect</button>
                            <button type="button" onClick={() => this.setMode('circle')}>Circle</button>
                            <button type="button" onClick={() => this.setMode('ellipse')}>Ellipse</button>
                            <button type="button" onClick={() => this.setMode('fhpath')}>Pencil</button>
                        </div>
                        <div className={styles['svg-control-bar']}>
                            <p>Export</p>
                            <button type="button" onClick={this.export}>Export</button>
                        </div>

                        <div style={{ marginTop: '15px' }}>
                            <p>Info</p>
                        </div>
                        {showInfoXY && (
                            <React.Fragment>
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">X</span>
                                    <NumberInput
                                        disabled
                                        className="sm-parameter-row__input"
                                        value={this.state.x}
                                    />
                                </div>
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">Y</span>
                                    <NumberInput
                                        disabled
                                        className="sm-parameter-row__input"
                                        value={this.state.y}
                                    />
                                </div>
                            </React.Fragment>
                        )}
                        {showInfoRect && (
                            <React.Fragment>
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">Width</span>
                                    <NumberInput
                                        disabled
                                        className="sm-parameter-row__input"
                                        value={this.state.width}
                                    />
                                </div>
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">Height</span>
                                    <NumberInput
                                        disabled
                                        className="sm-parameter-row__input"
                                        value={this.state.height}
                                    />
                                </div>
                            </React.Fragment>
                        )}
                        {showInfoCircle && (
                            <React.Fragment>
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">X</span>
                                    <NumberInput
                                        disabled
                                        className="sm-parameter-row__input"
                                        value={this.state.cx}
                                    />
                                </div>
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">Y</span>
                                    <NumberInput
                                        disabled
                                        className="sm-parameter-row__input"
                                        value={this.state.cy}
                                    />
                                </div>
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">Radius</span>
                                    <NumberInput
                                        disabled
                                        className="sm-parameter-row__input"
                                        value={this.state.r}
                                    />
                                </div>
                            </React.Fragment>
                        )}

                        {showInfoEllipse && (
                            <React.Fragment>
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">X</span>
                                    <NumberInput
                                        disabled
                                        className="sm-parameter-row__input"
                                        value={this.state.cx}
                                    />
                                </div>
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">Y</span>
                                    <NumberInput
                                        disabled
                                        className="sm-parameter-row__input"
                                        value={this.state.cy}
                                    />
                                </div>
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">Radius X</span>
                                    <NumberInput
                                        disabled
                                        className="sm-parameter-row__input"
                                        value={this.state.rx}
                                    />
                                </div>
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">Radius Y</span>
                                    <NumberInput
                                        disabled
                                        className="sm-parameter-row__input"
                                        value={this.state.ry}
                                    />
                                </div>
                            </React.Fragment>
                        )}
                        <div className={styles['palette-item']}>
                            {this.palette}
                        </div>
                    </form>
                </div>
            </div>
        );
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, mode, onFailure) => dispatch(sharedActions.uploadImage('laser', file, mode, onFailure))
    };
};

export default connect(null, mapDispatchToProps)(SVGEditor);
