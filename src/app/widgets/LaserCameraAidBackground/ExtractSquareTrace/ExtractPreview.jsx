import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DATA_PREFIX } from '../../../constants';
import styles from '../styles.styl';


class ExtractPreview extends Component {
    static propTypes = {
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired,
        src: PropTypes.string.isRequired
    };

    state = {
        src: this.props.src,
        filename: ''
    };

    onChangeImage(filename) {
        this.setState({
            filename: filename,
            src: `${DATA_PREFIX}/${filename}`
        });
    }


    render() {
        return (
            <div className={styles['laser-extract-previous']}>
                <img
                    alt={this.state.filename}
                    src={this.state.src}
                    width={this.props.width}
                    height={this.props.height}
                />
            </div>
        );
    }
}

export default ExtractPreview;
