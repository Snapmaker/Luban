import React, { PropTypes } from 'react';
import { OverlayTrigger, Popover } from 'react-bootstrap';


const TipTrigger = (props) => {
    const title = props.title;
    const content = props.content;
    const children = props.children;

    const overlay = () => {
        return (
            <Popover id={`tip-popover-${title}`} title={title}>
                {content}
            </Popover>
        );
    };

    return (
        <OverlayTrigger
            placement="left"
            overlay={overlay()}
            delayShow={500}
        >
            <div>
                {children}
            </div>
        </OverlayTrigger>
    );
};


TipTrigger.propTypes = {
    title: PropTypes.string,
    content: PropTypes.string
};

export default TipTrigger;
