import { expose } from 'threads/worker';

import sortUnorderedLine from '../../workers/sortUnorderedLine';
import mapClippingSkinArea from '../../workers/mapClippingSkinArea';
import calaClippingSkin from '../../workers/calaClippingSkin';

expose({
    sortUnorderedLine,
    mapClippingSkinArea,
    calaClippingSkin
});
