import React from 'react';
import PropTypes from 'prop-types';

import EditComponent from '../../components/Edit';



const ParamsWrapper = (props) => {
    return (
        <div className="sm-flex-overflow-visible margin-vertical-8 justify-space-between">
            <div className="height-32 width-176 display-inline text-overflow-ellipsis">{props.title}</div>
            <div className="sm-flex margin-left-24 overflow-visible">
                {props.children}
                <EditComponent {...props} handleSubmit={props.handleSubmit} initValue={props.initValue} />
            </div>
        </div>
    );
};

ParamsWrapper.propTypes = {
    children: PropTypes.array,
    title: PropTypes.string,
    handleSubmit: PropTypes.func.isRequired,
    initValue: PropTypes.number.isRequired,
};


export default ParamsWrapper;
