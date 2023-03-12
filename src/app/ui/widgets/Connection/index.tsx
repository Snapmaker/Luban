import React from 'react';

import Connection, { ConnectionProps } from './Connection';

const ConnectionWidget: React.FC<ConnectionProps> = (props) => {
    return (
        <Connection {...props} />
    );
};

export default ConnectionWidget;
