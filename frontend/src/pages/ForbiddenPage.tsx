import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

import { StatusPage } from '../components/StatusPage.js';
import { Button } from '../components/ui/Button.js';

export const ForbiddenPage = () => (
  <StatusPage
    icon={ShieldAlert}
    code="403 — Not authorized"
    title="You don't have access to this page"
    description="Your account doesn't have permission to view this area. If you think that's wrong, contact your administrator."
    action={
      <Link to="/">
        <Button type="button">Back to dashboard</Button>
      </Link>
    }
  />
);
