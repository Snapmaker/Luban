import React from 'react';
import Widget from '../Widget';

// Widget sortable handle
export default React.memo(() => (
    <Widget.Sortable className="sortable-handle">
        <i className="fa fa-bars" />
        <span className="space" />
    </Widget.Sortable>
));
