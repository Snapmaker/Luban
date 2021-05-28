import { useEffect } from 'react';
import i18n from '../i18n';

const useWidgetTitle = (setTitle, title, otherFunction) => {
    useEffect(() => {
        setTitle && setTitle(i18n._(title));
        otherFunction && otherFunction();
    }, [setTitle, title, otherFunction]);
};
export default useWidgetTitle;
