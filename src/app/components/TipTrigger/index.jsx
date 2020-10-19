import React from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Popover } from 'react-bootstrap';


const TipTrigger = (props) => {
    const { placement = 'left', title = '', content, children, ...rest } = props;

    const getOverlay = () => {
        return (
            <Popover id={`tip-popover-${title}`}>
                <Popover.Title>{title}</Popover.Title>
                <Popover.Content>{content}</Popover.Content>
            </Popover>
        );
    };

    if (content) {
        const overlay = getOverlay();
        return (
            <OverlayTrigger
                placement={placement}
                overlay={overlay}
                delayShow={500}
            >
                <div {...rest}>
                    {children}
                </div>
            </OverlayTrigger>
        );
    } else {
        return (
            <div {...rest}>
                {children}
            </div>
        );
    }
};


TipTrigger.propTypes = {
    placement: PropTypes.string,
    title: PropTypes.string,
    children: PropTypes.node,
    content: PropTypes.oneOfType([PropTypes.string, PropTypes.node])
};

export default TipTrigger;
