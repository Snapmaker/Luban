import React, { Component } from 'react';
import PropTypes from 'prop-types';

class Image extends Component {
    static propTypes = {
        src: PropTypes.string
    };
    static defaultProps = {
        src: ''
    };

    render() {
        const { src, ...props } = this.props;

        return (
            <img
                {...props}
                role="presentation"
                alt="presentation"
                src={src}
            />
        );
    }
}

export default Image;
