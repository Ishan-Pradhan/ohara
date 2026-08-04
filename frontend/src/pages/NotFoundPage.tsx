import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

import { StatusPage } from '../components/StatusPage.js';
import { Button } from '../components/ui/Button.js';

export const NotFoundPage = () => (
  <StatusPage
    icon={Compass}
    code="404 — Page not found"
    title="We couldn't find that page"
    description="The page you're looking for doesn't exist or may have moved."
    action={
      <Link to="/">
        <Button type="button">Back to dashboard</Button>
      </Link>
    }
  />
);
