import React from 'react';
import SvgIcon from '../../components/SvgIcon';

interface CancelButtonProps {
    onClick: () => void;
}

const CancelButton: React.FC<CancelButtonProps> = ({ onClick }) => {
    return (
        <SvgIcon
            size={24}
            name="Cancel"
            type={['static']}
            onClick={onClick}
        />
    );
};

export default CancelButton;
