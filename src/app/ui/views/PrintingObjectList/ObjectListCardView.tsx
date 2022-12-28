import React from 'react';

import i18n from '../../../lib/i18n';
import { logObjectListOperation } from '../../../lib/gaEvent';
import { HEAD_PRINTING } from '../../../constants';
import Card from '../../components/Card';

import ObjectListView from './ObjectListView';


const ObjectListCardView: React.FC = () => {
    return (
        <Card
            title={i18n._('key-Printing/ObjectList-Object List')}
            hasToggleButton
            onShowContent={(show) => {
                if (show) {
                    logObjectListOperation(HEAD_PRINTING, 'expand');
                } else {
                    logObjectListOperation(HEAD_PRINTING, 'pack');
                }
            }}
        >
            <ObjectListView />
        </Card>
    );
};

export default ObjectListCardView;
