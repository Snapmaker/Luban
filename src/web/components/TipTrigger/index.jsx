import React from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Popover } from 'react-bootstrap';


const TipTrigger = (props) => {
    const { placement = 'left', title, content, children, ...rest } = props;

    const overlay = () => {
        return (
            <Popover id={`tip-popover-${title}`} title={title}>
                {content}
            </Popover>
        );
    };

    return (
        <OverlayTrigger
            placement={placement}
            overlay={overlay()}
            delayShow={500}
        >
            <div {...rest}>
                {children}
            </div>
        </OverlayTrigger>
    );
};


TipTrigger.propTypes = {
    placement: PropTypes.string,
    title: PropTypes.string,
    content: PropTypes.oneOfType([PropTypes.string, PropTypes.node])
};

export default TipTrigger;
