import React from 'react';
import { Route, Redirect, withRouter } from 'react-router-dom';
import ReactGA from 'react-ga';
import user from '../../lib/user';

const ProtectedRoute = ({ component: Component, ...rest }) => (
    <Route
        {...rest}
        render={props => {
            function logPageView() {
                ReactGA.set({ page: window.location.pathname + window.location.search + window.location.hash });
                ReactGA.pageview(window.location.pathname + window.location.search + window.location.hash);
            }

            logPageView();

            if (user.authenticated()) {
                return Component ? <Component {...rest} /> : null;
            }

            return (
                <Redirect
                    to={{
                        pathname: '/login',
                        state: {
                            from: props.location
                        }
                    }}
                />
            );
        }}
    />
);

ProtectedRoute.propTypes = {
    ...withRouter.propTypes
};

export default ProtectedRoute;
