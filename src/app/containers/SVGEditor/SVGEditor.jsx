import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { actions as sharedActions } from '../../flux/cncLaserShared';
import styles from './index.styl';
import SVGCanvas from './SVGCanvas';


class SVGEditor extends PureComponent {
    static propTypes = {
        uploadImage: PropTypes.func.isRequired
    };

    canvas = React.createRef();

    constructor(props) {
        super(props);

        this.setMode = this.setMode.bind(this);
        this.export = this.export.bind(this);
    }

    setMode(mode) {
        // this.mode = mode;
        this.canvas.current.setMode(mode);
    }

    export() {
        // L3596
        const content = this.canvas.current.getSVGContent();
        const output = this.svgToString(content, 0);

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
                        <SVGCanvas className={styles['svg-content']} ref={this.canvas} />
                    </div>
                    <form className={styles['control-bar']} noValidate>
                        <div className={styles['svg-control-bar']}>
                            <div className={styles['svg-tool-bar']}>
                                <button type="button" onClick={() => this.setMode('select')}>Select</button>
                                <button type="button" onClick={() => this.setMode('circle')}>Circle</button>
                                <button type="button" onClick={this.export}>Export</button>
                            </div>
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
