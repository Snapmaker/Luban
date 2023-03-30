import React, { ReactNode } from 'react';

import EditComponent from '../../../components/Edit';

interface ParamsWrapperProps {
    children?: ReactNode;
    title?: string;
    editable?: boolean;
    handleSubmit: (value: number) => void;
    initValue: number;
}

/**
 * Container to display attributes and their edit component.
 *
 * - Fixed height and width (32x176)
 *
 * | Actual Value | Target Value | Edit Component (optional) |
 */
const AttributeContainer: React.FC<ParamsWrapperProps> = (props) => {
    const {
        title = '',
        editable = true,
        initValue,
        handleSubmit,
    } = props;

    return (
        <div className="sm-flex-overflow-visible margin-vertical-8 justify-space-between">
            <div className="height-32 width-176 display-inline text-overflow-ellipsis">{title}</div>
            <div className="sm-flex margin-left-24 overflow-visible">
                {props.children}
                {
                    editable && (
                        <EditComponent
                            {...props}
                            handleSubmit={handleSubmit}
                            initValue={initValue}
                            disabled={!editable}
                        />
                    )
                }
            </div>
        </div>
    );
};

export default AttributeContainer;
