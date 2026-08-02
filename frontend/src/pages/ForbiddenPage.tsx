import { Link } from 'react-router-dom';

import { AuthLayout } from '../components/AuthLayout.js';

export const ForbiddenPage = () => (
  <AuthLayout
    title="Not authorized"
    subtitle="403"
    footer={
      <Link to="/" className="text-primary underline">
        Back to dashboard
      </Link>
    }
  >
    <p className="text-sm text-muted">
      Your account does not have access to this area.
    </p>
  </AuthLayout>
);
