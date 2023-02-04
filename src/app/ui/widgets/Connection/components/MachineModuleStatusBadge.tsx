import React from 'react';

interface MachineModuleStatusBadgeProps {
    moduleName: string;
    status: boolean;
}

const MachineModuleStatusBadge: React.FC<MachineModuleStatusBadgeProps> = (props) => {
    const { moduleName, status } = props;

    return (
        <div className="sm-flex align-center padding-horizontal-8 background-grey-3 border-radius-12 margin-top-8 margin-right-8">
            <span className="margin-right-8 tooltip-message height-24">{moduleName}</span>
            <span
                style={{
                    display: 'inline-block',
                    backgroundColor: status ? '#4CB518' : '#FFA940',
                    height: 6,
                    width: 6,
                    borderRadius: 3,
                }}
            />
        </div>
    );
};

export default MachineModuleStatusBadge;
