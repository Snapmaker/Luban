import React from 'react';
import PropTypes from 'prop-types';

import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const Loading = (props) => <LoadingOutlined {...props} style={{ fontSize: 19, ...props.style }} spin />;

Loading.propTypes = {
    style: PropTypes.object,
};
export default () => <Spin indicator={Loading} delay={1000} />;
