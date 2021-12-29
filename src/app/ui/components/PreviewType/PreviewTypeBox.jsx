import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Checkbox from '../Checkbox';
// import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
// import i18n from '../../../lib/i18n';

class PreviewTypeBox extends PureComponent {
    static propTypes = {
        fatherValue: PropTypes.bool.isRequired,
        fatherContent: PropTypes.string.isRequired,
        fatherColor: PropTypes.string,
        onChangeFatherValue: PropTypes.func.isRequired
        // isDropdown: PropTypes.bool
    };

    render() {
        const { fatherValue, fatherContent, fatherColor, onChangeFatherValue } = this.props;
        return (
            <div>
                <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                    <div>
                        <Checkbox
                            checked={fatherValue}
                            onChange={onChangeFatherValue}
                        />
                        <span className="v-align-m margin-left-8">
                            {fatherContent}
                        </span>
                    </div>
                    {fatherColor && (
                        <div>
                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: fatherColor }} />
                        </div>
                    )}
                </div>
                {/*{isDualExtruder && (*/}
                {/*    <div className="sm-flex justify-space-between height-24 margin-vertical-8">*/}
                {/*        <div>*/}
                {/*            <Checkbox*/}
                {/*                checked={allShowTypes[RIGHT_EXTRUDER].showWallInner}*/}
                {/*                onChange={togglePreviewOptionFactoryByTypeAndDirection('showWallInner', 'WALL-INNER', RIGHT_EXTRUDER)}*/}
                {/*            />*/}
                {/*            <span className="v-align-m margin-left-8">*/}
                {/*                                            {i18n._('key-Printing/Preview-Inner Wall')}*/}
                {/*                                        </span>*/}
                {/*        </div>*/}
                {/*        <div>*/}
                {/*            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#00ff00' }} />*/}
                {/*        </div>*/}
                {/*    </div>*/}
                {/*)}*/}
            </div>
        );
    }
}

export default PreviewTypeBox;
