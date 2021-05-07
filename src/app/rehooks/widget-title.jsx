import { useEffect } from 'react';
import i18n from '../lib/i18n';

const useWidgetTitle = (setTitle, title, otherFunction) => {
    useEffect(() => {
        setTitle && setTitle(i18n._(title));
        otherFunction && otherFunction();
    }, []);
};
export default useWidgetTitle;
