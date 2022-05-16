import React from 'react';
import PropTypes from 'prop-types';

import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

// const Loading = (props) => <LoadingOutlined {...props} style={{ fontSize: 19, ...props.style }} spin />;

const Loading = (props) => <Spin {...props} style={{ ...props.style }} indicator={<LoadingOutlined spin />} delay={200} />;

Loading.propTypes = {
    style: PropTypes.object,
};
export default Loading;
