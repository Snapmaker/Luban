// import React from 'react';
import Loadable from 'react-loadable';
import loadingComponent from './loading';

export default (loader, loading = loadingComponent) => {
    return Loadable({
        loader,
        loading
    });
};
