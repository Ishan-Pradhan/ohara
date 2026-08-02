import { Link } from 'react-router-dom';

import { AuthLayout } from '../../components/AuthLayout.js';

export const VerifyEmailSentPage = () => (
  <AuthLayout
    title="Check your inbox"
    subtitle="One more step"
    footer={
      <Link to="/login" className="text-primary underline">
        Back to sign in
      </Link>
    }
  >
    <p className="text-sm text-muted">
      We sent you a verification link. Open it to activate your account, then
      sign in.
    </p>
  </AuthLayout>
);
