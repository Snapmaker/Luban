import React from 'react';

import ConnectionControl, { ConnectionControlProps } from './Control';

/**
 * Connection Control Widget.
 *
 * After connect to networked printer, you can control printer via this widget.
 */
const ConnectionControlWidget: React.FC<ConnectionControlProps> = (props) => {
    return (
        <ConnectionControl {...props} />
    );
};

export default ConnectionControlWidget;
