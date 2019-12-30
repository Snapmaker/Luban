import React, { Component } from 'react';
// import PropTypes from 'prop-types';
import PropTypes from 'prop-types';
import { DATA_PREFIX, MACHINE_SERIES } from '../../../constants';
import styles from '../styles.styl';

class ExtractPreview extends Component {
    static propTypes = {
        size: PropTypes.object.isRequired,
        series: PropTypes.string.isRequired
    };

    state = {
        src: '/',
        filename: '',
        width: '',
        height: ''
    };

    top;

    left;

    isAbsolute;

    onChangeImage(filename, width = 100, height = 100, index) {
        if (this.props.series === MACHINE_SERIES.A150.value) {
            this.calcuStyle(index, width, height, 2);
        } else {
            this.calcuStyle(index, width, height, 3);
        }

        this.setState({
            filename: filename,
            width: width,
            height: height,
            src: `${DATA_PREFIX}/${filename}`
        });
    }

    calcuStyle(index, width, height, divideNumber) {
        if (parseInt(index / divideNumber, 10) === 1) {
            this.isAbsolute = true;
            if (index % divideNumber === 0) {
                this.top = divideNumber === 3 ? (this.props.size.y * 2 - height) / 2 : (this.props.size.y * 2 - height);
                this.left = 0;
            } else if (index % divideNumber === 2) {
                this.top = (this.props.size.y * 2 - height) / 2;
                this.left = (this.props.size.x * 2 - width);
            } else if (index % divideNumber === 1) {
                this.top = divideNumber === 3 ? (this.props.size.y * 2 - height) / 2 : (this.props.size.y * 2 - height);
                this.left = divideNumber === 3 ? (this.props.size.x * 2 - width) / 2 : (this.props.size.x * 2 - width);
            }
        } else if (parseInt(index / divideNumber, 10) === 2) {
            this.isAbsolute = true;
            if (index % divideNumber === 0) {
                this.top = (this.props.size.y * 2 - height);
                this.left = 0;
            } else if (index % divideNumber === 1) {
                this.top = (this.props.size.y * 2 - height);
                this.left = (this.props.size.x * 2 - width) / 2;
            } else if (index % divideNumber === 2) {
                this.top = (this.props.size.y * 2 - height);
                this.left = (this.props.size.x * 2 - width);
            }
        }
    }

    render() {
        return (
            <div
                className={styles['laser-extract-previous']}
                style={{
                    top: this.top,
                    left: this.left,
                    width: this.state.width,
                    height: this.state.height,
                    position: this.isAbsolute ? 'absolute' : 'none',
                    backgroundImage: this.state.bgImage
                }}
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
