import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styles from './styles/visualizer.styl';
/* eslint-disable */
class VisualizerLayout extends PureComponent {
    static propTypes = {
        renderTopLeft: PropTypes.func,
        renderTop: PropTypes.func,
        renderTopRight: PropTypes.func,
        renderCenterLeft: PropTypes.func,
        renderCenter: PropTypes.func,
        renderCenterRight: PropTypes.func,
        renderBottomLeft: PropTypes.func,
        renderBottom: PropTypes.func,
        renderBottomRight: PropTypes.func,
        hideTopLeft: PropTypes.bool,
        hideTop: PropTypes.bool,
        hideTopRight: PropTypes.bool,
        hideCenterLeft: PropTypes.bool,
        hideCenter: PropTypes.bool,
        hideCenterRight: PropTypes.bool,
        hideBottomLeft: PropTypes.bool,
        hideBottom: PropTypes.bool,
        hideBottomRight: PropTypes.bool,
    }
    render() {
        const {
            renderTopLeft, renderTop, renderTopRight,
            renderCenterLeft, renderCenter, renderCenterRight,
            renderBottomLeft, renderBottom, renderBottomRight,
            hideTopLeft, hideTop, hideTopRight,
            hideCenter, hideCenterLeft, hideCenterRight,
            hideBottom, hideBottomLeft, hideBottomRight
        } = this.props;
        return (
            <div className={styles.visualizer}>
                {renderTopLeft && <div
                    className={
                        classNames(
                            styles['top-left-container'],
                            {[styles.hidden]: hideTopLeft}
                        )
                    }
                >
                        {renderTopLeft()}
                    </div>
                }
                {renderTop && <div
                    className={
                        classNames(
                            styles['top-container'],
                            {[styles.hidden]: hideTop}
                        )
                    }
                >
                        {renderTop()}
                    </div>
                }
                {renderTopRight && <div
                    className={
                        classNames(
                            styles['top-right-container'],
                            {[styles.hidden]: hideTopRight}
                        )
                    }
                >
                        {renderTopRight()}
                    </div>
                }
                {renderCenterLeft && <div
                    className={
                        classNames(
                            styles['center-left-container'],
                            {[styles.hidden]: hideCenterLeft}
                        )
                    }
                >
                        {renderCenterLeft()}
                    </div>
                }
                {renderCenter && <div
                    className={
                        classNames(
                            styles['center-container'],
                            {[styles.hidden]: hideCenter}
                        )
                    }
                >
                        {renderCenter()}
                    </div>
                }
                {renderCenterRight && <div
                    className={
                        classNames(
                            styles['center-right-container'],
                            {[styles.hidden]: hideCenterRight}
                        )
                    }
                >
                        {renderCenterRight()}
                    </div>
                }
                {renderBottomLeft && <div
                    className={
                        classNames(
                            styles['bottom-left-container'],
                            {[styles.hidden]: hideBottomLeft}
                        )
                    }
                >
                        {renderBottomLeft()}
                    </div>
                }
                {renderBottom && <div
                    className={
                        classNames(
                            styles['bottom-container'],
                            {[styles.hidden]: hideBottom}
                        )
                    }
                >
                        {renderBottom()}
                    </div>
                }
                {renderBottomRight && <div
                    className={
                        classNames(
                            styles['bottom-right-container'],
                            {[styles.hidden]: hideBottomRight}
                        )
                    }
                >
                    {renderBottomRight && renderBottomRight()}
                </div>}
            </div>
        )
    }
}

export default VisualizerLayout