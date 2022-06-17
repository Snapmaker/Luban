import PropTypes from 'prop-types';
import { Segmented } from 'antd';
import React from 'react';
import styles from './styles.styl';

const SmallSegment = (props) => {
    const { block = true, options, size = 'small', ...rest } = props;

    return (

        <Segmented
            className={styles[size]}
            block={block}
            options={options}
            {...rest}
        />
    );
};


SmallSegment.propTypes = {
    options: PropTypes.array,
    size: PropTypes.string,
    block: PropTypes.bool
};

export default SmallSegment;
