import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';

import { AuthLayout } from '../../components/AuthLayout.js';
import { Alert } from '../../components/ui/Alert.js';

export const VerifyEmailSentPage = () => (
  <AuthLayout
    eyebrow="One more step"
    title="Check your inbox"
    footer={
      <Link to="/login" className="font-medium text-primary hover:underline">
        Back to sign in
      </Link>
    }
  >
    <Alert variant="info" icon={MailCheck}>
      We sent you a verification link. Open it to activate your account, then sign in.
    </Alert>
  </AuthLayout>
);
