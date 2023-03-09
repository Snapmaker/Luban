import React from 'react';

import ConnectionControl, { ConnectionControlProps } from './Control';

const ConnectionControlWidget: React.FC<ConnectionControlProps> = (props) => {
    return (
        <ConnectionControl {...props} />
    );
};

export default ConnectionControlWidget;
