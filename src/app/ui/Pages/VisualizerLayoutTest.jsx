import React from 'react';
import VisualizerLayout from '../Layouts/VisualizerLayout';

const VisualizerLayoutTest = () => {
    const renderBottomLeft = () => {
        return (
            <div>
                <div>bottomLeft2</div>
            </div>
        );
    };
    const renderCenterLeft = () => {
        return (
            <div>
                <div>Left</div>
            </div>
        );
    };
    const renderBottom = () => {
        return (
            <div>bottomBar</div>
        );
    };
    const renderCenter = () => {
        return (
            <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                visualizerPart
            </div>
        );
    };
    const renderBottomRight = () => {
        return (
            <div>
                basic info
            </div>
        );
    };
    const renderCenterRight = () => {
        return (
            <div>
                previce config
            </div>
        );
    };
    const renderTop = () => {
        return (
            <div>
                remind
            </div>
        );
    };
    const renderTopRight = () => {
        return (
            <div>
                preview port
            </div>
        );
    };
    return (
        <VisualizerLayout
            renderBottomLeft={renderBottomLeft}
            hideBottomLeft={false}
            renderBottom={renderBottom}
            hideBottom={false}
            renderBottomRight={renderBottomRight}
            hideBottomRight={false}
            renderCenterLeft={renderCenterLeft}
            hideCenterLeft={false}
            renderCenter={renderCenter}
            hideCenter={false}
            renderCenterRight={renderCenterRight}
            hideCenterRight={false}
            renderTop={renderTop}
            hideTop={false}
            renderTopRight={renderTopRight}
            hideTopRight={false}
        />
    );
};

export default VisualizerLayoutTest;
