import { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';

class Init extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes
    }

    componentDidMount() {
        setTimeout(() => {
            this.props.history.push('/3dp');
        }, 500);
    }

    render() {
        return null;
    }
}

export default withRouter(Init);

