import React, { Component } from 'react';
// import PropTypes from 'prop-types';
import { DATA_PREFIX } from '../../../constants';
import styles from '../styles.styl';


class ExtractPreview extends Component {
    state = {
        src: '/',
        filename: '',
        width: '',
        height: ''
    };

    onChangeImage(filename, width = 140, height = 140) {
        this.setState({
            filename: filename,
            src: `${DATA_PREFIX}/${filename}`,
            width: width,
            height: height
        });
    }


    render() {
        return (
            <div className={styles['laser-extract-previous']}>
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
