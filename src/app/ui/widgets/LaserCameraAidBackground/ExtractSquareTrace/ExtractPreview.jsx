import React from 'react';
import PropTypes from 'prop-types';

import { DATA_PREFIX } from '../../../../constants';
import {
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
} from '../../../../constants/machines';
import { SnapmakerA150Machine } from '../../../../machines';
import styles from '../styles.styl';

class ExtractPreview extends React.Component {
    static propTypes = {
        size: PropTypes.object.isRequired,
        series: PropTypes.string.isRequired,
        toolHead: PropTypes.object.isRequired
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

    onChangeImage(filename, width = 100, height = 100, index, multiple) {
        if (this.props.toolHead.laserToolhead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
            this.calcuStyle(index, width, height, 1, multiple);
        }
        if (this.props.toolHead.laserToolhead === LEVEL_ONE_POWER_LASER_FOR_SM2) {
            if (this.props.series === SnapmakerA150Machine.identifier) {
                this.calcuStyle(index, width, height, 2, multiple);
            } else {
                this.calcuStyle(index, width, height, 3, multiple);
            }
        }

        this.setState({
            filename: filename,
            width: width,
            height: height,
            src: `${DATA_PREFIX}/${filename}`
        });
    }

    calcuStyle(index, width, height, divideNumber, multiple) {
        if (divideNumber === 1) {
            this.isAbsolute = true;
            this.top = 0;
            this.left = 0;
            return;
        }
        if (parseInt(index / divideNumber, 10) === 1) {
            this.isAbsolute = true;
            if (index % divideNumber === 0) {
                this.top = divideNumber === 3 ? (this.props.size.y * 0.85 * multiple - height) / 2 : (this.props.size.y * 0.85 * multiple - height);
                this.left = 0;
            } else if (index % divideNumber === 2) {
                this.top = (this.props.size.y * 0.85 * multiple - height) / 2;
                this.left = (this.props.size.x * 0.85 * multiple - width);
            } else if (index % divideNumber === 1) {
                this.top = divideNumber === 3 ? (this.props.size.y * 0.85 * multiple - height) / 2 : (this.props.size.y * 0.85 * multiple - height);
                this.left = divideNumber === 3 ? (this.props.size.x * 0.85 * multiple - width) / 2 : (this.props.size.x * 0.85 * multiple - width);
            }
        } else if (parseInt(index / divideNumber, 10) === 2) {
            this.isAbsolute = true;
            if (index % divideNumber === 0) {
                this.top = (this.props.size.y * 0.85 * multiple - height);
                this.left = 0;
            } else if (index % divideNumber === 1) {
                this.top = (this.props.size.y * 0.85 * multiple - height);
                this.left = (this.props.size.x * 0.85 * multiple - width) / 2;
            } else if (index % divideNumber === 2) {
                this.top = (this.props.size.y * 0.85 * multiple - height);
                this.left = (this.props.size.x * 0.85 * multiple - width);
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
