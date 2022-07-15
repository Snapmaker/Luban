import { expose } from 'threads/worker';

import sortUnorderedLine from '../../workers/sortUnorderedLine';
import calculateSectionPoints from '../../workers/calculateSectionPoints';
import mapClippingSkinArea from '../../workers/mapClippingSkinArea';
import calaClippingSkin from '../../workers/calaClippingSkin';

expose({
    sortUnorderedLine,
    calculateSectionPoints,
    mapClippingSkinArea,
    calaClippingSkin
});
