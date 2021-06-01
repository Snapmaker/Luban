import React from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Popover } from 'react-bootstrap';


const TipTrigger = (props) => {
    const { placement = 'left', title = '', content, isIcon = false, children, ...rest } = props;
    let placementValue = 'left';
    let getOverlay;
    if (isIcon) {
        placementValue = 'bottom';
        getOverlay = () => {
            return (
                <Popover
                    id={`tip-popover-${title}`}
                    style={{
                        backgroundColor: '#FFFFCD',
                        padding: '2px 10px',
                        color: '#272829',
                        borderRadius: 3
                    }}
                >
                    <Popover.Title style={{ backgroundColor: '#FFFFCD' }}>
                        {title}
                    </Popover.Title>
                    <Popover.Content style={{ backgroundColor: '#FFFFCD' }}>{content}</Popover.Content>
                </Popover>
            );
        };
    } else {
        placementValue = placement;
        getOverlay = () => {
            return (
                <Popover
                    id={`tip-popover-${title}`}
                >
                    <Popover.Title>{title}</Popover.Title>
                    <Popover.Content>{content}</Popover.Content>
                </Popover>
            );
        };
    }

    if (content) {
        const overlay = getOverlay();
        return (
            <OverlayTrigger
                placement={placementValue}
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
