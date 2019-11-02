import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DATA_PREFIX } from '../../../constants';
import styles from '../styles.styl';


class ExtractPreview extends Component {
    static propTypes = {
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired
        // size: PropTypes.object.isRequired
    };

    state = {
    };

    node = React.createRef();

    constructor(props) {
        super(props);
        this.renderer = null;
    }

    componentDidMount() {
        this.setupImg();
    }

    onChangeImage(filename, width, height) {
        console.log(filename, width, height);
        const imgPath = `${DATA_PREFIX}/${filename}`;
        this.renderer.src = imgPath;
    }

    setupImg() {
        const { width, height } = this.props;
        this.renderer = new Image();
        this.render.style += 'transform: rotate(90deg)';
        this.renderer.width = width;
        this.renderer.height = height;
        this.node.current.appendChild(this.renderer);
    }

    render() {
        return (
            <div ref={this.node} className={styles['laser-extract-previous']} />
        );
    }
}

export default ExtractPreview;
