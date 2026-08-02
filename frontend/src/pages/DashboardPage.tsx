import { useCurrentUser, useLogout } from '../features/auth/useAuth.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';

export const DashboardPage = () => {
  const { data: user } = useCurrentUser();
  const { mutate: signOut, isPending } = useLogout();

  return (
    <main className="min-h-dvh px-6 py-12">
      <div className="mx-auto max-w-2xl flex flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl">Welcome, {user?.name}</h1>
            <p className="text-muted text-sm capitalize">{user?.role}</p>
          </div>
          <Button variant="ghost" onClick={() => signOut()} loading={isPending}>
            Sign out
          </Button>
        </header>

        <Card>
          <h2 className="text-lg mb-2">Phase 1 complete</h2>
          <p className="text-sm text-muted">
            Authentication, protected routing and the themed shell are in place.
            Academic structure arrives in Phase 2.
          </p>
        </Card>
      </div>
    </main>
  );
};
