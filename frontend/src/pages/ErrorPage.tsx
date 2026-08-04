import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { ServerCrash } from 'lucide-react';

import { StatusPage } from '../components/StatusPage.js';
import { Button } from '../components/ui/Button.js';

/** Caught by React Router's errorElement — a render/loader throw anywhere in
 * the tree lands here instead of a blank white screen. */
export const ErrorPage = () => {
  const error = useRouteError();
  const description = isRouteErrorResponse(error)
    ? error.statusText || 'Something went wrong loading this page.'
    : 'Something unexpected happened on our end. Try reloading the page.';

  return (
    <StatusPage
      icon={ServerCrash}
      code="500 — Something went wrong"
      title="We hit a snag"
      description={description}
      action={
        <Button type="button" onClick={() => window.location.assign('/')}>
          Back to dashboard
        </Button>
      }
    />
  );
};
