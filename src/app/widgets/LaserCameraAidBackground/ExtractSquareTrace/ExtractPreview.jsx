import React, { Component } from 'react';
// import PropTypes from 'prop-types';
import PropTypes from 'prop-types';
import { DATA_PREFIX, MACHINE_SERIES } from '../../../constants';
import styles from '../styles.styl';

class ExtractPreview extends Component {
    state = {
        src: '/',
        filename: '',
        width: '',
        height: ''
    };

    static propTypes = {
        size: PropTypes.object.isRequired,
        series: PropTypes.string.isRequired
    };

    top;

    left;

    isAbsolute;


    onChangeImage(filename, width, height, index) {
        if (this.props.series === MACHINE_SERIES.A150.value) {
            this.calcuStyle(index, width, height, 2);
        } else {
            this.calcuStyle(index, width, height, 3);
        }
        this.setState({
            filename: filename,
            src: `${DATA_PREFIX}/${filename}`,
            width: width,
            height: height
        });
    }

    calcuStyle(index, width, height, divideNumber) {
        if (parseInt(index / divideNumber, 10) === 1) {
            this.isAbsolute = true;
            if (index % divideNumber === 0) {
                this.top = divideNumber === 3 ? (this.props.size.y - height) / 2 : (this.props.size.y - height);
                this.left = 0;
            } else if (index % divideNumber === 2) {
                this.top = (this.props.size.y - height) / 2;
                this.left = (this.props.size.x - width);
            } else if (index % divideNumber === 1) {
                this.top = divideNumber === 3 ? (this.props.size.y - height) / 2 : (this.props.size.y - height);
                this.left = divideNumber === 3 ? (this.props.size.x - width) / 2 : (this.props.size.x - width);
            }
        } else if (parseInt(index / divideNumber, 10) === 2) {
            this.isAbsolute = true;
            if (index % divideNumber === 0) {
                this.top = (this.props.size.y - height);
                this.left = 0;
            } else if (index % divideNumber === 1) {
                this.top = (this.props.size.y - height);
                this.left = (this.props.size.x - width) / 2;
            } else if (index % divideNumber === 2) {
                this.top = (this.props.size.y - height);
                this.left = (this.props.size.x - width);
            }
        }
    }

    render() {
        return (
            <div
                className={styles['laser-extract-previous']}
                style={{ top: this.top, left: this.left, position: this.isAbsolute ? 'absolute' : 'none' }}
            >
                <img
                    alt={this.state.filename}
                    src={this.state.src}
                    width={this.state.width}
                    height={this.state.height}
                />
            </div>
        );
    }
}


export default ExtractPreview;
