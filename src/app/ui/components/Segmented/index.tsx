import React from 'react';
import PropTypes from 'prop-types';
/* why use customized ‘Segmented’
See the antd's source code, it will tigger 'setRawValue' in
inside function 'handleChange', which will not tigger by 'value' changed
*/
import Segmented from './Segmented';
// import { Segmented } from 'antd';
import styles from './styles.styl';

const SmallSegment = ({ block = true, size = 'small', ...rest }) => {
    return (
        <Segmented
            className={styles[size]}
            block={block}
            {...rest}
        />
    );
};


SmallSegment.propTypes = {
    size: PropTypes.string,
    block: PropTypes.bool
};

export default SmallSegment;
