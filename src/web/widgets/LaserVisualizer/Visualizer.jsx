import React, { Component } from 'react';
import colornames from 'colornames';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Canvas, PrintablePlate } from '../Canvas';
import PrimaryToolbar from '../CanvasToolbar/PrimaryToolbar';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import styles from '../styles.styl';
import TargetPoint from '../../components/three-extensions/TargetPoint';
import { actions } from '../../reducers/modules/laser';

class Visualizer extends Component {
    static propTypes = {
        source: PropTypes.object.isRequired,
        target: PropTypes.object.isRequired,
        stock: PropTypes.object.isRequired,

        // redux actions
        setStock: PropTypes.func.isRequired,
    };

    printableArea = new PrintablePlate();
    modelGroup = new THREE.Group();
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
        }
    };

    componentDidMount() {
        this.canvas.resizeWindow();
        this.canvas.disabled3D();

        window.addEventListener(
            'hashchange',
            (event) => {
                if (event.newURL.endsWith('laser')) {
                    this.canvas.resizeWindow();
                }
            },
            false
        );
    }

    componentWillReceiveProps(nextProps) {
        const { processed, width, height, anchor, anchorPoint } = { ...nextProps.source, ...nextProps.target };
        // FIXME: callback twice
        // if any changed, update modelGroup
        // not support multi-models
        this.modelGroup.remove(...this.modelGroup.children);
        const geometry = new THREE.PlaneGeometry(width, height);
        const texture = new THREE.TextureLoader().load(processed);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            opacity: 0.75,
            transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        let x = anchorPoint.x;
        let y = anchorPoint.y;

        switch (anchor) {
            case 'Center':
            case 'Center Left':
            case 'Center Right':
                break;
            case 'Bottom Left':
                x += width / 2;
                y += height / 2;
                break;
            case 'Bottom Middle':
                y += 0;
                break;
            case 'Bottom Right':
                x += -width / 2;
                y += height / 2;
                break;
            case 'Top Left':
                x += width / 2;
                y += -height / 2;
                break;
            case 'Top Middle':
                y += -height / 2;
                break;
            case 'Top Right':
                x += -width / 2;
                y += -height / 2;
                break;
            default:
                break;
        }

        let position = new THREE.Vector3(x, y, -0.05);
        mesh.position.copy(position);

        const stock = nextProps.stock;
        if (stock.status === 'tuning') {
            let p0 = new TargetPoint({
                color: colornames('blue'),
                radius: 0.5
            });
            p0.name = 'Left Bottom';
            p0.visible = true;

            let p1 = new TargetPoint({
                color: colornames('blue'),
                radius: 0.5
            });
            p1.name = 'Right Bottom';
            p1.visible = true;

            let p2 = new TargetPoint({
                color: colornames('blue'),
                radius: 0.5
            });
            p2.name = 'Right Top';
            p2.visible = true;

            let p3 = new TargetPoint({
                color: colornames('blue'),
                radius: 0.5
            });
            p3.name = 'Left Top';
            p3.visible = true;


            p0.position.x = stock.p0.x;
            p0.position.y = stock.p0.y;
            p1.position.x = stock.p1.x;
            p1.position.y = stock.p1.y;
            p2.position.x = stock.p2.x;
            p2.position.y = stock.p2.y;
            p3.position.x = stock.p3.x;
            p3.position.y = stock.p3.y;

            this.modelGroup.add(p0);
            this.modelGroup.add(p1);
            this.modelGroup.add(p2);
            this.modelGroup.add(p3);
        }


        console.log(JSON.stringify(stock));

        if (stock.status !== 'disabled') {
            let stockWidth = stock.width * stock.mm2pixelRatio;
            let stockHeight = stock.height * stock.mm2pixelRatio;
            if (stock.status === 'enabled') {
                stockWidth = stock.targetWidth;
                stockHeight = stock.targetHeight;
            }
            // this.props.setStock({ mm2pixelRatio: stockWidth / stock.width });
            const geometry2 = new THREE.PlaneGeometry(stockWidth, stockHeight);
            const texture2 = new THREE.TextureLoader().load(stock.processed);
            const material2 = new THREE.MeshBasicMaterial({
                map: texture2,
                side: THREE.DoubleSide,
                opacity: 0.75,
                transparent: true
            });
            const mesh2 = new THREE.Mesh(geometry2, material2);
            mesh2.position.x = stockWidth / 2;
            mesh2.position.y = stockHeight / 2;
            mesh2.position.z = -0.1;

            this.modelGroup.add(mesh2);
        }
        this.modelGroup.add(mesh);
    }

    render() {
        return (
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
                <div className={styles['canvas-header']}>
                    <PrimaryToolbar actions={this.actions} state={this.state} />
                </div>
                <div className={styles['canvas-content']}>
                    <Canvas
                        ref={node => {
                            this.canvas = node;
                        }}
                        modelGroup={this.modelGroup}
                        printableArea={this.printableArea}
                        enabledTransformModel={false}
                        cameraZ={70}
                    />
                </div>
                <div className={styles['canvas-footer']}>
                    <SecondaryToolbar actions={this.actions} />
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        source: state.laser.source,
        target: state.laser.target,
        stock: state.laser.stock,
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setStock: (params) => dispatch(actions.stockSetState(params)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
